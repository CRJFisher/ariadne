/**
 * The guard is only worth having while it sits above what the arms actually
 * cost and below what the box can back. Both halves are checked against the
 * recorded measurements rather than against a restatement of the formula, so a
 * re-fit that drops under an arm this repository has already measured fails
 * here instead of at the OOM killer.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { heap_holds, heap_mb_for, required_heap_mb } from "./heap_requirement";
import { measure_file_sizes, total_bytes } from "./ingest_order";
import { select_offered_files } from "./nested_slice";
import { RECORDED_HEAP_REQUIREMENT } from "./recorded_heap_requirement";

const ARMS = RECORDED_HEAP_REQUIREMENT.rows;

describe("the heap an arm is given", () => {
  it("sits above the peak resident set of every arm this repository has measured", () => {
    expect(
      ARMS.filter((row) => required_heap_mb(row.offered_bytes) < row.peak_rss_mb),
    ).toEqual([]);
  });

  it("sits above microsoft/TypeScript at 3,623 MB and pandas at 2,183 MB", () => {
    expect([
      required_heap_mb(40414867) >= 3623.2,
      required_heap_mb(23305220) >= 2183.2,
    ]).toEqual([true, true]);
  });

  it("grows with the bytes of source and never shrinks", () => {
    const sizes = [0, 548319, 23305220, 40414867, 155923667];
    const requirements = sizes.map((bytes) => required_heap_mb(bytes));
    expect(requirements).toEqual([320, 381, 2876, 4753, 17421]);
    expect([...requirements].sort((a, b) => a - b)).toEqual(requirements);
  });

  it("gives a small arm the floor rather than a cap below what node starts with", () => {
    expect([heap_mb_for(0), heap_mb_for(548319), heap_mb_for(38464706)]).toEqual([
      2048, 2048, 5674,
    ]);
  });

  it("admits microsoft/TypeScript at a cap well under the 14,288 MB the file-count fit gave it", () => {
    expect(heap_mb_for(40414867)).toEqual(5942);
  });

  it("over-provisions by no more than 2.2x on any arm, which is what a ceiling over bytes costs", () => {
    expect(
      ARMS.map((row) => [
        row.corpus,
        row.predicate,
        Number((required_heap_mb(row.offered_bytes) / row.peak_rss_mb).toFixed(2)),
      ]),
    ).toEqual([
      ["expressjs/express", "repository-root", 1.52],
      ["launchbadge/sqlx", "repository-root", 1.48],
      ["mochajs/mocha", "repository-root", 1.75],
      ["tokio-rs/tokio", "repository-root", 2.01],
      ["pandas-dev/pandas", "repository-root", 1.32],
      ["django/django", "repository-root-excluding:js_tests,scripts,docs", 1.47],
      [
        "rust-lang/rust",
        "repository-root-excluding:tests,src/tools,library/stdarch,library/compiler-builtins,library/coretests",
        2.03,
      ],
      ["angular/angular", "repository-root", 1.02],
      ["microsoft/TypeScript", "repository-root-excluding:baselines", 1.31],
      ["microsoft/vscode", "src", 2.13],
      ["microsoft/vscode", "repository-root", 2.04],
    ]);
  });
});

describe("the parent's sizing and the child's refusal read one function", () => {
  it("never grants a cap its own child refuses, for every recorded file set", () => {
    // V8 reports `heap_size_limit` as the flag plus its own headroom, so the
    // flag the parent passes is the smallest cap the child can see.
    expect(
      ARMS.filter((row) => !heap_holds(row.offered_bytes, heap_mb_for(row.offered_bytes))),
    ).toEqual([]);
  });

  it("refuses under the requirement and admits at it", () => {
    const bytes = 40414867;
    expect([
      heap_holds(bytes, required_heap_mb(bytes) - 1),
      heap_holds(bytes, required_heap_mb(bytes)),
    ]).toEqual([false, true]);
  });
});

describe("the bytes both sides sum", () => {
  let directory: string;
  let files: FilePath[];

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "heap_requirement-"));
    files = [10, 2000, 300000].map((size, index) => {
      const file = path.join(directory, `file_${index}.ts`) as FilePath;
      fs.writeFileSync(file, "x".repeat(size));
      return file;
    });
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("is the byte size of the offered slice, whether the slice is the whole set or a prefix", async () => {
    const whole = total_bytes(await measure_file_sizes(select_offered_files(files, "full")));
    const prefix = total_bytes(await measure_file_sizes(select_offered_files(files, 2)));
    expect([whole, prefix]).toEqual([302010, 2010]);
  });
});
