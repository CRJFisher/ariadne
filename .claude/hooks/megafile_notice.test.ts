import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  count_significant_lines,
  is_megafile_candidate,
  compute_megafile_notice,
  megafile_context_output,
  MEGAFILE_THRESHOLD,
} from "./megafile_notice.js";

describe("count_significant_lines", () => {
  it("skips blank lines", () => {
    expect(count_significant_lines("const a = 1;\n\n   \nconst b = 2;\n")).toEqual(2);
  });

  it("skips full-line and trailing line comments", () => {
    expect(count_significant_lines("// header\nconst a = 1; // keep\n// footer\n")).toEqual(1);
  });

  it("skips single-line and multi-line block comments", () => {
    const content = [
      "/* one line block */",
      "const a = 1;",
      "/*",
      " * spanning",
      " * comment",
      " */",
      "const b = 2;",
    ].join("\n");
    expect(count_significant_lines(content)).toEqual(2);
  });

  it("counts code preceding a block comment that opens on the same line", () => {
    expect(count_significant_lines("const a = 1; /* trailing\nstill comment */\n")).toEqual(1);
  });

  it("counts code following a block comment that closes on the same line", () => {
    expect(count_significant_lines("/* lead */ const a = 1;\n")).toEqual(1);
  });
});

describe("is_megafile_candidate", () => {
  it("accepts a hand-authored package source file", () => {
    expect(is_megafile_candidate("packages/core/src/project/project.ts")).toEqual(true);
  });

  it("rejects a test file", () => {
    expect(is_megafile_candidate("packages/core/src/project/project.test.ts")).toEqual(false);
  });

  it("rejects a generated classifier builtin", () => {
    expect(
      is_megafile_candidate("packages/core/src/classify_entry_points/builtins/check_foo.ts"),
    ).toEqual(false);
  });

  it("rejects files outside a package src tree", () => {
    expect(is_megafile_candidate("packages/core/README.md")).toEqual(false);
    expect(is_megafile_candidate("scripts/build.ts")).toEqual(false);
  });

  it("rejects non-typescript files under src", () => {
    expect(
      is_megafile_candidate("packages/core/src/index_single_file/queries/typescript.scm"),
    ).toEqual(false);
  });
});

describe("compute_megafile_notice", () => {
  let project_dir: string;

  beforeEach(async () => {
    project_dir = await fs.mkdtemp(path.join(os.tmpdir(), "megafile-notice-"));
    await fs.mkdir(path.join(project_dir, "packages", "core", "src", "big"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(project_dir, { recursive: true, force: true });
  });

  function source_of(lines: number): string {
    return Array.from({ length: lines }, (_, i) => `const value_${i} = ${i};`).join("\n") + "\n";
  }

  it("emits a name-accuracy notice above the threshold", async () => {
    const count = MEGAFILE_THRESHOLD + 1;
    const file_path = path.join(project_dir, "packages", "core", "src", "big", "big.ts");
    await fs.writeFile(file_path, source_of(count));

    expect(compute_megafile_notice(file_path, project_dir)).toEqual(
      `\`packages/core/src/big/big.ts\` is now ${count} significant lines. ` +
        "A file's name must be fully true: check `big.ts` still describes everything the file holds. " +
        "If it now hosts multiple concerns, split it into precisely-named leaves. " +
        "Guidance, not a block.",
    );
  });

  it("stays silent at or below the threshold", async () => {
    const file_path = path.join(project_dir, "packages", "core", "src", "big", "big.ts");
    await fs.writeFile(file_path, source_of(MEGAFILE_THRESHOLD));
    expect(compute_megafile_notice(file_path, project_dir)).toEqual(null);
  });

  it("exempts a large test file", async () => {
    const file_path = path.join(project_dir, "packages", "core", "src", "big", "big.test.ts");
    await fs.writeFile(file_path, source_of(MEGAFILE_THRESHOLD + 100));
    expect(compute_megafile_notice(file_path, project_dir)).toEqual(null);
  });

  it("exempts a large classifier builtin", async () => {
    const builtins = path.join(project_dir, "packages", "core", "src", "classify_entry_points", "builtins");
    await fs.mkdir(builtins, { recursive: true });
    const file_path = path.join(builtins, "check_foo.ts");
    await fs.writeFile(file_path, source_of(MEGAFILE_THRESHOLD + 100));
    expect(compute_megafile_notice(file_path, project_dir)).toEqual(null);
  });

  it("stays silent when the written file is absent", () => {
    const file_path = path.join(project_dir, "packages", "core", "src", "big", "missing.ts");
    expect(compute_megafile_notice(file_path, project_dir)).toEqual(null);
  });
});

describe("megafile_context_output", () => {
  it("wraps the notice as PostToolUse additionalContext with no block decision", () => {
    const output = megafile_context_output("hello");
    expect(output).toEqual({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: "hello",
      },
    });
    expect("decision" in output).toEqual(false);
  });
});
