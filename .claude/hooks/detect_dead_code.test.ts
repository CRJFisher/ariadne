import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  filter_unexpected_entrypoints,
  load_whitelist,
  packages_from_changed_files,
  should_advance_scan_base,
  type EntryPoint,
} from "./detect_dead_code.js";

describe("packages_from_changed_files", () => {
  it("includes a package when a src ts file changed", () => {
    expect(
      packages_from_changed_files(["packages/core/src/project/project.ts"]),
    ).toEqual(["core"]);
  });

  it("includes a package when a src test file changed", () => {
    expect(
      packages_from_changed_files(["packages/core/src/project/project.test.ts"]),
    ).toEqual(["core"]);
  });

  it("ignores changes outside src", () => {
    expect(
      packages_from_changed_files([
        "packages/core/README.md",
        "packages/core/package.json",
        "packages/core/tsconfig.json",
        "packages/core/dist/index.js",
      ]),
    ).toEqual([]);
  });

  it("ignores non-ts changes under src", () => {
    expect(
      packages_from_changed_files([
        "packages/core/src/index_single_file/query_code_tree/queries/typescript.scm",
      ]),
    ).toEqual([]);
  });

  it("dedupes multiple src changes in one package", () => {
    expect(
      packages_from_changed_files([
        "packages/core/src/a.ts",
        "packages/core/src/b.ts",
      ]),
    ).toEqual(["core"]);
  });

  it("collects each package with src changes", () => {
    expect(
      packages_from_changed_files([
        "packages/core/src/a.ts",
        "packages/mcp/src/server.ts",
        "packages/types/README.md",
      ]),
    ).toEqual(["core", "mcp"]);
  });
});

describe("should_advance_scan_base", () => {
  it("advances after a clean run that analysed every package", () => {
    expect(
      should_advance_scan_base({ blocked: false, all_analyses_succeeded: true }),
    ).toEqual(true);
  });

  it("holds when the run blocked on findings", () => {
    expect(
      should_advance_scan_base({ blocked: true, all_analyses_succeeded: true }),
    ).toEqual(false);
  });

  it("holds when a package failed to analyse", () => {
    expect(
      should_advance_scan_base({ blocked: false, all_analyses_succeeded: false }),
    ).toEqual(false);
  });
});

describe("filter_unexpected_entrypoints", () => {
  const flagged: EntryPoint[] = [
    {
      name: "start_server",
      kind: "function",
      file_path: "packages/mcp/src/server.ts",
      start_line: 10,
    },
    {
      name: "orphan_helper",
      kind: "function",
      file_path: "packages/mcp/src/tools/helper.ts",
      start_line: 3,
    },
  ];

  it("gates every flagged entry point against an empty whitelist", () => {
    expect(filter_unexpected_entrypoints(flagged, new Set())).toEqual(flagged);
  });

  it("filters out whitelisted names only", () => {
    expect(
      filter_unexpected_entrypoints(flagged, new Set(["start_server"])),
    ).toEqual([
      {
        name: "orphan_helper",
        kind: "function",
        file_path: "packages/mcp/src/tools/helper.ts",
        start_line: 3,
      },
    ]);
  });
});

describe("load_whitelist", () => {
  let project_dir: string;

  beforeEach(async () => {
    project_dir = await fs.mkdtemp(path.join(os.tmpdir(), "detect-dead-code-"));
    await fs.mkdir(path.join(project_dir, ".claude", "known_entrypoints"), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await fs.rm(project_dir, { recursive: true, force: true });
  });

  it("returns null when the whitelist file is absent", async () => {
    expect(await load_whitelist(project_dir, "mcp")).toEqual(null);
  });

  it("returns an empty set when the file holds an empty array", async () => {
    await fs.writeFile(
      path.join(project_dir, ".claude", "known_entrypoints", "mcp.json"),
      "[]",
    );
    expect(await load_whitelist(project_dir, "mcp")).toEqual(new Set());
  });

  it("returns the entry-point names across sources", async () => {
    await fs.writeFile(
      path.join(project_dir, ".claude", "known_entrypoints", "mcp.json"),
      JSON.stringify([
        {
          source: "public-api",
          description: "exported surface",
          entrypoints: [{ name: "start_server" }],
        },
        {
          source: "bin",
          description: "process entrypoints",
          entrypoints: [{ name: "main", file_path: "packages/mcp/src/cli.ts" }],
        },
      ]),
    );
    expect(await load_whitelist(project_dir, "mcp")).toEqual(
      new Set(["start_server", "main"]),
    );
  });

  it("throws on malformed json", async () => {
    await fs.writeFile(
      path.join(project_dir, ".claude", "known_entrypoints", "mcp.json"),
      "{",
    );
    await expect(load_whitelist(project_dir, "mcp")).rejects.toThrow(SyntaxError);
  });
});
