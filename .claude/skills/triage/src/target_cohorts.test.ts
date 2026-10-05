/**
 * The reader selects what a transfer bundle carries, so a target it silently
 * drops is triage data that silently fails to travel. These cases pin that: a
 * block missing its cohort is an error naming the target, and the real register
 * parses to every target it declares.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { read_target_cohorts, target_register_path } from "./target_cohorts.js";

describe("target_cohorts", () => {
  let tmp_dir: string;
  let register: string;

  beforeEach(() => {
    tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "target-cohorts-"));
    register = path.join(tmp_dir, "targets.yaml");
  });

  afterEach(() => {
    fs.rmSync(tmp_dir, { recursive: true, force: true });
  });

  function write(body: string): void {
    fs.writeFileSync(register, body);
  }

  it("maps each target's project id to its cohort", () => {
    write(
      [
        "schema_version: 1",
        "",
        "targets:",
        "  # ---- cohort 1 · JavaScript ----",
        "  - project_id: webpack--webpack",
        "    slug: webpack/webpack",
        "    cohort: 1",
        "    triaged: true",
        "    why: \"Complex prototypal OOP.\"",
        "",
        "  - project_id: nodejs--node",
        "    slug: nodejs/node",
        "    cohort: 2",
        "    triaged: true",
        "    why: \"The JS standard library itself.\"",
        "",
      ].join("\n"),
    );

    expect(read_target_cohorts(register)).toEqual(
      new Map([
        ["webpack--webpack", 1],
        ["nodejs--node", 2],
      ]),
    );
  });

  it("reads the last target in the file, which no later block closes", () => {
    write(["targets:", "  - project_id: only--target", "    cohort: 2"].join("\n"));

    expect(read_target_cohorts(register)).toEqual(new Map([["only--target", 2]]));
  });

  it("ignores a `cohort:` that belongs to prose rather than to a target field", () => {
    write(
      [
        "# cohort: 3 is not a target",
        "targets:",
        "  - project_id: only--target",
        "    cohort: 2",
        "    why: \"cohort: 9 appears inside this description\"",
      ].join("\n"),
    );

    expect(read_target_cohorts(register)).toEqual(new Map([["only--target", 2]]));
  });

  it("names the target when a block declares no cohort", () => {
    write(["targets:", "  - project_id: broken--target", "    slug: broken/target"].join("\n"));

    expect(() => read_target_cohorts(register)).toThrow(
      `${register}: target "broken--target" declares no cohort`,
    );
  });

  it("names the target when its cohort is not a number", () => {
    write(["targets:", "  - project_id: broken--target", "    cohort: two"].join("\n"));

    expect(() => read_target_cohorts(register)).toThrow(
      `${register}: target "broken--target" has a non-numeric cohort "two"`,
    );
  });

  it("refuses a register that declares no targets at all", () => {
    write("schema_version: 1\ntargets:\n");

    expect(() => read_target_cohorts(register)).toThrow(`${register}: no targets found`);
  });

  it("parses the repository's own register into two cohorts of twenty", () => {
    const cohorts = read_target_cohorts(target_register_path());
    const counts = new Map<number, number>();
    for (const cohort of cohorts.values()) counts.set(cohort, (counts.get(cohort) ?? 0) + 1);

    expect(counts).toEqual(
      new Map([
        [1, 20],
        [2, 20],
      ]),
    );
    expect(cohorts.get("microsoft--vscode")).toEqual(2);
    expect(cohorts.get("webpack--webpack")).toEqual(1);
  });
});
