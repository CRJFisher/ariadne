import { describe, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { load_verdicts_by_entry_index } from "./verdict_ledger.js";
import type { TriageVerdict } from "../verdict/triage_verdict.js";

const TP_VERDICT: TriageVerdict = {
  kind: "tp",
  member_evidence: { file: "src/test.ts", line: 10, why: "no callers" },
};

const UNCERTAIN_VERDICT: TriageVerdict = {
  kind: "uncertain",
  reason: "compounding gaps",
  member_evidence: { file: "src/test.ts", line: 10, why: "two possible paths" },
};

describe("load_verdicts_by_entry_index", () => {
  it("returns an empty map when the results dir does not exist", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "load-verdicts-"));
    try {
      const out = await load_verdicts_by_entry_index(path.join(tmp, "absent"));
      expect(out.size).toBe(0);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("parses every <N>.json file in the results dir", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "load-verdicts-"));
    const dir = path.join(tmp, "results");
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.writeFile(path.join(dir, "0.json"), JSON.stringify(TP_VERDICT));
      await fs.writeFile(path.join(dir, "12.json"), JSON.stringify(UNCERTAIN_VERDICT));
      await fs.writeFile(path.join(dir, "readme.json"), JSON.stringify({}));
      await fs.writeFile(path.join(dir, "12.txt"), "");
      const out = await load_verdicts_by_entry_index(dir);
      expect([...out.entries()].sort((a, b) => a[0] - b[0])).toEqual([
        [0, TP_VERDICT],
        [12, UNCERTAIN_VERDICT],
      ]);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("throws with a clear error on a malformed verdict file", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "load-verdicts-"));
    const dir = path.join(tmp, "results");
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.writeFile(path.join(dir, "5.json"), JSON.stringify({ kind: "not-a-kind" }));
      await expect(load_verdicts_by_entry_index(dir)).rejects.toThrow(/unknown kind/);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("rejects filenames outside the strict <entry_index>.json contract", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "load-verdicts-"));
    const dir = path.join(tmp, "results");
    await fs.mkdir(dir, { recursive: true });
    try {
      const skipped_names = ["-3.json", "01.json", "5.5.json", "+5.json"];
      for (const name of skipped_names) {
        await fs.writeFile(path.join(dir, name), JSON.stringify(TP_VERDICT));
      }
      await fs.writeFile(path.join(dir, "0.json"), JSON.stringify(TP_VERDICT));
      const out = await load_verdicts_by_entry_index(dir);
      expect([...out.keys()]).toEqual([0]);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
