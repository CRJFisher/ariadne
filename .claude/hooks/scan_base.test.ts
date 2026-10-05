import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import {
  changed_paths_since,
  current_head,
  git_env,
  open_scan_range,
  record_scan_cleared,
} from "./scan_base.js";
import { packages_from_changed_files } from "./detect_dead_code.js";

const HOOK = "probe";

// Every case drives a real git repository: the setup alone spawns four
// processes, and a case exercising worktrees or branch switches spawns a couple
// of dozen more. That costs seconds, not milliseconds, so the default per-test
// deadline does not fit the work and expires on whichever cases happen to run
// while the machine is busy.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

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

  /** Record `dir`'s current HEAD as the cleared point, the way a passing hook does. */
  function mark_cleared(dir: string, hook = HOOK): string {
    const head = current_head(dir);
    if (head === null) throw new Error(`No HEAD in ${dir}`);
    const outcome = record_scan_cleared(dir, hook, { base: null, head });
    if (!outcome.recorded) throw new Error(`Could not record mark: ${outcome.error}`);
    return head;
  }

  function scan_base(dir: string, hook = HOOK): string | null {
    return open_scan_range(dir, hook).base;
  }

  function mark_path(dir: string, hook = HOOK): string {
    return path.join(dir, ".git", "ariadne_scan_base", hook);
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
    repo = await make_repo("scan-base-");
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
    mark_cleared(repo);
    await commit_source_file("packages/core/src/registries/scope.ts", "export const x = 1;\n");

    expect(git("status", "--porcelain")).toEqual("");
    expect(changed_paths_since(repo, scan_base(repo))).toEqual([
      "packages/core/src/registries/scope.ts",
    ]);
  });

  it("reports nothing committed when the scan base is HEAD", async () => {
    await commit_source_file("packages/core/src/registries/scope.ts", "export const x = 1;\n");
    mark_cleared(repo);

    expect(changed_paths_since(repo, scan_base(repo))).toEqual([]);
  });

  it("reports a tracked file edited in the working tree", async () => {
    await commit_source_file("packages/core/src/edited.ts", "export const a = 1;\n");
    mark_cleared(repo);
    await write_source(repo, "packages/core/src/edited.ts", "export const a = 2;\n");

    expect(changed_paths_since(repo, scan_base(repo))).toEqual([
      "packages/core/src/edited.ts",
    ]);
  });

  // Nothing cleared means nothing can be assumed clean, so deleting the mark
  // has to produce a real full rescan rather than the narrowest possible one.
  it("reports every tracked file when no scan base is known", async () => {
    await commit_source_file("packages/core/src/committed_long_ago.ts", "export const a = 1;\n");
    await write_source(repo, "packages/core/src/untracked.ts", "export const b = 3;\n");

    expect(changed_paths_since(repo, null).sort()).toEqual([
      "packages/core/src/committed_long_ago.ts",
      "packages/core/src/untracked.ts",
    ]);
  });

  // A hook that acts per file anchors its first run at HEAD instead, so it
  // never touches files the session did not.
  it("reports only the working tree when an absent base falls back to HEAD", async () => {
    await commit_source_file("packages/core/src/committed_long_ago.ts", "export const a = 1;\n");
    await write_source(repo, "packages/core/src/untracked.ts", "export const b = 3;\n");

    const range = open_scan_range(repo, HOOK);
    expect(range.base).toEqual(null);
    expect(changed_paths_since(repo, range.base ?? range.head)).toEqual([
      "packages/core/src/untracked.ts",
    ]);
  });

  it("reports uncommitted and untracked files alongside committed ones", async () => {
    mark_cleared(repo);
    await commit_source_file("packages/core/src/committed.ts", "export const a = 1;\n");
    await write_source(repo, "packages/core/src/committed.ts", "export const a = 2;\n");
    await write_source(repo, "packages/core/src/untracked.ts", "export const b = 3;\n");

    expect(changed_paths_since(repo, scan_base(repo)).sort()).toEqual([
      "packages/core/src/committed.ts",
      "packages/core/src/untracked.ts",
    ]);
  });

  // CLAUDE.md mandates `git mv` for moves, and git reports a rename as the
  // destination alone — which would hide the package that just lost the file.
  it("reports both sides of a file moved between packages", async () => {
    await commit_source_file("packages/core/src/moved.ts", "export const m = 1;\n");
    mark_cleared(repo);
    await fs.mkdir(path.join(repo, "packages/mcp/src"), { recursive: true });
    git("mv", "packages/core/src/moved.ts", "packages/mcp/src/moved.ts");
    git("commit", "--no-verify", "-m", "move");

    expect(
      packages_from_changed_files(changed_paths_since(repo, scan_base(repo))).sort(),
    ).toEqual(["core", "mcp"]);
  });

  it("puts a package committed since the scan base back in scope", async () => {
    mark_cleared(repo);
    await commit_source_file("packages/core/src/registries/scope.ts", "export const x = 1;\n");

    expect(packages_from_changed_files(changed_paths_since(repo, scan_base(repo)))).toEqual([
      "core",
    ]);
  });

  it("reads back a scan base recorded in the git directory", () => {
    const head = mark_cleared(repo);

    expect(scan_base(repo)).toEqual(head);
  });

  // Each hook clears its own concern, so one hook passing must not clear the
  // range for a hook that failed.
  it("keeps each hook's scan base independent", async () => {
    const first = mark_cleared(repo, "hook_a");
    await commit_source_file("packages/core/src/after_a.ts", "export const a = 1;\n");

    expect(scan_base(repo, "hook_a")).toEqual(first);
    expect(scan_base(repo, "hook_b")).toEqual(null);
    expect(changed_paths_since(repo, scan_base(repo, "hook_a"))).toEqual([
      "packages/core/src/after_a.ts",
    ]);
  });

  // An abbreviated sha and a ref name both resolve in git, so rejecting them
  // depends on the shape check rather than on git failing.
  it("ignores a scan base file that does not hold a full sha", async () => {
    const head = mark_cleared(repo);

    await fs.writeFile(mark_path(repo), `${head.slice(0, 7)}\n`);
    expect(scan_base(repo)).toEqual(null);

    await fs.writeFile(mark_path(repo), "HEAD\n");
    expect(scan_base(repo)).toEqual(null);
  });

  it("treats a missing scan base as absent", () => {
    expect(scan_base(repo)).toEqual(null);
  });

  // A mark left on a branch HEAD cannot reach must not be silently forgiven:
  // the fork point still covers everything this history has not cleared.
  it("falls back to the fork point when the scan base is not an ancestor of HEAD", async () => {
    const fork_point = git("rev-parse", "HEAD");
    git("checkout", "-q", "-b", "side");
    const side_head = await commit_source_file("packages/core/src/side.ts", "export const s = 1;\n");
    git("checkout", "-q", "-");
    record_scan_cleared(repo, HOOK, { base: null, head: side_head });

    expect(scan_base(repo)).toEqual(fork_point);
  });

  it("keeps work on the current branch in scope after a branch switch", async () => {
    const fork_point = git("rev-parse", "HEAD");
    git("checkout", "-q", "-b", "side");
    const side_head = await commit_source_file("packages/core/src/side.ts", "export const s = 1;\n");
    git("checkout", "-q", "-");
    record_scan_cleared(repo, HOOK, { base: null, head: side_head });
    await commit_source_file("packages/core/src/on_main.ts", "export const m = 1;\n");

    expect(fork_point).not.toEqual(side_head);
    expect(changed_paths_since(repo, scan_base(repo))).toEqual([
      "packages/core/src/on_main.ts",
    ]);
  });

  it("keeps a linked worktree's scan base separate from the main checkout's", async () => {
    const main_head = mark_cleared(repo);

    const worktree = await add_worktree("wt");
    await write_source(worktree, "packages/core/src/in_worktree.ts", "export const w = 1;\n");
    git_in(worktree, "add", "-A");
    git_in(worktree, "commit", "--no-verify", "-m", "worktree work");
    const worktree_head = mark_cleared(worktree);

    expect(scan_base(worktree)).toEqual(worktree_head);
    expect(scan_base(repo)).toEqual(main_head);
  });

  it("reports a source file committed inside a worktree from that worktree", async () => {
    const worktree = await add_worktree("wt2");
    mark_cleared(worktree);

    await write_source(worktree, "packages/core/src/in_worktree.ts", "export const w = 1;\n");
    git_in(worktree, "add", "-A");
    git_in(worktree, "commit", "--no-verify", "-m", "worktree work");

    expect(
      packages_from_changed_files(changed_paths_since(worktree, scan_base(worktree))),
    ).toEqual(["core"]);
  });

  // A fresh worktree has no mark of its own; without the shared-git-dir
  // fallback its first run would see a clean tree and scan nothing.
  it("scans work committed in a worktree that has no scan base of its own", async () => {
    mark_cleared(repo);
    const worktree = await add_worktree("wt3");

    await write_source(worktree, "packages/core/src/in_worktree.ts", "export const w = 1;\n");
    git_in(worktree, "add", "-A");
    git_in(worktree, "commit", "--no-verify", "-m", "worktree work");

    expect(git_in(worktree, "status", "--porcelain")).toEqual("");
    expect(
      packages_from_changed_files(changed_paths_since(worktree, scan_base(worktree))),
    ).toEqual(["core"]);
  });

  it("reports no head in a repository with no commits", async () => {
    const empty = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "scan-base-empty-")));
    cleanup_dirs.push(empty);
    git_in(empty, "init", "-q");

    expect(current_head(empty)).toEqual(null);
    expect(open_scan_range(empty, HOOK)).toEqual({ base: null, head: null });
  });

  it("reports a failure rather than throwing when the mark cannot be written", async () => {
    const head = git("rev-parse", "HEAD");
    // A file where the mark directory belongs makes mkdir fail.
    await fs.writeFile(path.join(repo, ".git", "ariadne_scan_base"), "");

    const outcome = record_scan_cleared(repo, HOOK, { base: null, head });

    expect(outcome.recorded).toEqual(false);
    expect(typeof outcome.error).toEqual("string");
  });

  // The helpers run in-process, so an ambient GIT_DIR would redirect them at
  // the repository the pre-commit suite is running under.
  it("describes the directory it is given, not an ambient GIT_DIR", async () => {
    const decoy = await make_repo("scan-base-decoy-");
    cleanup_dirs.push(decoy);
    const recorded_base = mark_cleared(repo);
    await commit_source_file("packages/core/src/registries/scope.ts", "export const x = 1;\n");

    const saved = { dir: process.env.GIT_DIR, index: process.env.GIT_INDEX_FILE };
    process.env.GIT_DIR = path.join(decoy, ".git");
    process.env.GIT_INDEX_FILE = path.join(decoy, ".git", "index");
    try {
      // The mark lives in the repo's git directory, so an unstripped GIT_DIR
      // would read the decoy's (absent) mark and resolve to null.
      expect(scan_base(repo)).toEqual(recorded_base);
      expect(changed_paths_since(repo, scan_base(repo))).toEqual([
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
