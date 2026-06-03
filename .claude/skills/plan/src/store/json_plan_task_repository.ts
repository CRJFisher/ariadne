import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import * as path from "node:path";

import { atomic_write_file, error_code } from "@ariadnejs/skill-fs";
import {
  plan_sweeps_dir,
  plan_task_path,
  plan_tasks_dir,
  type PlanSweepEvent,
  type PlanTask,
  type PlanTaskId,
  type PlanTaskQuery,
  type PlanTaskRepository,
} from "@ariadnejs/skill-protocol";

import { parse_plan_task } from "./plan_task_record.js";

/**
 * The JSON-on-disk implementation of {@link PlanTaskRepository} — the concrete
 * store behind the engine's swap-seam. One file per task at
 * `~/.ariadne/plan/tasks/<id>.json` (written via `atomic_write_file`: temp +
 * rename), plus an append-only `~/.ariadne/plan/sweeps/<sweep_id>.jsonl`
 * provenance log.
 *
 * Single writer per task file, so writes are rename-atomic with NO global lock
 * — this store deliberately stays out of the registry-writer lock contract and
 * is never added to its allowlist (the `<id>.json` path is not registry-shaped).
 * The same single-writer assumption covers the sweep log: one engine pass owns
 * its `sweep_id`, so `append_sweep_event` needs no lock to keep the JSONL
 * one-object-per-line invariant.
 *
 * Reads (`get`/`query`/`children_of`/`find_by_dedup_key`) are the proven
 * `discover_runs` pattern: `readdir` + per-file parse + in-memory filter. The
 * store derives nothing — it filters on the stored `fault_area`/`dedup_key`
 * strings the engine already computed.
 *
 * Locations resolve through `@ariadnejs/skill-protocol`, which honors
 * `ARIADNE_PLAN_DIR_OVERRIDE` lazily on every call, so the store needs no
 * injected root and tests isolate purely by setting that env var.
 */
export class JsonPlanTaskRepository implements PlanTaskRepository {
  async get(id: PlanTaskId): Promise<PlanTask | null> {
    const file_path = plan_task_path(id);
    let text: string;
    try {
      text = await readFile(file_path, "utf8");
    } catch (err) {
      if (error_code(err) === "ENOENT") return null;
      throw err;
    }
    return parse_plan_task(file_path, text);
  }

  async query(filter: PlanTaskQuery): Promise<PlanTask[]> {
    const tasks = await this.read_all();
    return tasks.filter(
      (t) =>
        (filter.fault_area === undefined || t.fault_area === filter.fault_area) &&
        (filter.status === undefined || t.status === filter.status) &&
        (filter.tier === undefined || t.tier === filter.tier) &&
        (filter.parent_id === undefined || t.parent_id === filter.parent_id) &&
        (filter.dedup_key === undefined || t.dedup_key === filter.dedup_key),
    );
  }

  async children_of(id: PlanTaskId): Promise<PlanTask[]> {
    const tasks = await this.read_all();
    return tasks.filter((t) => t.parent_id === id);
  }

  async find_by_dedup_key(key: string): Promise<PlanTask[]> {
    const tasks = await this.read_all();
    return tasks.filter((t) => t.dedup_key === key);
  }

  async put(task: PlanTask): Promise<void> {
    await mkdir(plan_tasks_dir(), { recursive: true });
    await this.write_one(task);
  }

  /**
   * Upsert many tasks, one `<id>.json` each. Per-file atomic, NOT batch-atomic:
   * a mid-batch failure leaves the already-renamed files in place. The engine
   * owns recovery — a partial batch is reconciled on the next sweep — so no
   * cross-file transaction is needed here.
   */
  async put_many(tasks: PlanTask[]): Promise<void> {
    await mkdir(plan_tasks_dir(), { recursive: true });
    await Promise.all(tasks.map((task) => this.write_one(task)));
  }

  /** Append one event as a JSON line to `sweeps/<sweep_id>.jsonl` (the engine-minted sweep id). */
  async append_sweep_event(sweep_id: string, event: PlanSweepEvent): Promise<void> {
    await mkdir(plan_sweeps_dir(), { recursive: true });
    const log_path = path.join(plan_sweeps_dir(), `${sweep_id}.jsonl`);
    await appendFile(log_path, `${JSON.stringify(event)}\n`, "utf8");
  }

  /** Serialize one task and atomically write its `<id>.json` file (no lock — single writer). */
  private async write_one(task: PlanTask): Promise<void> {
    await atomic_write_file(plan_task_path(task.id), `${JSON.stringify(task, null, 2)}\n`);
  }

  /**
   * Read and parse every `tasks/<id>.json` (the `discover_runs` pattern). An
   * absent tasks dir is normal (no task minted yet) → empty list. Non-`.json`
   * entries (a stray `.tmp` from an interrupted write, `.DS_Store`) are skipped
   * by name; a malformed or schema-mismatched `.json` file throws via
   * `parse_plan_task` — it is corruption of the engine's own DB, not legacy
   * debris, and AC#2 requires reads to reject it.
   */
  private async read_all(): Promise<PlanTask[]> {
    const dir = plan_tasks_dir();
    let files: string[];
    try {
      files = await readdir(dir);
    } catch (err) {
      if (error_code(err) === "ENOENT") return [];
      throw err;
    }
    const tasks: PlanTask[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const file_path = path.join(dir, file);
      const text = await readFile(file_path, "utf8");
      tasks.push(parse_plan_task(file_path, text));
    }
    return tasks;
  }
}
