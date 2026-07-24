import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import {
  changed_files_since,
  filter_unexpected_entrypoints,
  load_whitelist,
  packages_from_changed_files,
  read_scan_base,
  write_scan_base,
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

describe("scan scope", () => {
  let repo: string;

  // Run under a git hook — the pre-commit suite — the ambient GIT_DIR and
  // GIT_INDEX_FILE point at the real repository and would redirect every
  // command below away from the temp repo it names via cwd.
  const GIT_ENV_VARS = [
    "GIT_DIR",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
    "GIT_WORK_TREE",
    "GIT_PREFIX",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  ];

  function git_env(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    for (const name of GIT_ENV_VARS) delete env[name];
    return env;
  }

  function git_in(cwd: string, ...args: string[]): string {
    return execFileSync("git", args, { cwd, encoding: "utf8", env: git_env() }).trim();
  }

  function git(...args: string[]): string {
    return git_in(repo, ...args);
  }

  async function commit_source_file(relative_path: string, contents: string): Promise<string> {
    await fs.mkdir(path.join(repo, path.dirname(relative_path)), { recursive: true });
    await fs.writeFile(path.join(repo, relative_path), contents);
    git("add", "-A");
    git("commit", "-m", `add ${relative_path}`);
    return git("rev-parse", "HEAD");
  }

  beforeEach(async () => {
    repo = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "dead-code-scope-")));
    git("init", "-q");
    git("config", "user.email", "hook@test");
    git("config", "user.name", "hook test");
    git("commit", "-q", "--allow-empty", "-m", "root");
  });

  afterEach(async () => {
    await fs.rm(repo, { recursive: true, force: true });
  });

  it("reports a source file that was committed since the scan base", async () => {
    const base = git("rev-parse", "HEAD");
    write_scan_base(repo, base);
    await commit_source_file("packages/core/src/registries/scope.ts", "export const x = 1;\n");

    expect(git("status", "--porcelain")).toEqual("");
    expect(changed_files_since(repo, read_scan_base(repo))).toEqual([
      "packages/core/src/registries/scope.ts",
    ]);
  });

  it("reports nothing committed when the scan base is HEAD", async () => {
    await commit_source_file("packages/core/src/registries/scope.ts", "export const x = 1;\n");
    write_scan_base(repo, git("rev-parse", "HEAD"));

    expect(changed_files_since(repo, read_scan_base(repo))).toEqual([]);
  });

  it("reports uncommitted and untracked files alongside committed ones", async () => {
    const base = git("rev-parse", "HEAD");
    write_scan_base(repo, base);
    await commit_source_file("packages/core/src/committed.ts", "export const a = 1;\n");
    await fs.writeFile(path.join(repo, "packages/core/src/committed.ts"), "export const a = 2;\n");
    await fs.writeFile(path.join(repo, "packages/core/src/untracked.ts"), "export const b = 3;\n");

    expect(changed_files_since(repo, read_scan_base(repo)).sort()).toEqual([
      "packages/core/src/committed.ts",
      "packages/core/src/untracked.ts",
    ]);
  });

  it("puts a package committed since the scan base back in scope", async () => {
    const base = git("rev-parse", "HEAD");
    write_scan_base(repo, base);
    await commit_source_file("packages/core/src/registries/scope.ts", "export const x = 1;\n");

    expect(
      packages_from_changed_files(changed_files_since(repo, read_scan_base(repo))),
    ).toEqual(["core"]);
  });

  it("reads back a scan base recorded in the git directory", () => {
    const head = git("rev-parse", "HEAD");
    write_scan_base(repo, head);

    expect(read_scan_base(repo)).toEqual(head);
  });

  it("treats a scan base that is not an ancestor of HEAD as absent", async () => {
    git("checkout", "-q", "-b", "side");
    const side_head = await commit_source_file("packages/core/src/side.ts", "export const s = 1;\n");
    git("checkout", "-q", "-");
    write_scan_base(repo, side_head);

    expect(read_scan_base(repo)).toEqual(null);
  });

  it("treats a missing scan base as absent", () => {
    expect(read_scan_base(repo)).toEqual(null);
  });

  it("keeps a linked worktree's scan base separate from the main checkout's", async () => {
    const main_head = git("rev-parse", "HEAD");
    write_scan_base(repo, main_head);

    const worktree = path.join(repo, "..", `${path.basename(repo)}-wt`);
    git("worktree", "add", "-q", "-b", "wt", worktree);
    const worktree_head = git_in(worktree, "rev-parse", "HEAD");
    write_scan_base(worktree, worktree_head);

    expect(read_scan_base(worktree)).toEqual(worktree_head);
    expect(read_scan_base(repo)).toEqual(main_head);
    expect(await fs.readFile(path.join(repo, ".git", "ariadne_dead_code_scan_base"), "utf8")).toEqual(
      `${main_head}\n`,
    );

    git("worktree", "remove", "--force", worktree);
  });

  it("reports a source file committed inside a worktree from that worktree", async () => {
    const worktree = path.join(repo, "..", `${path.basename(repo)}-wt2`);
    git("worktree", "add", "-q", "-b", "wt2", worktree);
    const base = git_in(worktree, "rev-parse", "HEAD");
    write_scan_base(worktree, base);

    await fs.mkdir(path.join(worktree, "packages/core/src"), { recursive: true });
    await fs.writeFile(path.join(worktree, "packages/core/src/in_worktree.ts"), "export const w = 1;\n");
    git_in(worktree, "add", "-A");
    git_in(worktree, "commit", "-m", "worktree work");

    expect(
      packages_from_changed_files(changed_files_since(worktree, read_scan_base(worktree))),
    ).toEqual(["core"]);

    git("worktree", "remove", "--force", worktree);
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
