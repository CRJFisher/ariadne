import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fsSync from "fs";
import path from "path";

import type { FinalizationOutput } from "./build_finalization_output.js";
import {
  most_recent_finalized_triage_results,
  read_triage_results,
} from "./triage_results_store.js";

const TMP = vi.hoisted(() => {
  const tmp_path = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-triage-results-store-${process.pid}`;
  process.env.ARIADNE_SELF_REPAIR_DIR_OVERRIDE = tmp_path;
  return tmp_path;
});

const ANALYSIS_OUTPUT = path.join(TMP, "analysis_output");

beforeEach(() => {
  fsSync.rmSync(TMP, { recursive: true, force: true });
  fsSync.mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  fsSync.rmSync(TMP, { recursive: true, force: true });
});

const EMPTY_OUTPUT: FinalizationOutput = {
  schema_version: 2,
  project_path: "/some/path",
  commit_hash: null,
  confirmed_unreachable: [],
  false_positive_groups: {},
  last_updated: "2026-04-28T13:42:07.812Z",
};

function seed(project: string, run_id: string, output: FinalizationOutput = EMPTY_OUTPUT): void {
  const dir = path.join(ANALYSIS_OUTPUT, project, "triage_results");
  fsSync.mkdirSync(dir, { recursive: true });
  fsSync.writeFileSync(path.join(dir, `${run_id}.json`), JSON.stringify(output));
}

describe("most_recent_finalized_triage_results", () => {
  it("returns null when no triage_results match the commit prefix", async () => {
    seed("p", "feedf00-2026-04-26T00-00-00.000Z");
    expect(await most_recent_finalized_triage_results("p", "deadbee")).toBeNull();
  });

  it("returns null when triage_results dir is missing", async () => {
    expect(await most_recent_finalized_triage_results("nope", "deadbee")).toBeNull();
  });

  it("returns the lex-max run-id matching the commit prefix", async () => {
    seed("p", "deadbee-2026-04-26T00-00-00.000Z");
    seed("p", "deadbee-2026-04-28T00-00-00.000Z");
    seed("p", "feedf00-2026-04-27T00-00-00.000Z");

    const result = await most_recent_finalized_triage_results("p", "deadbee");
    expect(result).not.toBeNull();
    expect(result!.run_id).toBe("deadbee-2026-04-28T00-00-00.000Z");
  });

  it("does not match a partial-prefix collision (e.g. 'dead' vs 'deadbee')", async () => {
    seed("p", "deadbee-2026-04-26T00-00-00.000Z");
    expect(await most_recent_finalized_triage_results("p", "dead")).toBeNull();
  });
});

describe("read_triage_results", () => {
  it("returns the parsed output when the file exists", async () => {
    seed("p", "deadbee-2026-04-26T00-00-00.000Z");
    const result = await read_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z");
    expect(result.schema_version).toBe(2);
  });

  it("throws when the file is missing", async () => {
    await expect(read_triage_results("p", "nope")).rejects.toThrow();
  });
});
