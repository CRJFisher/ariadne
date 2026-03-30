import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import {
  is_git_repo,
  query_git_file_state,
  parse_ls_files_output,
  parse_name_list,
} from "./git_change_detection";

/** Run git in a temp dir, clearing inherited git env vars and using ceiling directories. */
function git(cwd: string, args: string): void {
  const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...env } = process.env;
  execSync(`git ${args}`, {
    cwd,
    stdio: "pipe",
    env: {
      ...env,
      GIT_CEILING_DIRECTORIES: path.dirname(cwd),
    },
  });
}

/** Run git commit with --no-verify to skip inherited pre-commit hooks. */
function git_commit(cwd: string, message: string): void {
  git(cwd, `commit --no-verify -m "${message}"`);
}

describe("git_change_detection", () => {
  describe("parse_ls_files_output", () => {
    it("parses standard ls-files -s output", () => {
      const stdout = [
        "100644 abc123def456abc123def456abc123def456abc1 0\tsrc/main.ts",
        "100644 def456abc123def456abc123def456abc123def4 0\tsrc/utils.ts",
      ].join("\n");
      const result = parse_ls_files_output(stdout, "/project");
      expect(result.size).toEqual(2);
      expect(result.get("/project/src/main.ts")).toEqual(
        "abc123def456abc123def456abc123def456abc1",
      );
      expect(result.get("/project/src/utils.ts")).toEqual(
        "def456abc123def456abc123def456abc123def4",
      );
    });

    it("handles empty output", () => {
      expect(parse_ls_files_output("", "/project").size).toEqual(0);
      expect(parse_ls_files_output("\n", "/project").size).toEqual(0);
    });

    it("handles trailing newline", () => {
      const stdout =
        "100644 abc123def456abc123def456abc123def456abc1 0\tfile.ts\n";
      const result = parse_ls_files_output(stdout, "/project");
      expect(result.size).toEqual(1);
    });
  });

  describe("parse_name_list", () => {
    it("parses newline-separated relative paths", () => {
      const stdout = "src/new_file.ts\nlib/other.ts\n";
      const result = parse_name_list(stdout, "/project");
      expect(result.size).toEqual(2);
      expect(result.has("/project/src/new_file.ts")).toBe(true);
      expect(result.has("/project/lib/other.ts")).toBe(true);
    });

    it("handles empty output", () => {
      expect(parse_name_list("", "/project").size).toEqual(0);
    });
  });

  describe("is_git_repo", () => {
    let temp_dir: string;

    beforeEach(async () => {
      temp_dir = await fs.mkdtemp(
        path.join(os.tmpdir(), "ariadne-git-test-"),
      );
    });

    afterEach(async () => {
      await fs.rm(temp_dir, { recursive: true, force: true });
    });

    it("returns true for a git repo", () => {
      git(temp_dir, "init");
      return expect(is_git_repo(temp_dir)).resolves.toBe(true);
    });

    it("returns false for a non-existent directory", async () => {
      const result = await is_git_repo(
        path.join(temp_dir, "does-not-exist"),
      );
      expect(result).toBe(false);
    });
  });

  describe("query_git_file_state", { timeout: 15000 }, () => {
    let temp_dir: string;
    let original_ceiling: string | undefined;

    beforeEach(async () => {
      // Resolve symlinks (macOS /tmp -> /private/tmp) so GIT_CEILING_DIRECTORIES matches git's resolved paths
      temp_dir = await fs.realpath(
        await fs.mkdtemp(path.join(os.tmpdir(), "ariadne-git-state-test-")),
      );
      // Prevent git from finding parent repos when called by production code
      original_ceiling = process.env["GIT_CEILING_DIRECTORIES"];
      process.env["GIT_CEILING_DIRECTORIES"] = path.dirname(temp_dir);
      git(temp_dir, "init");
      git(temp_dir, "config user.email test@test.com");
      git(temp_dir, "config user.name Test");
    });

    afterEach(async () => {
      if (original_ceiling === undefined) {
        delete process.env["GIT_CEILING_DIRECTORIES"];
      } else {
        process.env["GIT_CEILING_DIRECTORIES"] = original_ceiling;
      }
      await fs.rm(temp_dir, { recursive: true, force: true });
    });

    it("returns file state for a repo with committed files", async () => {
      await fs.writeFile(
        path.join(temp_dir, "a.ts"),
        "export function foo() {}",
      );
      await fs.writeFile(
        path.join(temp_dir, "b.ts"),
        "export function bar() {}",
      );
      git(temp_dir, "add -A");
      git_commit(temp_dir, "init");

      const state = await query_git_file_state(temp_dir);
      expect(state).not.toBeNull();
      expect(state?.tree_hash).toMatch(/^[0-9a-f]{40}$/);
      expect(state?.tracked_hashes.size).toEqual(2);
      expect(
        state?.tracked_hashes.has(path.join(temp_dir, "a.ts")),
      ).toBe(true);
      expect(
        state?.tracked_hashes.has(path.join(temp_dir, "b.ts")),
      ).toBe(true);
      expect(state?.dirty_files.size).toEqual(0);
      expect(state?.untracked_files.size).toEqual(0);
    });

    it("detects dirty (modified) files", async () => {
      await fs.writeFile(path.join(temp_dir, "a.ts"), "original");
      git(temp_dir, "add -A");
      git_commit(temp_dir, "init");

      // Modify without staging
      await fs.writeFile(path.join(temp_dir, "a.ts"), "modified");

      const state = await query_git_file_state(temp_dir);
      expect(state?.dirty_files.has(path.join(temp_dir, "a.ts"))).toBe(
        true,
      );
    });

    it("detects untracked files", async () => {
      await fs.writeFile(path.join(temp_dir, "a.ts"), "tracked");
      git(temp_dir, "add -A");
      git_commit(temp_dir, "init");

      // Add untracked file
      await fs.writeFile(path.join(temp_dir, "new.ts"), "untracked");

      const state = await query_git_file_state(temp_dir);
      expect(
        state?.untracked_files.has(path.join(temp_dir, "new.ts")),
      ).toBe(true);
    });

    it("tree_hash changes after a commit", async () => {
      await fs.writeFile(path.join(temp_dir, "a.ts"), "v1");
      git(temp_dir, "add -A");
      git_commit(temp_dir, "v1");
      const state1 = await query_git_file_state(temp_dir);

      await fs.writeFile(path.join(temp_dir, "a.ts"), "v2");
      git(temp_dir, "add -A");
      git_commit(temp_dir, "v2");
      const state2 = await query_git_file_state(temp_dir);

      expect(state1?.tree_hash).not.toEqual(state2?.tree_hash);
    });
  });
});
