import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  append_coordinator_log_entry,
  read_coordinator_log,
  type CoordinatorLogEntry,
} from "./log.js";
import type { VerdictFpNovelNew } from "../triage_verdict.js";

const SEED_VERDICT: VerdictFpNovelNew = {
  kind: "fp-novel-new",
  proposed_root_cause: "framework registers route via decorator",
  evidence_excerpt: "@route('/x')",
  member_evidence: { file: "src/r.ts", line: 7, why: "decorator-registered" },
};

describe("coordinator_log", () => {
  let tmp_dir: string;
  let log_path: string;

  beforeEach(async () => {
    tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "coord-log-"));
    log_path = path.join(tmp_dir, "coordinator_log.jsonl");
  });

  afterEach(async () => {
    await fs.rm(tmp_dir, { recursive: true, force: true });
  });

  describe("read_coordinator_log", () => {
    it("returns empty array when path does not exist", async () => {
      expect(await read_coordinator_log(log_path)).toEqual([]);
    });
  });

  describe("append_coordinator_log_entry", () => {
    it("appends a single entry round-trips through read", async () => {
      const entry: CoordinatorLogEntry = {
        timestamp: "2026-05-22T00:00:00.000Z",
        entry_index: 4,
        verdict: SEED_VERDICT,
        decision: {
          kind: "register_new",
          canonical_name: "Decorator route",
          root_cause: "framework registers route via decorator",
          reason: "no existing match",
        },
      };
      await append_coordinator_log_entry(log_path, entry);
      expect(await read_coordinator_log(log_path)).toEqual([entry]);
    });

    it("appends multiple entries preserving order", async () => {
      const a: CoordinatorLogEntry = {
        timestamp: "2026-05-22T00:00:00.000Z",
        entry_index: 4,
        verdict: SEED_VERDICT,
        decision: {
          kind: "register_new",
          canonical_name: "Decorator route",
          root_cause: "framework registers route via decorator",
          reason: "no existing match",
        },
      };
      const b: CoordinatorLogEntry = {
        timestamp: "2026-05-22T00:00:01.000Z",
        entry_index: 7,
        verdict: {
          kind: "fp-novel-cited",
          novel_issue_id: "decorator-route",
          evidence_excerpt: "@route('/y')",
        },
        decision: {
          kind: "merge_into",
          novel_issue_id: "decorator-route",
          reason: "cites existing issue and matches its root_cause",
        },
      };
      await append_coordinator_log_entry(log_path, a);
      await append_coordinator_log_entry(log_path, b);
      expect(await read_coordinator_log(log_path)).toEqual([a, b]);
    });

    it("writes each entry as exactly one newline-terminated JSON line", async () => {
      const entry: CoordinatorLogEntry = {
        timestamp: "2026-05-22T00:00:00.000Z",
        entry_index: 1,
        verdict: SEED_VERDICT,
        decision: { kind: "flag", reason: "ambiguous evidence" },
      };
      await append_coordinator_log_entry(log_path, entry);
      const raw = await fs.readFile(log_path, "utf8");
      expect(raw.endsWith("\n")).toEqual(true);
      expect(raw.split("\n").filter((l) => l.length > 0).length).toEqual(1);
    });
  });

  describe("parser validation on read", () => {
    it("rejects an entry whose verdict kind is not a novel verdict", async () => {
      const bad_line = JSON.stringify({
        timestamp: "2026-05-22T00:00:00.000Z",
        entry_index: 1,
        verdict: {
          kind: "tp",
          member_evidence: { file: "x", line: 1, why: "y" },
        },
        decision: { kind: "flag", reason: "should not be logged" },
      });
      await fs.writeFile(log_path, `${bad_line}\n`, "utf8");
      await expect(read_coordinator_log(log_path)).rejects.toThrow(
        /kind 'tp' is not a novel verdict/,
      );
    });

    it("rejects an entry with negative entry_index", async () => {
      const bad_line = JSON.stringify({
        timestamp: "2026-05-22T00:00:00.000Z",
        entry_index: -1,
        verdict: SEED_VERDICT,
        decision: { kind: "flag", reason: "x" },
      });
      await fs.writeFile(log_path, `${bad_line}\n`, "utf8");
      await expect(read_coordinator_log(log_path)).rejects.toThrow(
        /entry_index: must be a non-negative integer/,
      );
    });

    it("rejects an entry with empty timestamp", async () => {
      const bad_line = JSON.stringify({
        timestamp: "",
        entry_index: 1,
        verdict: SEED_VERDICT,
        decision: { kind: "flag", reason: "x" },
      });
      await fs.writeFile(log_path, `${bad_line}\n`, "utf8");
      await expect(read_coordinator_log(log_path)).rejects.toThrow(
        /timestamp: must be a non-empty string/,
      );
    });

    it("rejects an entry with unexpected extra field", async () => {
      const bad_line = JSON.stringify({
        timestamp: "2026-05-22T00:00:00.000Z",
        entry_index: 1,
        verdict: SEED_VERDICT,
        decision: { kind: "flag", reason: "x" },
        extra: 1,
      });
      await fs.writeFile(log_path, `${bad_line}\n`, "utf8");
      await expect(read_coordinator_log(log_path)).rejects.toThrow(
        /unexpected field 'extra'/,
      );
    });
  });
});
