/**
 * Unit tests for `group_runs`' Pass B resume seam (`--sweep <id>`):
 *
 *   - `resolve_sweep_id` returns an explicit sweep id verbatim (resume) and
 *     mints a fresh, sortable one when none is given;
 *   - `existing_plan_areas` reports exactly the fault areas whose staged plan
 *     (`plans/<area>.json`) is present AND non-empty, so a resumed run skips
 *     re-dispatching those strategists — a zero-byte file (crashed pre-write)
 *     counts as absent, and a missing plans dir yields an empty set.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolve_sweep_id, existing_plan_areas } from "./group_runs.js";
import { plan_staging_plans_dir } from "../src/store/paths.js";

const SWEEP_ID = "sweep-resume-fixture";

let plan_dir: string;
let saved_override: string | undefined;

beforeEach(async () => {
  saved_override = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  plan_dir = await fs.mkdtemp(path.join(os.tmpdir(), "group-runs-"));
  process.env.ARIADNE_PLAN_DIR_OVERRIDE = plan_dir;
});

afterEach(async () => {
  if (saved_override === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_override;
  await fs.rm(plan_dir, { recursive: true, force: true });
});

describe("resolve_sweep_id", () => {
  it("returns an explicit sweep id verbatim so a resume reuses the dir", () => {
    expect(resolve_sweep_id("sweep-2026-01-02")).toEqual("sweep-2026-01-02");
  });

  it("mints a fresh, sortable sweep id when none is given", () => {
    const minted = resolve_sweep_id(null);
    expect(minted.startsWith("sweep-")).toBe(true);
  });
});

describe("existing_plan_areas", () => {
  it("returns an empty set when the plans dir does not exist", async () => {
    expect(await existing_plan_areas(SWEEP_ID)).toEqual(new Set());
  });

  it("reports non-empty staged plans and excludes empty files and non-json", async () => {
    const plans_dir = plan_staging_plans_dir(SWEEP_ID);
    await fs.mkdir(plans_dir, { recursive: true });
    await fs.writeFile(path.join(plans_dir, "name_resolution.json"), JSON.stringify({ root: {} }) + "\n");
    await fs.writeFile(path.join(plans_dir, "decorators.json"), JSON.stringify({ root: {} }) + "\n");
    await fs.writeFile(path.join(plans_dir, "crashed.json"), ""); // zero-byte pre-write
    await fs.writeFile(path.join(plans_dir, "notes.txt"), "ignore me");

    expect(await existing_plan_areas(SWEEP_ID)).toEqual(
      new Set(["name_resolution", "decorators"]),
    );
  });
});
