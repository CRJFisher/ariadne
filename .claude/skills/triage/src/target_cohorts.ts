/**
 * Which cohort each triage target belongs to, read from the target register.
 *
 * `targets.yaml` is the register of corpora the pipeline is run against, and
 * `cohort` is how it groups them: cohort 1 is the first twenty targets, cohort 2
 * the next twenty. Packaging a transfer bundle selects by that grouping, so the
 * register has to be readable rather than restated — a hard-coded project list
 * would go stale the first time a target is added.
 *
 * Only the two fields that selection needs are read. `targets.yaml` is a flat
 * block sequence of scalar fields, which this scans directly rather than through
 * a YAML parser: the repository's CI installs with `--frozen-lockfile`, so a new
 * dependency here is a lockfile change, and this file's shape does not warrant
 * one. A target block missing either field is an error naming the target, not a
 * silently skipped row.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { repo_root } from "@ariadnejs/skill-protocol";

/** Start of a target block: `  - project_id: <id>`. */
const TARGET_START = /^ {2}- project_id:\s*(\S+)\s*$/;

/** A scalar field within a block: `    <key>: <value>`. */
const TARGET_FIELD = /^ {4}(\w+):\s*(.*?)\s*$/;

/** Absolute path to the target register. */
export function target_register_path(): string {
  return path.join(repo_root(), ".claude", "skills", "triage", "targets.yaml");
}

/**
 * Map each target's `project_id` to its cohort number.
 *
 * The ids are the canonical, owner-qualified slugs. A store may hold a project
 * under a legacy id, so callers resolve that to its canonical id first — see
 * `store/project_identity.ts` — and look the result up here.
 */
export function read_target_cohorts(file_path: string = target_register_path()): Map<string, number> {
  const text = fs.readFileSync(file_path, "utf8");
  const cohorts = new Map<string, number>();

  let project_id: string | null = null;
  let cohort: number | null = null;

  const close_block = (): void => {
    if (project_id === null) return;
    if (cohort === null) {
      throw new Error(`${file_path}: target "${project_id}" declares no cohort`);
    }
    cohorts.set(project_id, cohort);
  };

  for (const line of text.split("\n")) {
    const start = TARGET_START.exec(line);
    if (start !== null) {
      close_block();
      project_id = start[1];
      cohort = null;
      continue;
    }

    if (project_id === null) continue;

    const field = TARGET_FIELD.exec(line);
    if (field === null) continue;
    if (field[1] !== "cohort") continue;

    const parsed = Number.parseInt(field[2], 10);
    if (Number.isNaN(parsed)) {
      throw new Error(`${file_path}: target "${project_id}" has a non-numeric cohort "${field[2]}"`);
    }
    cohort = parsed;
  }
  close_block();

  if (cohorts.size === 0) throw new Error(`${file_path}: no targets found`);
  return cohorts;
}
