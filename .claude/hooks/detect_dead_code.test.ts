import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import {
  changed_files_since,
  filter_unexpected_entrypoints,
  git_env,
  load_whitelist,
  packages_from_changed_files,
  resolve_scan_base,
  should_advance_scan_base,
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

describe("scan scope", () => {
  let repo: string;
  let cleanup_dirs: string[];

  async function make_repo(prefix: string): Promise<string> {
    const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), prefix)));
    git_in(dir, "init", "-q");
    git_in(dir, "config", "user.email", "hook@test");
    git_in(dir, "config", "user.name", "hook test");
    git_in(dir, "commit", "-q", "--allow-empty", "-m", "root");
    return dir;
  }

  function git_in(cwd: string, ...args: string[]): string {
    // Ambient git config can carry signing, hooks paths, and ignore rules that
    // would steer these commands; the temp repo must be the only authority.
    const env = { ...git_env(), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
    return execFileSync("git", ["-c", "commit.gpgsign=false", ...args], {
      cwd,
      encoding: "utf8",
      env,
    }).trim();
  }

  function git(...args: string[]): string {
    return git_in(repo, ...args);
  }

  async function write_source(dir: string, relative_path: string, contents: string): Promise<void> {
    await fs.mkdir(path.join(dir, path.dirname(relative_path)), { recursive: true });
    await fs.writeFile(path.join(dir, relative_path), contents);
  }

  async function commit_source_file(relative_path: string, contents: string): Promise<string> {
    await write_source(repo, relative_path, contents);
    git("add", "-A");
    git("commit", "--no-verify", "-m", `add ${relative_path}`);
    return git("rev-parse", "HEAD");
  }

  async function add_worktree(name: string): Promise<string> {
    const worktree = path.join(repo, "..", `${path.basename(repo)}-${name}`);
    git("worktree", "add", "-q", "-b", name, worktree);
    cleanup_dirs.push(worktree);
    return worktree;
  }

  beforeEach(async () => {
    cleanup_dirs = [];
    repo = await make_repo("dead-code-scope-");
  });

  afterEach(async () => {
    for (const worktree of cleanup_dirs) {
      try {
        git("worktree", "remove", "--force", worktree);
      } catch {
        await fs.rm(worktree, { recursive: true, force: true });
      }
    }
    await fs.rm(repo, { recursive: true, force: true });
  });

  it("reports a source file that was committed since the scan base", async () => {
    write_scan_base(repo, git("rev-parse", "HEAD"));
    await commit_source_file("packages/core/src/registries/scope.ts", "export const x = 1;\n");

    expect(git("status", "--porcelain")).toEqual("");
    expect(changed_files_since(repo, resolve_scan_base(repo))).toEqual([
      "packages/core/src/registries/scope.ts",
    ]);
  });

  it("reports nothing committed when the scan base is HEAD", async () => {
    await commit_source_file("packages/core/src/registries/scope.ts", "export const x = 1;\n");
    write_scan_base(repo, git("rev-parse", "HEAD"));

    expect(changed_files_since(repo, resolve_scan_base(repo))).toEqual([]);
  });

  it("reports a tracked file edited in the working tree", async () => {
    await commit_source_file("packages/core/src/edited.ts", "export const a = 1;\n");
    write_scan_base(repo, git("rev-parse", "HEAD"));
    await write_source(repo, "packages/core/src/edited.ts", "export const a = 2;\n");

    expect(changed_files_since(repo, resolve_scan_base(repo))).toEqual([
      "packages/core/src/edited.ts",
    ]);
  });

  // Nothing cleared means nothing can be assumed clean, so deleting the mark
  // has to produce a real full rescan rather than the narrowest possible one.
  it("reports every tracked file when no scan base is known", async () => {
    await commit_source_file("packages/core/src/committed_long_ago.ts", "export const a = 1;\n");
    await write_source(repo, "packages/core/src/untracked.ts", "export const b = 3;\n");

    expect(changed_files_since(repo, null).sort()).toEqual([
      "packages/core/src/committed_long_ago.ts",
      "packages/core/src/untracked.ts",
    ]);
  });

  it("reports uncommitted and untracked files alongside committed ones", async () => {
    write_scan_base(repo, git("rev-parse", "HEAD"));
    await commit_source_file("packages/core/src/committed.ts", "export const a = 1;\n");
    await write_source(repo, "packages/core/src/committed.ts", "export const a = 2;\n");
    await write_source(repo, "packages/core/src/untracked.ts", "export const b = 3;\n");

    expect(changed_files_since(repo, resolve_scan_base(repo)).sort()).toEqual([
      "packages/core/src/committed.ts",
      "packages/core/src/untracked.ts",
    ]);
  });

  // CLAUDE.md mandates `git mv` for moves, and git reports a rename as the
  // destination alone — which would hide the package that just lost the file.
  it("reports both sides of a file moved between packages", async () => {
    await commit_source_file("packages/core/src/moved.ts", "export const m = 1;\n");
    write_scan_base(repo, git("rev-parse", "HEAD"));
    await fs.mkdir(path.join(repo, "packages/mcp/src"), { recursive: true });
    git("mv", "packages/core/src/moved.ts", "packages/mcp/src/moved.ts");
    git("commit", "--no-verify", "-m", "move");

    expect(
      packages_from_changed_files(changed_files_since(repo, resolve_scan_base(repo))).sort(),
    ).toEqual(["core", "mcp"]);
  });

  it("puts a package committed since the scan base back in scope", async () => {
    write_scan_base(repo, git("rev-parse", "HEAD"));
    await commit_source_file("packages/core/src/registries/scope.ts", "export const x = 1;\n");

    expect(
      packages_from_changed_files(changed_files_since(repo, resolve_scan_base(repo))),
    ).toEqual(["core"]);
  });

  it("reads back a scan base recorded in the git directory", () => {
    const head = git("rev-parse", "HEAD");
    write_scan_base(repo, head);

    expect(resolve_scan_base(repo)).toEqual(head);
  });

  // An abbreviated sha and a ref name both resolve in git, so rejecting them
  // depends on the shape check rather than on git failing.
  it("ignores a scan base file that does not hold a full sha", async () => {
    const head = git("rev-parse", "HEAD");
    const mark = path.join(repo, ".git", "ariadne_dead_code_scan_base");

    await fs.writeFile(mark, `${head.slice(0, 7)}\n`);
    expect(resolve_scan_base(repo)).toEqual(null);

    await fs.writeFile(mark, "HEAD\n");
    expect(resolve_scan_base(repo)).toEqual(null);
  });

  it("treats a missing scan base as absent", () => {
    expect(resolve_scan_base(repo)).toEqual(null);
  });

  // A mark left on a branch HEAD cannot reach must not be silently forgiven:
  // the fork point still covers everything this history has not cleared.
  it("falls back to the fork point when the scan base is not an ancestor of HEAD", async () => {
    const fork_point = git("rev-parse", "HEAD");
    git("checkout", "-q", "-b", "side");
    const side_head = await commit_source_file("packages/core/src/side.ts", "export const s = 1;\n");
    git("checkout", "-q", "-");
    write_scan_base(repo, side_head);

    expect(resolve_scan_base(repo)).toEqual(fork_point);
  });

  it("keeps work on the current branch in scope after a branch switch", async () => {
    const fork_point = git("rev-parse", "HEAD");
    git("checkout", "-q", "-b", "side");
    const side_head = await commit_source_file("packages/core/src/side.ts", "export const s = 1;\n");
    git("checkout", "-q", "-");
    write_scan_base(repo, side_head);
    await commit_source_file("packages/core/src/on_main.ts", "export const m = 1;\n");

    expect(fork_point).not.toEqual(side_head);
    expect(changed_files_since(repo, resolve_scan_base(repo))).toEqual([
      "packages/core/src/on_main.ts",
    ]);
  });

  it("keeps a linked worktree's scan base separate from the main checkout's", async () => {
    const main_head = git("rev-parse", "HEAD");
    write_scan_base(repo, main_head);

    const worktree = await add_worktree("wt");
    await write_source(worktree, "packages/core/src/in_worktree.ts", "export const w = 1;\n");
    git_in(worktree, "add", "-A");
    git_in(worktree, "commit", "--no-verify", "-m", "worktree work");
    const worktree_head = git_in(worktree, "rev-parse", "HEAD");
    write_scan_base(worktree, worktree_head);

    expect(resolve_scan_base(worktree)).toEqual(worktree_head);
    expect(resolve_scan_base(repo)).toEqual(main_head);
  });

  it("reports a source file committed inside a worktree from that worktree", async () => {
    const worktree = await add_worktree("wt2");
    write_scan_base(worktree, git_in(worktree, "rev-parse", "HEAD"));

    await write_source(worktree, "packages/core/src/in_worktree.ts", "export const w = 1;\n");
    git_in(worktree, "add", "-A");
    git_in(worktree, "commit", "--no-verify", "-m", "worktree work");

    expect(
      packages_from_changed_files(changed_files_since(worktree, resolve_scan_base(worktree))),
    ).toEqual(["core"]);
  });

  // A fresh worktree has no mark of its own; without the shared-git-dir
  // fallback its first run would see a clean tree and scan nothing.
  it("scans work committed in a worktree that has no scan base of its own", async () => {
    write_scan_base(repo, git("rev-parse", "HEAD"));
    const worktree = await add_worktree("wt3");

    await write_source(worktree, "packages/core/src/in_worktree.ts", "export const w = 1;\n");
    git_in(worktree, "add", "-A");
    git_in(worktree, "commit", "--no-verify", "-m", "worktree work");

    expect(git_in(worktree, "status", "--porcelain")).toEqual("");
    expect(
      packages_from_changed_files(changed_files_since(worktree, resolve_scan_base(worktree))),
    ).toEqual(["core"]);
  });

  // The exported helpers run in-process, so an ambient GIT_DIR would redirect
  // them at the repository the pre-commit suite is running under.
  it("describes the directory it is given, not an ambient GIT_DIR", async () => {
    const decoy = await make_repo("dead-code-decoy-");
    cleanup_dirs.push(decoy);
    const recorded_base = git("rev-parse", "HEAD");
    write_scan_base(repo, recorded_base);
    await commit_source_file("packages/core/src/registries/scope.ts", "export const x = 1;\n");

    const saved = { dir: process.env.GIT_DIR, index: process.env.GIT_INDEX_FILE };
    process.env.GIT_DIR = path.join(decoy, ".git");
    process.env.GIT_INDEX_FILE = path.join(decoy, ".git", "index");
    try {
      // The mark lives in the repo's git directory, so an unstripped GIT_DIR
      // would read the decoy's (absent) mark and resolve to null.
      expect(resolve_scan_base(repo)).toEqual(recorded_base);
      expect(changed_files_since(repo, resolve_scan_base(repo))).toEqual([
        "packages/core/src/registries/scope.ts",
      ]);
    } finally {
      if (saved.dir === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = saved.dir;
      if (saved.index === undefined) delete process.env.GIT_INDEX_FILE;
      else process.env.GIT_INDEX_FILE = saved.index;
    }
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
