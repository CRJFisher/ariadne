/**
 * What a file's eviction cost the project, measured when `DefinitionRegistry`
 * gained the reverse indices that made eviction keyed.
 *
 * `remove_file` used to ask every member in the project who owned it, and to
 * visit every parent set in the project to drop one subtype. Both scans are
 * counted here as entries visited inside `remove_file` over a real corpus
 * slice: 83.3M at 200 files, 397.4M at 600 and 1,743,715,817 at 1,200, against
 * zero once `owner_members` and `subtype_parents` existed. The scanning term
 * grows faster than the corpus — 4.8x the entries for 3.0x the files, then
 * 4.4x for 2.0x — while the keyed term is flat per evicted symbol, 10.61 /
 * 10.55 / 10.53, a 0.73% spread across a six-fold change in corpus size.
 *
 * The CPU figures are whole-load arms on the incremental driver: control and
 * candidate interleaved A,B,A,B in separate processes, one session per size,
 * on one machine. They are a record of three sessions and never a value to
 * divide a later session's arm into — identical computation has measured
 * 777.6 s, 801.3 s and 1,019.4 s on one machine, and a cross-session speedup
 * claim was wrong by 40%.
 *
 * The seven fingerprint components and both diagnostics digests are recorded
 * per size because they are what says the two arms describe the same call
 * graph. A speedup between arms that disagree is not a speedup.
 */

interface RecordedArm {
  readonly ariadne_commit: string;
  /** Total CPU seconds per repetition, in interleaved sequence order. */
  readonly cpu_seconds: readonly number[];
  /** The user half of it, recorded separately: system time is I/O, not work. */
  readonly cpu_user_ms: readonly number[];
  /** Near 1.0 on an idle box, far below it under contention. */
  readonly cpu_per_wall: readonly number[];
  /** One-minute load average as each repetition started. */
  readonly loadavg_at_start: readonly number[];
  readonly peak_rss_mb: readonly number[];
}

interface RecordedEvictionSize {
  readonly file_count: number;
  readonly indexed: number;
  readonly dropped: number;
  /** The session both arms of this size ran in. Ratios never leave it. */
  readonly session_id: string;
  readonly control: RecordedArm;
  readonly candidate: RecordedArm;
  /** Control CPU mean over candidate CPU mean, within the session above. */
  readonly speedup: number;
  /** Calls to `DefinitionRegistry.remove_file`, and the symbols they dropped. */
  readonly evictions: number;
  readonly evicted_symbols: number;
  /** Map entries an end-to-end walk visited inside `remove_file`. */
  readonly scanned_entries_before: number;
  readonly scanned_entries_after: number;
  /** Calls to get/set/has/delete on any registry map inside `remove_file`. */
  readonly keyed_operations_after: number;
  readonly keyed_per_evicted_symbol_after: number;
  /** Each of the seven components as `count/hash`, identical in both arms. */
  readonly fingerprint: Readonly<Record<string, string>>;
  /** The entry-point diagnostics payload's pair of digests, also identical. */
  readonly diagnostics_hashes: readonly [string, string];
}

export interface RecordedEvictionIndexCost {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  /** Files the walk found; each size below is a prefix of this set. */
  readonly discovered_files: number;
  readonly machine: string;
  readonly node_version: string;
  readonly sizes: readonly RecordedEvictionSize[];
  readonly note: string;
}

export const RECORDED_EVICTION_INDEX_COST: RecordedEvictionIndexCost = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate: "src",
  discovered_files: 8494,
  machine: "Darwin 24.6.0 x64",
  node_version: "v22.22.1",
  sizes: [
    {
      file_count: 200,
      indexed: 187,
      dropped: 13,
      session_id: "Chucks-iMac.local-81727-2026-08-27T11-42-09-908Z",
      control: {
        ariadne_commit: "50dfbcb8",
        cpu_seconds: [15.53, 15.51],
        cpu_user_ms: [14735.3, 14746.4],
        cpu_per_wall: [1.17, 1.16],
        loadavg_at_start: [3.9, 4],
        peak_rss_mb: [627.7, 602.3],
      },
      candidate: {
        ariadne_commit: "7a7a4f0f",
        cpu_seconds: [14.64, 14.36],
        cpu_user_ms: [13856.1, 13595.3],
        cpu_per_wall: [1.16, 1.18],
        loadavg_at_start: [4.4, 4.4],
        peak_rss_mb: [548.2, 537.3],
      },
      speedup: 1.07,
      evictions: 400,
      evicted_symbols: 24960,
      scanned_entries_before: 83269473,
      scanned_entries_after: 0,
      keyed_operations_after: 264830,
      keyed_per_evicted_symbol_after: 10.61,
      fingerprint: {
        nodes: "4647/ad14f2293f197b20",
        call_edges: "4836/3b9df93fbce5059c",
        unresolved_calls: "8840/a1ebcd53f4dc2af9",
        raw_entry_points: "1552/69759567d4cf1a2a",
        indirect_reachability_keys: "919/cc12e7d54f05663f",
        dropped_files: "13/08ea282f1850d164",
        indirect_reachability_evidence: "919/11d2db87f1d24c09",
      },
      diagnostics_hashes: ["04ced1bb438d89c0", "72ea4e0e038437b1"],
    },
    {
      file_count: 600,
      indexed: 572,
      dropped: 28,
      session_id: "Chucks-iMac.local-83104-2026-08-27T11-43-23-919Z",
      control: {
        ariadne_commit: "50dfbcb8",
        cpu_seconds: [51.43, 49.47],
        cpu_user_ms: [48272.4, 46377.4],
        cpu_per_wall: [1.08, 1.08],
        loadavg_at_start: [4.7, 4.9],
        peak_rss_mb: [1163.2, 1152.2],
      },
      candidate: {
        ariadne_commit: "7a7a4f0f",
        cpu_seconds: [45.04, 44.12],
        cpu_user_ms: [41961, 41086.7],
        cpu_per_wall: [1.09, 1.09],
        loadavg_at_start: [4.9, 3.6],
        peak_rss_mb: [1153.4, 1147],
      },
      speedup: 1.13,
      evictions: 1200,
      evicted_symbols: 60650,
      scanned_entries_before: 397420313,
      scanned_entries_after: 0,
      keyed_operations_after: 640140,
      keyed_per_evicted_symbol_after: 10.55,
      fingerprint: {
        nodes: "13330/d741d2cca22283a9",
        call_edges: "18339/94dfefd410f7d8d9",
        unresolved_calls: "39189/12cd19004fc7c273",
        raw_entry_points: "2113/2102fc926653ac12",
        indirect_reachability_keys: "2148/6124af3d18cbca57",
        dropped_files: "28/f4ea1147f10c28da",
        indirect_reachability_evidence: "2148/d521d68664893677",
      },
      diagnostics_hashes: ["ce7d8c5711e12358", "2fc0677fa089f4c1"],
    },
    {
      file_count: 1200,
      indexed: 1145,
      dropped: 55,
      session_id: "Chucks-iMac.local-86586-2026-08-27T11-46-48-366Z",
      control: {
        ariadne_commit: "50dfbcb8",
        cpu_seconds: [158.6, 153.36],
        cpu_user_ms: [147302.3, 142569.3],
        cpu_per_wall: [1.04, 1.05],
        loadavg_at_start: [2.7, 2.9],
        peak_rss_mb: [1760.3, 1772.5],
      },
      candidate: {
        ariadne_commit: "7a7a4f0f",
        cpu_seconds: [129.06, 125.65],
        cpu_user_ms: [118151.1, 114970.6],
        cpu_per_wall: [1.06, 1.07],
        loadavg_at_start: [3.4, 2.2],
        peak_rss_mb: [1758.4, 1766.3],
      },
      speedup: 1.22,
      evictions: 2400,
      evicted_symbols: 128710,
      scanned_entries_before: 1743715817,
      scanned_entries_after: 0,
      keyed_operations_after: 1355727,
      keyed_per_evicted_symbol_after: 10.53,
      fingerprint: {
        nodes: "26031/199a1740422ba703",
        call_edges: "39071/3e4ff0b64cae6bb7",
        unresolved_calls: "70119/5a7b41a49a30dc73",
        raw_entry_points: "4133/dc9863e24d7d7247",
        indirect_reachability_keys: "3826/127d0ed1b814afc0",
        dropped_files: "55/7f902eb30c055b2e",
        indirect_reachability_evidence: "3826/8df82c66256b242e",
      },
      diagnostics_hashes: ["3af786ee11abad3d", "1c51b74096bbf439"],
    },
  ],
  note:
    "Whole-load arms on the incremental driver, where eviction runs against a registry holding only the files ingested so far. " +
    "The two-phase bulk driver evicts against a fully-populated one and makes the scan 1.87-1.90x worse, so the ratios here are a floor for what that driver would have paid. " +
    "The entry counts come from a counter that wraps every map the registry holds while remove_file is on the stack; a scan is the map's size at the moment an end-to-end iterator is taken, which is exact because both removed loops ran to completion.",
};
