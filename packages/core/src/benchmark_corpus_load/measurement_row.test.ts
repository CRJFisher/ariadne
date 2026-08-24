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
  cite_row,
  format_citation,
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
    // The only check that would have caught the incident AC #7 exists for: two
    // measurement worktrees silently resolved tree-sitter 0.21.1 and
    // tree-sitter-typescript 0.21.2 from hoisted copies, and the ~40 grammar
    // failures both runs called environmental were exactly that.
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

describe("format_citation", () => {
  const citation = {
    corpus_name: "microsoft/vscode",
    corpus_commit: "f3fa55c3",
    predicate: "src",
    offered_file_count: 8494,
    discovered_file_count: 8494,
    ariadne_commit: "12458246",
    machine: "Darwin 21.6.0 x64",
    node_version: "v22.23.2",
  };

  it("names all six things a quoted number must carry", () => {
    expect(format_citation(citation)).toEqual(
      "microsoft/vscode@f3fa55c3 · src · 8494 files · ariadne@12458246 · Darwin 21.6.0 x64 · node v22.23.2",
    );
  });

  it("says a sliced arm is a slice, so a prefix is never read as the corpus", () => {
    expect(
      format_citation({
        ...citation,
        predicate: "folder-ts:src/vs/base",
        offered_file_count: 200,
        discovered_file_count: 479,
      }),
    ).toEqual(
      "microsoft/vscode@f3fa55c3 · folder-ts:src/vs/base · 200 of 479 files · ariadne@12458246 · Darwin 21.6.0 x64 · node v22.23.2",
    );
  });

  it("derives the citation from the row rather than from a second source", () => {
    const environment = capture_run_environment({
      session_id: "s",
      ariadne_repo_path: __dirname,
    });
    const cited = cite_row({
      arm: "a",
      sequence_index: 0,
      corpus: {
        corpus_name: "microsoft/vscode",
        corpus_root: "/corpora/vscode",
        corpus_commit: "f3fa55c3",
        predicate: "src",
      },
      file_counts: { discovered: 8494, offered: 200, indexed: 191, dropped: 9 },
      ingest_order: "forward",
      seed: 1,
      include_tests: false,
      cpu_user_ms: 1,
      cpu_system_ms: 1,
      wall_ms: 1,
      cpu_per_wall: 1,
      load_cpu_ms: 1,
      trace_cpu_ms: 1,
      loadavg_at_start: [0, 0, 0],
      loadavg_at_end: [0, 0, 0],
      peak_rss_mb: 1,
      rss_at_end_mb: 1,
      settled_heap_mb: 1,
      fingerprint: { schema_version: 2, components: {} as never },
      environment,
    });
    expect(cited.offered_file_count).toEqual(200);
    expect(cited.discovered_file_count).toEqual(8494);
    expect(cited.node_version).toEqual(process.version);
  });
});
