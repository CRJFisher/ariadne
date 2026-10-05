import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { get_project_dir } from "./utils.js";
import { git_env } from "./scan_base.js";

/**
 * A main checkout plus a linked worktree, mirroring the shape a session takes
 * when it works in a worktree while CLAUDE_PROJECT_DIR still names the checkout.
 */
function build_repo_with_worktree(): { main: string; worktree: string } {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "hook-utils-"))
  );
  const main = path.join(root, "main");
  fs.mkdirSync(main);
  // git_env() drops the GIT_DIR and GIT_INDEX_FILE that git exports to the
  // processes it spawns, which would otherwise address the outer repository
  // instead of the one built here. Ambient git config can carry signing and
  // hooks paths that would steer these commands, so the temp repo is made the
  // only authority.
  const env = {
    ...git_env(),
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
  };
  const git = (cmd: string, cwd: string) =>
    execSync(`git ${cmd}`, { cwd, stdio: "ignore", env });
  git("init -q .", main);
  git("config user.email t@t.t", main);
  git("config user.name t", main);
  fs.writeFileSync(path.join(main, "a.txt"), "a\n");
  git("add -A", main);
  git("commit -q -m init", main);

  const worktree = path.join(root, "wt");
  git(`worktree add -q --detach ${worktree}`, main);
  return { main, worktree };
}

describe("get_project_dir", () => {
  let main: string;
  let worktree: string;
  const original = process.env.CLAUDE_PROJECT_DIR;

  beforeAll(() => {
    ({ main, worktree } = build_repo_with_worktree());
  });

  afterAll(() => {
    if (original === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = original;
    if (main) fs.rmSync(path.dirname(main), { recursive: true, force: true });
  });

  it("resolves the worktree the session works in, not the checkout the environment names", () => {
    process.env.CLAUDE_PROJECT_DIR = main;
    expect(get_project_dir({ cwd: worktree })).toEqual(worktree);
  });

  it("resolves a nested directory to its worktree root", () => {
    process.env.CLAUDE_PROJECT_DIR = main;
    const nested = path.join(worktree, "nested", "deeper");
    fs.mkdirSync(nested, { recursive: true });
    expect(get_project_dir({ cwd: nested })).toEqual(worktree);
  });

  it("resolves the checkout when the session works in it", () => {
    process.env.CLAUDE_PROJECT_DIR = main;
    expect(get_project_dir({ cwd: main })).toEqual(main);
  });

  it("falls back to the environment when no payload is given", () => {
    process.env.CLAUDE_PROJECT_DIR = main;
    expect(get_project_dir()).toEqual(main);
    expect(get_project_dir(null)).toEqual(main);
  });

  it("falls back to the environment when the payload carries no usable cwd", () => {
    process.env.CLAUDE_PROJECT_DIR = main;
    expect(get_project_dir({ cwd: "" })).toEqual(main);
    expect(get_project_dir({ cwd: 42 })).toEqual(main);
    expect(get_project_dir({ hook_event_name: "Stop" })).toEqual(main);
  });

  it("falls back to the environment when the payload's cwd is outside a repository", () => {
    process.env.CLAUDE_PROJECT_DIR = main;
    const outside = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "hook-utils-outside-"))
    );
    try {
      expect(get_project_dir({ cwd: outside })).toEqual(main);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});
