/**
 * What a row records, and the two facts it exists to make un-loseable: which
 * grammars produced it, and which checkout it measured.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  capture_run_environment,
  create_session_id,
  current_load_average,
  find_ariadne_repo_root,
  read_ariadne_commit,
  UNKNOWN_COMMIT,
} from "./measurement_row";

const TEMP_DIRS: string[] = [];

function temp_dir(prefix: string): string {
  // realpath because macOS resolves /var to /private/var, and a path that
  // changes shape under the code being tested is not the path under test.
  const created = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), prefix)),
  );
  TEMP_DIRS.push(created);
  return created;
}

afterAll(() => {
  for (const dir of TEMP_DIRS) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("capture_run_environment", () => {
  it("records the grammar versions this process actually loaded", () => {
    // The declared version is not the loaded one: two measurement worktrees
    // silently resolved tree-sitter 0.21.1 and tree-sitter-typescript 0.21.2
    // from hoisted copies, and the ~40 grammar failures both runs called
    // environmental were exactly that. Only a check against the resolved
    // manifests catches it.
    const declared = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "..", "package.json"),
        "utf-8",
      ),
    ) as { dependencies: Record<string, string> };

    const environment = capture_run_environment({
      session_id: "session-a",
      ariadne_repo_path: __dirname,
    });

    expect({
      tree_sitter: environment.tree_sitter_version,
      tree_sitter_typescript: environment.tree_sitter_typescript_version,
    }).toEqual({
      tree_sitter: declared.dependencies["tree-sitter"],
      tree_sitter_typescript: declared.dependencies["tree-sitter-typescript"],
    });
  });

  it("carries the session id it was given and this process's pid", () => {
    const environment = capture_run_environment({
      session_id: "session-xyz",
      ariadne_repo_path: __dirname,
    });
    expect(environment.session_id).toEqual("session-xyz");
    expect(environment.pid).toEqual(process.pid);
    expect(environment.node_version).toEqual(process.version);
  });
});

describe("read_ariadne_commit", () => {
  it("reads the commit of the checkout it is pointed at", () => {
    // Named by the caller rather than derived from this module's location,
    // because an interleaved pair is two worktrees and only the orchestrator
    // knows which checkout each arm ran from.
    const repo = temp_dir("ariadne-commit-");
    execFileSync("git", ["init", "--quiet"], { cwd: repo });
    execFileSync("git", ["config", "user.email", "t@example.com"], { cwd: repo });
    execFileSync("git", ["config", "user.name", "T"], { cwd: repo });
    fs.writeFileSync(path.join(repo, "a.txt"), "a");
    execFileSync("git", ["add", "a.txt"], { cwd: repo });
    execFileSync("git", ["commit", "--quiet", "-m", "first"], { cwd: repo });

    const expected = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repo,
      encoding: "utf-8",
    })
      .trim()
      .slice(0, 7);

    expect(read_ariadne_commit(repo)).toEqual(expected);
  });

  it("records that the commit is unknown outside a repository", () => {
    expect(read_ariadne_commit(temp_dir("ariadne-norepo-"))).toEqual(
      UNKNOWN_COMMIT,
    );
  });
});

describe("find_ariadne_repo_root", () => {
  it("finds the checkout this process runs from, by its workspace manifest", () => {
    const root = find_ariadne_repo_root();
    expect(fs.existsSync(path.join(root, "pnpm-workspace.yaml"))).toEqual(true);
    expect(__dirname.startsWith(root)).toEqual(true);
  });

  it("agrees with the commit read from that same checkout", () => {
    // The two are how an arm names the tree it ran: the path fills
    // `ariadne_repo_path` and the commit is read back out of it.
    const root = find_ariadne_repo_root();
    expect(read_ariadne_commit(root)).not.toEqual(UNKNOWN_COMMIT);
  });
});

describe("create_session_id", () => {
  it("names a directory safely, because the id is also the run directory", () => {
    // An ISO timestamp's colons are illegal in a path on Windows.
    const session_id = create_session_id();
    expect(/[:]/.test(session_id)).toEqual(false);
    expect(session_id.startsWith(`${os.hostname()}-${process.pid}-`)).toEqual(true);
  });

  it("carries the host, the pid and a timestamp, so a row names its session", () => {
    // Rows that do not share a session id may not be divided into one another,
    // so the id has to identify one orchestrator invocation on one machine.
    const suffix = create_session_id().slice(
      `${os.hostname()}-${process.pid}-`.length,
    );
    expect(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(suffix)).toEqual(
      true,
    );
  });
});

describe("current_load_average", () => {
  it("reports the three load averages, each to a tenth", () => {
    const [one, five, fifteen] = current_load_average();
    for (const value of [one, five, fifteen]) {
      expect(value).toEqual(Math.round(value * 10) / 10);
    }
    expect(current_load_average().length).toEqual(3);
  });
});
