/**
 * What one measured arm records, and why each field is on the row rather than
 * in a note beside it.
 *
 * Wall clock on a shared box measures scheduling, not work. Full-corpus runs
 * on an idle box recorded cpu/wall between 0.97 and 1.09; the same hardware
 * under load recorded 0.04 to 0.5 at loadavg 100-273 against 4 CPUs, and a
 * wall figure taken at roughly 5x oversubscription reports 11.23 hours for
 * that same work. A row therefore carries CPU and wall and their ratio and the
 * load average, so a reader can see for themselves whether the wall number
 * means anything.
 *
 * Absolute CPU is machine-bound and does not transfer even between two runs of
 * provably identical computation: one arm producing byte-identical structural
 * output — 7,891 files indexed, 603 dropped, 183,018 nodes, 1,502,343 call
 * references, 26,610 indirect entries — measured 777.6 s, 801.3 s and 1,019.4 s
 * in three sessions. So a row also carries the session it was taken in, the
 * machine, the node version and the resolved grammar versions, and
 * `compare_measurements` refuses any ratio that crosses them.
 *
 * The grammar versions are on the row because the declared version is not the
 * loaded one: two measurement worktrees silently resolved tree-sitter 0.21.1
 * and tree-sitter-typescript 0.21.2 from hoisted copies instead of the 0.25.0
 * and 0.23.2 a normal checkout uses, and the ~40 grammar test failures both
 * runs waved off as environmental were exactly that.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as v8 from "v8";
import tree_sitter_manifest from "tree-sitter/package.json";
import tree_sitter_typescript_manifest from "tree-sitter-typescript/package.json";
import type { CorpusIdentity, FileCounts } from "./corpus_predicate";
import type { IngestOrder } from "./ingest_order";
import type { RecordedFingerprint } from "./call_graph_fingerprint";
import type { DiagnosticsFingerprint } from "./diagnostics_fingerprint";
import { round_to_tenth } from "./round_measurement";

const BYTES_PER_MB = 1024 * 1024;

/** Recorded when the Ariadne checkout is not a git repository. */
export const UNKNOWN_COMMIT = "unknown";

type LoadAverage = readonly [number, number, number];

export interface RunEnvironment {
  /** Operating system, release and architecture, as one comparable string. */
  readonly machine: string;
  readonly hostname: string;
  readonly cpu_count: number;
  readonly total_memory_mb: number;
  readonly node_version: string;
  /** The arm's own process. Four distinct pids is what proves arms were interleaved
   *  across separate processes rather than looped inside one. */
  readonly pid: number;
  /** V8's old-space ceiling for this process, in MB. */
  readonly heap_cap_mb: number;
  readonly tree_sitter_version: string;
  readonly tree_sitter_typescript_version: string;
  readonly ariadne_commit: string;
  /**
   * One measurement session. Every arm an orchestrator spawns shares it, and
   * two rows that do not share it may not be divided into one another.
   */
  readonly session_id: string;
}

/**
 * What pass A's worker dispatch cost this arm.
 *
 * A worker-pool arm is judged on wall, so the terms that decide whether wall
 * fell belong on the row rather than in a note beside it: the width the arm
 * actually ran at, and the main-thread deserialize that lands back on the one
 * thread every result comes through and partially cancels the win. Worker
 * thread time IS counted by `process.cpuUsage()` — measured, a 1,500 ms worker
 * spin counted as 1,492 ms — so `worker_pass_ms` is part of the arm's CPU and
 * not a figure hidden from it.
 */
export interface IndexDispatchRow {
  readonly worker_width: number;
  readonly boot_ms: number;
  readonly worker_pass_ms: number;
  readonly main_deserialize_ms: number;
  /** Files a dying worker handed back, which the pool re-dispatched. */
  readonly redispatched_inputs: number;
  readonly worker_restarts: number;
}

/**
 * One arm: one file set, offered to one process, in one order.
 */
export interface MeasurementRow {
  /** The arm's label, e.g. "control" and "candidate" in an interleaved pair. */
  readonly arm: string;
  /**
   * Position in the interleaved A,B,A,B sequence, 0-based and unique within a
   * session. Without it "interleaved" is an unverifiable claim about an
   * unordered set of files, and within-session thermal drift cannot be read off
   * the rows.
   */
  readonly sequence_index: number;
  readonly corpus: CorpusIdentity;
  readonly file_counts: FileCounts;
  readonly ingest_order: IngestOrder;
  /** The mulberry32 seed, recorded for every order so a row is self-describing. */
  readonly seed: number;
  /**
   * Whether test-file callables were admitted as entry points. Recorded because
   * the fingerprint depends on it and vscode's `src/vs/**\/test/` trees make the
   * difference a corpus-scale one.
   */
  readonly include_tests: boolean;
  readonly cpu_user_ms: number;
  readonly cpu_system_ms: number;
  readonly wall_ms: number;
  /** Total CPU over wall. Near 1.0 on an idle box; far below it under contention. */
  readonly cpu_per_wall: number;
  /**
   * The split between the two phases the arm times, both in CPU. A budget is
   * judged on the total, because the capability is "entry points reported"; the
   * split is recorded so a change that moves cost from one phase to the other is
   * visible. Neither is a wall figure: a per-phase wall number is exactly what
   * the unit rule says is never a measurement.
   */
  readonly load_cpu_ms: number;
  readonly trace_cpu_ms: number;
  readonly loadavg_at_start: LoadAverage;
  readonly loadavg_at_end: LoadAverage;
  /**
   * Highest resident set the sampler saw. Reported through `summarize_peak_rss`
   * over at least two runs, never as a single figure. The sampler cannot observe
   * the synchronous trace phase, so this is a defensible lower bound rather than
   * a true high-water mark.
   */
  readonly peak_rss_mb: number;
  /** Resident set when the arm finished. Named for what it is: RSS does not fall
   *  after collection, so this is not a "settled heap" figure. */
  readonly rss_at_end_mb: number;
  /** V8's used heap after the arm — the figure that is stable run to run where
   *  peak RSS varies by up to 61%. */
  readonly settled_heap_mb: number;
  readonly fingerprint: RecordedFingerprint;
  /**
   * The two-hash digest of the entry-point diagnostics payload. On the row
   * rather than beside it because the payload is part of the reported product
   * — it is what a user reads and what the triage classifiers consume — and
   * an order-dependence in it never moves the call-graph fingerprint.
   */
  readonly diagnostics: DiagnosticsFingerprint;
  readonly index_dispatch: IndexDispatchRow;
  readonly environment: RunEnvironment;
}

/**
 * The grammar versions this process actually loaded.
 *
 * Read from the resolved manifests rather than from `packages/core/package.json`,
 * because a static import resolves through the same node resolution the grammars
 * themselves load through: what is recorded is what ran.
 */
function resolved_grammar_versions(): {
  tree_sitter: string;
  tree_sitter_typescript: string;
} {
  return {
    tree_sitter: tree_sitter_manifest.version,
    tree_sitter_typescript: tree_sitter_typescript_manifest.version,
  };
}

/**
 * The commit of one Ariadne checkout.
 *
 * The checkout is named by the caller rather than derived from this module's
 * own location, because an interleaved pair is two worktrees of one repository
 * and only the orchestrator knows which checkout it spawned each arm from. A
 * self-locating version would report the orchestrator's commit for both arms
 * and make two trees look like one.
 */
export function read_ariadne_commit(ariadne_repo_path: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: ariadne_repo_path,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return UNKNOWN_COMMIT;
  }
}

/**
 * The Ariadne checkout this process is running from, found by walking up to the
 * directory holding `pnpm-workspace.yaml`.
 *
 * This is what an arm records as its `ariadne_repo_path` when no second
 * worktree is named, and what the in-repo corpus is located from. It is
 * deliberately the running process's checkout and never a stand-in for a
 * candidate arm's tree: the candidate names its own.
 */
export function find_ariadne_repo_root(): string {
  let dir = __dirname;
  while (!fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        "Could not locate the Ariadne repository root: no pnpm-workspace.yaml above this file.",
      );
    }
    dir = parent;
  }
  return dir;
}

/**
 * An identifier every arm of one orchestrator invocation shares. Rows that do
 * not share it were taken at different times on possibly different thermal and
 * scheduling conditions, and dividing one into the other is the mistake that
 * turned a 1.570x speedup into a claimed 2.202x.
 */
export function create_session_id(): string {
  // Filesystem-safe: this string also names the run directory, and the colons
  // an ISO timestamp carries are illegal in a path on Windows and awkward in
  // archives. One string, two uses.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${os.hostname()}-${process.pid}-${stamp}`;
}

interface RunEnvironmentInput {
  readonly session_id: string;
  /** The Ariadne checkout this arm measures. */
  readonly ariadne_repo_path: string;
}

export function capture_run_environment(
  input: RunEnvironmentInput,
): RunEnvironment {
  const grammars = resolved_grammar_versions();
  return {
    machine: `${os.type()} ${os.release()} ${os.arch()}`,
    hostname: os.hostname(),
    cpu_count: os.cpus().length,
    total_memory_mb: Math.round(os.totalmem() / BYTES_PER_MB),
    node_version: process.version,
    pid: process.pid,
    heap_cap_mb: Math.round(
      v8.getHeapStatistics().heap_size_limit / BYTES_PER_MB,
    ),
    tree_sitter_version: grammars.tree_sitter,
    tree_sitter_typescript_version: grammars.tree_sitter_typescript,
    ariadne_commit: read_ariadne_commit(input.ariadne_repo_path),
    session_id: input.session_id,
  };
}

export function current_load_average(): LoadAverage {
  const [one, five, fifteen] = os.loadavg();
  return [round_to_tenth(one), round_to_tenth(five), round_to_tenth(fifteen)];
}
