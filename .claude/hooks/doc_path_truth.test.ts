import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ARIADNE_FAULT_AREA_FOLDER } from "@ariadnejs/types";
import {
  IGNORE_MARKER,
  build_block_reason,
  collect_fault_area_citations,
  collect_rule_citations,
  extract_cited_paths,
  find_missing_citations,
  should_run,
} from "./doc_path_truth.js";
import type { ChangedFiles } from "./utils.js";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function changed_files(
  all_files: string[],
  has_source_changes = false,
): ChangedFiles {
  return {
    all_files,
    has_source_changes,
    has_no_changes: all_files.length === 0,
    modified_packages: [],
    modified_areas: [],
    changed_ts_files: [],
  };
}

describe("extract_cited_paths", () => {
  it("extracts a packages path from a backtick span", () => {
    expect(
      extract_cited_paths("Factories live in `packages/types/src/symbol.ts`."),
    ).toEqual(["packages/types/src/symbol.ts"]);
  });

  it("extracts a .claude path from a backtick span", () => {
    expect(
      extract_cited_paths("Guarded by `.claude/hooks/registry_write_guard.ts`."),
    ).toEqual([".claude/hooks/registry_write_guard.ts"]);
  });

  it("ignores a path mentioned in prose without backticks", () => {
    expect(
      extract_cited_paths("Factories live in packages/types/src/symbol.ts."),
    ).toEqual([]);
  });

  it("extracts a prefixed path from an untagged fenced tree block", () => {
    const markdown = [
      "```",
      "packages/core/src/",
      "├── packages/core/src/project/project.ts",
      "```",
    ].join("\n");
    expect(extract_cited_paths(markdown)).toEqual([
      "packages/core/src/project/project.ts",
    ]);
  });

  it("extracts a prefixed path from a text-tagged fenced block", () => {
    const markdown = [
      "```text",
      "└── packages/core/src/project/project.ts",
      "```",
    ].join("\n");
    expect(extract_cited_paths(markdown)).toEqual([
      "packages/core/src/project/project.ts",
    ]);
  });

  it("resumes backtick-span extraction after a fence closes", () => {
    const markdown = [
      "```",
      "├── packages/core/src/in_fence.ts",
      "```",
      "Then prose citing `packages/core/src/after_fence.ts`.",
    ].join("\n");
    expect(extract_cited_paths(markdown)).toEqual([
      "packages/core/src/in_fence.ts",
      "packages/core/src/after_fence.ts",
    ]);
  });

  it("applies the ignore marker to a line inside a scannable fence", () => {
    const markdown = [
      "```",
      `├── packages/core/src/gone.ts ${IGNORE_MARKER}`,
      "└── packages/core/src/kept.ts",
      "```",
    ].join("\n");
    expect(extract_cited_paths(markdown)).toEqual(["packages/core/src/kept.ts"]);
  });

  it("ignores tokens inside a language-tagged fence", () => {
    const markdown = [
      "```bash",
      "node packages/core/src/deleted_example.ts",
      "```",
    ].join("\n");
    expect(extract_cited_paths(markdown)).toEqual([]);
  });

  it("ignores bare filenames without a packages or .claude prefix", () => {
    const markdown = ["```", "├── index.ts", "└── name_resolution.ts", "```"].join(
      "\n",
    );
    expect(extract_cited_paths(markdown)).toEqual([]);
  });

  it("ignores placeholder tokens with angle brackets", () => {
    expect(
      extract_cited_paths(
        "See `packages/core/src/classify_entry_points/builtins/check_<group_id>.ts`.",
      ),
    ).toEqual([]);
  });

  it("ignores brace and glob tokens", () => {
    expect(
      extract_cited_paths(
        "Variants are `packages/core/src/{module}.{language}.ts` or `packages/*/src/**/*.ts`.",
      ),
    ).toEqual([]);
  });

  it("ignores every token on a line carrying the ignore marker", () => {
    expect(
      extract_cited_paths(
        `A bad example is \`packages/core/src/gone.ts\` ${IGNORE_MARKER}`,
      ),
    ).toEqual([]);
  });

  it("keeps tokens on lines without the marker when another line carries it", () => {
    const markdown = [
      `Bad: \`packages/core/src/gone.ts\` ${IGNORE_MARKER}`,
      "Good: `packages/types/src/symbol.ts`",
    ].join("\n");
    expect(extract_cited_paths(markdown)).toEqual([
      "packages/types/src/symbol.ts",
    ]);
  });

  it("dedupes a path cited twice", () => {
    expect(
      extract_cited_paths(
        "`packages/types/src/symbol.ts` and again `packages/types/src/symbol.ts`",
      ),
    ).toEqual(["packages/types/src/symbol.ts"]);
  });
});

describe("should_run", () => {
  it("runs when a rule file changed", () => {
    expect(should_run(changed_files([".claude/rules/symbol-system.md"]))).toEqual(
      true,
    );
  });

  it("runs when a package src ts file changed", () => {
    expect(
      should_run(changed_files(["packages/core/src/project/project.ts"])),
    ).toEqual(true);
  });

  it("runs when a package src ts file was deleted", () => {
    expect(
      should_run(
        changed_files(["packages/types/src/ariadne_fault_area.ts"]),
      ),
    ).toEqual(true);
  });

  it("runs when a cited .claude ts file changed", () => {
    expect(
      should_run(changed_files([".claude/hooks/registry_write_guard.ts"])),
    ).toEqual(true);
  });

  it("runs on the git-failure fallback despite an empty file list", () => {
    expect(should_run(changed_files([], true))).toEqual(true);
  });

  it("skips a non-cited source change even when source changes are reported", () => {
    expect(
      should_run(changed_files(["packages/core/tests/fixture_check.ts"], true)),
    ).toEqual(false);
  });

  it("skips when only unrelated files changed", () => {
    expect(
      should_run(
        changed_files([
          "README.md",
          "packages/core/package.json",
          "backlog/tasks/task-1 - X.md",
        ]),
      ),
    ).toEqual(false);
  });
});

describe("collect_rule_citations", () => {
  it("labels each citation with its rule path", () => {
    expect(
      collect_rule_citations([
        {
          rule_path: ".claude/rules/example.md",
          markdown: "`packages/types/src/symbol.ts`",
        },
      ]),
    ).toEqual([
      {
        source: ".claude/rules/example.md",
        cited_path: "packages/types/src/symbol.ts",
      },
    ]);
  });
});

describe("collect_fault_area_citations", () => {
  it("labels each citation with its area key and skips empty values", () => {
    expect(
      collect_fault_area_citations({
        name_resolution: "packages/core/src/resolve_references/name_resolution.ts",
        other: "",
      }),
    ).toEqual([
      {
        source:
          "packages/types/src/ariadne_fault_area.ts (ARIADNE_FAULT_AREA_FOLDER.name_resolution)",
        cited_path: "packages/core/src/resolve_references/name_resolution.ts",
      },
    ]);
  });
});

describe("find_missing_citations", () => {
  it("returns empty when every cited path exists", () => {
    expect(
      find_missing_citations(
        [{ source: "a.md", cited_path: "packages/core/src/x.ts" }],
        () => true,
      ),
    ).toEqual([]);
  });

  it("returns the citations whose path does not exist", () => {
    expect(
      find_missing_citations(
        [
          { source: "a.md", cited_path: "packages/core/src/x.ts" },
          { source: "b.md", cited_path: "packages/core/src/gone.ts" },
        ],
        (p) => p === "packages/core/src/x.ts",
      ),
    ).toEqual([{ source: "b.md", cited_path: "packages/core/src/gone.ts" }]);
  });
});

describe("build_block_reason", () => {
  it("formats one spec message per missing citation plus the marker hint", () => {
    expect(
      build_block_reason([
        { source: "a.md", cited_path: "packages/core/src/gone.ts" },
        {
          source: "ARIADNE_FAULT_AREA_FOLDER.name_resolution",
          cited_path: "packages/core/src/also_gone.ts",
        },
      ]),
    ).toEqual(
      "a.md references packages/core/src/gone.ts which does not exist — update the layout/map or restore the file\n" +
        "ARIADNE_FAULT_AREA_FOLDER.name_resolution references packages/core/src/also_gone.ts which does not exist — update the layout/map or restore the file\n" +
        "A line deliberately citing a counter-example path can be exempted with <!-- doc-path-truth:ignore -->",
    );
  });
});

describe("repo doc truth", () => {
  it("every path cited in the committed rules exists", () => {
    const rules_dir = path.join(REPO_ROOT, ".claude", "rules");
    const rules = fs
      .readdirSync(rules_dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        rule_path: `.claude/rules/${f}`,
        markdown: fs.readFileSync(path.join(rules_dir, f), "utf8"),
      }));
    expect(
      find_missing_citations(collect_rule_citations(rules), (p) =>
        fs.existsSync(path.join(REPO_ROOT, p)),
      ),
    ).toEqual([]);
  });

  it("every fault-area folder exists", () => {
    expect(
      find_missing_citations(
        collect_fault_area_citations(ARIADNE_FAULT_AREA_FOLDER),
        (p) => fs.existsSync(path.join(REPO_ROOT, p)),
      ),
    ).toEqual([]);
  });
});
