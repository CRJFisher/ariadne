/**
 * What an arm's peak memory was measured against: the bytes of source it held.
 *
 * `required_heap_mb` is fitted to these rows. Each is one arm that completed,
 * the byte size of the file set it was offered (summed from `fs.stat` over the
 * predicate's discovery walk, the same sum the parent and the child both take),
 * and the peak resident set it reached under the heap cap it was given then.
 *
 * Peak RSS follows bytes far more closely than files: the correlation is 0.96
 * over bytes and 0.70 over file count across these eleven arms. It does not
 * follow bytes exactly. Peak RSS per MiB of source is 55 for vscode's `src/`,
 * 60 for rust, 90 to 98 for django, TypeScript and pandas, and 121 for angular,
 * and the small corpora run 87 to 479 because a fixed cost of a few hundred
 * megabytes dominates them. A line through bytes cannot be tight to all of
 * those, so the fit is a ceiling that binds at angular and is 1.3x to 2.1x
 * above every other arm; fitted on file count the same arms spanned 0.92x to
 * 6.5x, and the repository root of vscode sat under its own guard.
 *
 * The fitted peaks were taken under caps sized for the previous fit, on
 * earlier trees. `rerun` is the ten evidence corpora on the tree that carries
 * the bytes fit, each beside a control arm of that same tree under the cap the
 * file-count fit gave it, so the one thing that differs between the two is the
 * cap. Every fingerprint matches its control byte for byte. Peak RSS moves with
 * the cap by less than the spread between corpora: TypeScript falls 24% (3,246
 * to 2,455 MB) when its cap falls from 14,336 to 5,990 MB and angular 9%, while
 * rust rises 13% when its cap rises from 6,750 to 7,693 MB, so a cap far above
 * the load inflates RSS but does not by itself decide it. Every re-run peak
 * sits below the requirement for its file set.
 *
 */

import type { FingerprintComponentName } from "./call_graph_fingerprint";

export interface RecordedHeapRequirementRow {
  /** Stable corpus name, e.g. "django/django"; vscode rows carry their predicate. */
  readonly corpus: string;
  readonly predicate: string;
  /** Files the predicate's discovery walk offered. */
  readonly offered_files: number;
  /** Bytes of source in those files. */
  readonly offered_bytes: number;
  /** The larger of the arm's processes, under `previous_heap_cap_mb`. */
  readonly peak_rss_mb: number;
  readonly previous_heap_cap_mb: number;
}

/** One arm of one tree, under one cap, with the call graph it reported. */
interface RecordedHeapArm {
  readonly heap_cap_mb: number;
  readonly peak_rss_mb: number;
  /** Each of the seven components as `count/hash`. */
  readonly fingerprint: Readonly<Record<FingerprintComponentName, string>>;
}

export interface RecordedHeapRerunRow extends RecordedHeapArm {
  readonly corpus: string;
  readonly predicate: string;
  readonly offered_files: number;
  readonly offered_bytes: number;
  readonly indexed: number;
  /**
   * The same corpus on the same tree, run with the previous fit's cap as its
   * flag, so V8 reports 48 MB above the cap that fit was recorded at.
   */
  readonly control: RecordedHeapArm;
}

export interface RecordedHeapRequirement {
  readonly machine: string;
  /** The arms the requirement is fitted to. */
  readonly rows: readonly RecordedHeapRequirementRow[];
  /**
   * The ten evidence corpora re-run under the caps the bytes-fitted requirement
   * gives them, each beside a control arm of the same tree under the cap the
   * file-count fit gave it. Every call-graph fingerprint matches its control
   * to the byte, so the cap moves the memory columns and nothing else.
   */
  readonly rerun_ariadne_commit: string;
  readonly rerun: readonly RecordedHeapRerunRow[];
}

export const RECORDED_HEAP_REQUIREMENT: RecordedHeapRequirement = {
  machine: "Darwin 24.6.0 x64",
  rows: [
    {
      corpus: "expressjs/express",
      predicate: "repository-root",
      offered_files: 141,
      offered_bytes: 548319,
      peak_rss_mb: 250.3,
      previous_heap_cap_mb: 2096,
    },
    {
      corpus: "launchbadge/sqlx",
      predicate: "repository-root",
      offered_files: 459,
      offered_bytes: 2638136,
      peak_rss_mb: 412.6,
      previous_heap_cap_mb: 2096,
    },
    {
      corpus: "mochajs/mocha",
      predicate: "repository-root",
      offered_files: 534,
      offered_bytes: 1409926,
      peak_rss_mb: 270.8,
      previous_heap_cap_mb: 2096,
    },
    {
      corpus: "tokio-rs/tokio",
      predicate: "repository-root",
      offered_files: 790,
      offered_bytes: 5612800,
      peak_rss_mb: 465.4,
      previous_heap_cap_mb: 2096,
    },
    {
      corpus: "pandas-dev/pandas",
      predicate: "repository-root",
      offered_files: 1510,
      offered_bytes: 23305220,
      peak_rss_mb: 2183.2,
      previous_heap_cap_mb: 3191,
    },
    {
      corpus: "django/django",
      predicate: "repository-root-excluding:js_tests,scripts,docs",
      offered_files: 3012,
      offered_bytes: 20454925,
      peak_rss_mb: 1749.3,
      previous_heap_cap_mb: 5820,
    },
    {
      corpus: "rust-lang/rust",
      predicate:
        "repository-root-excluding:tests,src/tools,library/stdarch,library/compiler-builtins,library/coretests",
      offered_files: 3516,
      offered_bytes: 52846844,
      peak_rss_mb: 3010.8,
      previous_heap_cap_mb: 6702,
    },
    {
      corpus: "angular/angular",
      predicate: "repository-root",
      offered_files: 6345,
      offered_bytes: 38464706,
      peak_rss_mb: 4447.1,
      previous_heap_cap_mb: 11652,
    },
    {
      corpus: "microsoft/TypeScript",
      predicate: "repository-root-excluding:baselines",
      offered_files: 19783,
      offered_bytes: 40414867,
      peak_rss_mb: 3623.2,
      previous_heap_cap_mb: 14288,
    },
    {
      corpus: "microsoft/vscode",
      predicate: "src",
      offered_files: 8494,
      offered_bytes: 109947285,
      peak_rss_mb: 5803.45,
      previous_heap_cap_mb: 6192,
    },
    {
      corpus: "microsoft/vscode",
      predicate: "repository-root",
      offered_files: 12654,
      offered_bytes: 155923667,
      peak_rss_mb: 8540.05,
      previous_heap_cap_mb: 22693,
    },
  ],

  rerun_ariadne_commit: "13c237d9",
  rerun: [
    {
      corpus: "angular/angular",
      predicate: "repository-root",
      offered_files: 6345,
      offered_bytes: 38464706,
      indexed: 6345,
      heap_cap_mb: 5722,
      peak_rss_mb: 2802.8,
      fingerprint: {
        nodes: "71428/fd444b26588a3f78",
        call_edges: "168723/a0e3a6bd35ac39ed",
        unresolved_calls: "208000/ed340cce92091abd",
        raw_entry_points: "2893/6df56c1a41d11f72",
        indirect_reachability_keys: "12399/10c2cbe044cbe33f",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "12399/4451c0b1440f9e9b",
      },
      control: {
        heap_cap_mb: 11700,
        peak_rss_mb: 3069.6,
        fingerprint: {
          nodes: "71428/fd444b26588a3f78",
          call_edges: "168723/a0e3a6bd35ac39ed",
          unresolved_calls: "208000/ed340cce92091abd",
          raw_entry_points: "2893/6df56c1a41d11f72",
          indirect_reachability_keys: "12399/10c2cbe044cbe33f",
          dropped_files: "0/e3b0c44298fc1c14",
          indirect_reachability_evidence: "12399/4451c0b1440f9e9b",
        },
      },
    },
    {
      corpus: "rust-lang/rust",
      predicate:
        "repository-root-excluding:tests,src/tools,library/stdarch,library/compiler-builtins,library/coretests",
      offered_files: 3516,
      offered_bytes: 52846844,
      indexed: 3516,
      heap_cap_mb: 7693,
      peak_rss_mb: 3294.7,
      fingerprint: {
        nodes: "64979/593869763eefe352",
        call_edges: "97911/d7631ca5aa37b7f5",
        unresolved_calls: "210608/17192f20b4b2e16a",
        raw_entry_points: "19479/bde6671c74122cfe",
        indirect_reachability_keys: "13379/84e5e4af6b3e0c04",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "13379/f2fa80d30e72aa43",
      },
      control: {
        heap_cap_mb: 6750,
        peak_rss_mb: 2919.1,
        fingerprint: {
          nodes: "64979/593869763eefe352",
          call_edges: "97911/d7631ca5aa37b7f5",
          unresolved_calls: "210608/17192f20b4b2e16a",
          raw_entry_points: "19479/bde6671c74122cfe",
          indirect_reachability_keys: "13379/84e5e4af6b3e0c04",
          dropped_files: "0/e3b0c44298fc1c14",
          indirect_reachability_evidence: "13379/f2fa80d30e72aa43",
        },
      },
    },
    {
      corpus: "tokio-rs/tokio",
      predicate: "repository-root",
      offered_files: 790,
      offered_bytes: 5612800,
      indexed: 790,
      heap_cap_mb: 2096,
      peak_rss_mb: 493.8,
      fingerprint: {
        nodes: "8841/92b5c57dedad488a",
        call_edges: "7895/96ed201c5fefda7a",
        unresolved_calls: "25880/a6a1cdaf973f89b5",
        raw_entry_points: "2339/cb31a6035c876213",
        indirect_reachability_keys: "1724/9271f109614b21ad",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "1724/16614fad294b9722",
      },
      control: {
        heap_cap_mb: 2144,
        peak_rss_mb: 485.2,
        fingerprint: {
          nodes: "8841/92b5c57dedad488a",
          call_edges: "7895/96ed201c5fefda7a",
          unresolved_calls: "25880/a6a1cdaf973f89b5",
          raw_entry_points: "2339/cb31a6035c876213",
          indirect_reachability_keys: "1724/9271f109614b21ad",
          dropped_files: "0/e3b0c44298fc1c14",
          indirect_reachability_evidence: "1724/16614fad294b9722",
        },
      },
    },
    {
      corpus: "launchbadge/sqlx",
      predicate: "repository-root",
      offered_files: 459,
      offered_bytes: 2638136,
      indexed: 459,
      heap_cap_mb: 2096,
      peak_rss_mb: 409.5,
      fingerprint: {
        nodes: "4301/ea1b606c7aea194b",
        call_edges: "3699/38bc499795a1a149",
        unresolved_calls: "14479/2add4731a147d03f",
        raw_entry_points: "1461/bed5f4ab69cffaa2",
        indirect_reachability_keys: "835/5b7d6b9d9261c5a1",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "835/126b748b4eeab9e2",
      },
      control: {
        heap_cap_mb: 2144,
        peak_rss_mb: 405.4,
        fingerprint: {
          nodes: "4301/ea1b606c7aea194b",
          call_edges: "3699/38bc499795a1a149",
          unresolved_calls: "14479/2add4731a147d03f",
          raw_entry_points: "1461/bed5f4ab69cffaa2",
          indirect_reachability_keys: "835/5b7d6b9d9261c5a1",
          dropped_files: "0/e3b0c44298fc1c14",
          indirect_reachability_evidence: "835/126b748b4eeab9e2",
        },
      },
    },
    {
      corpus: "microsoft/TypeScript",
      predicate: "repository-root-excluding:baselines",
      offered_files: 19783,
      offered_bytes: 40414867,
      indexed: 19763,
      heap_cap_mb: 5990,
      peak_rss_mb: 2454.7,
      fingerprint: {
        nodes: "50332/4551130978db5ae6",
        call_edges: "75611/7ccc1c6894410ef8",
        unresolved_calls: "59314/193b6e32cf6970d4",
        raw_entry_points: "727/b5e79cbb0cffe8d5",
        indirect_reachability_keys: "19102/511621073dcfffe6",
        dropped_files: "20/35096e8b3b7b6ea5",
        indirect_reachability_evidence: "19102/6379940912517607",
      },
      control: {
        heap_cap_mb: 14336,
        peak_rss_mb: 3245.6,
        fingerprint: {
          nodes: "50332/4551130978db5ae6",
          call_edges: "75611/7ccc1c6894410ef8",
          unresolved_calls: "59314/193b6e32cf6970d4",
          raw_entry_points: "727/b5e79cbb0cffe8d5",
          indirect_reachability_keys: "19102/511621073dcfffe6",
          dropped_files: "20/35096e8b3b7b6ea5",
          indirect_reachability_evidence: "19102/6379940912517607",
        },
      },
    },
    {
      corpus: "django/django",
      predicate: "repository-root-excluding:js_tests,scripts,docs",
      offered_files: 3012,
      offered_bytes: 20454925,
      indexed: 3012,
      heap_cap_mb: 3253,
      peak_rss_mb: 1585.9,
      fingerprint: {
        nodes: "36234/602f1e1bc0733680",
        call_edges: "67057/3724f7ca8b095dcf",
        unresolved_calls: "116923/5739e463a70cb944",
        raw_entry_points: "2279/054b140c2831bae2",
        indirect_reachability_keys: "8464/a87676e9917e9a94",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "8464/8b818b2f1dccbd57",
      },
      control: {
        heap_cap_mb: 5868,
        peak_rss_mb: 1720.7,
        fingerprint: {
          nodes: "36234/602f1e1bc0733680",
          call_edges: "67057/3724f7ca8b095dcf",
          unresolved_calls: "116923/5739e463a70cb944",
          raw_entry_points: "2279/054b140c2831bae2",
          indirect_reachability_keys: "8464/a87676e9917e9a94",
          dropped_files: "0/e3b0c44298fc1c14",
          indirect_reachability_evidence: "8464/8b818b2f1dccbd57",
        },
      },
    },
    {
      corpus: "pandas-dev/pandas",
      predicate: "repository-root",
      offered_files: 1510,
      offered_bytes: 23305220,
      indexed: 1510,
      heap_cap_mb: 3643,
      peak_rss_mb: 1890.2,
      fingerprint: {
        nodes: "33288/e23433051c6f1fa3",
        call_edges: "84166/321270aea6264fb1",
        unresolved_calls: "126423/c5ccf40efa5f6ed2",
        raw_entry_points: "2085/db43ca21a234f957",
        indirect_reachability_keys: "5759/46f7c5a285a33084",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "5759/70e43ab38bbe2f49",
      },
      control: {
        heap_cap_mb: 3239,
        peak_rss_mb: 2112.7,
        fingerprint: {
          nodes: "33288/e23433051c6f1fa3",
          call_edges: "84166/321270aea6264fb1",
          unresolved_calls: "126423/c5ccf40efa5f6ed2",
          raw_entry_points: "2085/db43ca21a234f957",
          indirect_reachability_keys: "5759/46f7c5a285a33084",
          dropped_files: "0/e3b0c44298fc1c14",
          indirect_reachability_evidence: "5759/70e43ab38bbe2f49",
        },
      },
    },
    {
      corpus: "celery/celery",
      predicate: "repository-root",
      offered_files: 418,
      offered_bytes: 3554017,
      indexed: 418,
      heap_cap_mb: 2096,
      peak_rss_mb: 497.7,
      fingerprint: {
        nodes: "7943/b7c17039c89f0c23",
        call_edges: "9549/ce8cbdedac6f9324",
        unresolved_calls: "23733/8291e30f995bff99",
        raw_entry_points: "717/ee71187d7fe64673",
        indirect_reachability_keys: "2608/4873efa4607a2133",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "2608/b202e7cef4cc5603",
      },
      control: {
        heap_cap_mb: 2144,
        peak_rss_mb: 540,
        fingerprint: {
          nodes: "7943/b7c17039c89f0c23",
          call_edges: "9549/ce8cbdedac6f9324",
          unresolved_calls: "23733/8291e30f995bff99",
          raw_entry_points: "717/ee71187d7fe64673",
          indirect_reachability_keys: "2608/4873efa4607a2133",
          dropped_files: "0/e3b0c44298fc1c14",
          indirect_reachability_evidence: "2608/b202e7cef4cc5603",
        },
      },
    },
    {
      corpus: "expressjs/express",
      predicate: "repository-root",
      offered_files: 141,
      offered_bytes: 548319,
      indexed: 141,
      heap_cap_mb: 2096,
      peak_rss_mb: 267,
      fingerprint: {
        nodes: "3132/57bde72f59e983b5",
        call_edges: "5250/918cdc70da32f0ad",
        unresolved_calls: "9107/fc15446bce83f0dd",
        raw_entry_points: "21/b7322c183282a2ee",
        indirect_reachability_keys: "247/4824a26cac4c9464",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "247/d9686cd6f468b0ad",
      },
      control: {
        heap_cap_mb: 2144,
        peak_rss_mb: 248.8,
        fingerprint: {
          nodes: "3132/57bde72f59e983b5",
          call_edges: "5250/918cdc70da32f0ad",
          unresolved_calls: "9107/fc15446bce83f0dd",
          raw_entry_points: "21/b7322c183282a2ee",
          indirect_reachability_keys: "247/4824a26cac4c9464",
          dropped_files: "0/e3b0c44298fc1c14",
          indirect_reachability_evidence: "247/d9686cd6f468b0ad",
        },
      },
    },
    {
      corpus: "mochajs/mocha",
      predicate: "repository-root",
      offered_files: 534,
      offered_bytes: 1409926,
      indexed: 534,
      heap_cap_mb: 2096,
      peak_rss_mb: 290.2,
      fingerprint: {
        nodes: "5565/90b6aceb2fe039c0",
        call_edges: "6938/5f365eda36f4aedc",
        unresolved_calls: "12478/cc6b8b21562aa2cc",
        raw_entry_points: "70/11fee1dc8251e238",
        indirect_reachability_keys: "566/2e714ccba1ec280d",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "566/8af8002a8c8e53e9",
      },
      control: {
        heap_cap_mb: 2144,
        peak_rss_mb: 286.8,
        fingerprint: {
          nodes: "5565/90b6aceb2fe039c0",
          call_edges: "6938/5f365eda36f4aedc",
          unresolved_calls: "12478/cc6b8b21562aa2cc",
          raw_entry_points: "70/11fee1dc8251e238",
          indirect_reachability_keys: "566/2e714ccba1ec280d",
          dropped_files: "0/e3b0c44298fc1c14",
          indirect_reachability_evidence: "566/8af8002a8c8e53e9",
        },
      },
    },
  ],
};
