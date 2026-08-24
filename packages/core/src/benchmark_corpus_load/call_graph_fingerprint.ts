/**
 * The seven-number regression fingerprint of a loaded corpus.
 *
 * A call graph is the product this codebase exists to report, so the guard on
 * it is a set of values that together pin every part a reader consumes: which
 * functions exist, which of them call which, how many call sites the resolver
 * could not place, which functions are reported as entry points before
 * classification, which are reachable only indirectly, which files the load
 * could not take in at all, and — the seventh — the evidence recorded for each
 * indirect reachability.
 *
 * The seventh is not decoration. An order-dependence in which read site got
 * recorded as a function's reachability evidence passed a six-value version
 * untouched, because moving the evidence never moves entry-point membership;
 * it took four independent writers collapsed into one position-ordered writer
 * to close, and nothing but this component would have shown it.
 *
 * The dropped-file set belongs here because it grows with the corpus — one
 * file at n=100, three at n=120, eight at n=200 — so a fingerprint compared
 * across two differently-sized slices says nothing without it.
 *
 * Calls are enumerated from the resolution registry rather than from each
 * node's `enclosed_calls`. A call written at module scope has no enclosing
 * function scope, so `call_resolver` never files it under a caller and it
 * reaches no node: measured on the 200-file `src/vs/base` slice, 2,114 of
 * 15,428 calls (13.7%) and 897 of 7,948 unresolved calls (11.3%) are invisible
 * from the nodes alone. Those are exactly the module-level registration calls
 * of the exported-singleton idiom that the recorded order-dependence clustered
 * on, so a fingerprint built from nodes would be blind to the very construct
 * it exists to watch. Such a call is attributed to a synthetic `module:<path>`
 * caller.
 *
 * Every member is relative to the corpus root. Symbol ids embed the absolute
 * file path of the definition, so a fingerprint taken in one checkout would
 * otherwise differ from the same corpus loaded in another purely by where it
 * sits on disk — and `assert_members_are_relative` refuses rather than lets a
 * checkout-dependent number be committed.
 */

import {
  location_key,
  type CallReference,
  type FilePath,
  type IndirectReachability,
  type LocationKey,
  type SymbolId,
} from "@ariadnejs/types";
import { compare_paths } from "./corpus_predicate";
import { digest_members } from "./streaming_digest";

/**
 * The contract version of the seven numbers. Bump when the digest algorithm or
 * its width changes, when any component's member grammar changes, or when the
 * component set changes. A recorded baseline carries it, and a comparison
 * across two versions is refused rather than reported as seven regressions.
 */
export const FINGERPRINT_SCHEMA_VERSION = 2;

const EMPTY_INDIRECT_REACHABILITY: ReadonlyMap<SymbolId, IndirectReachability> =
  new Map();

/** Members named per direction in a comparison before it reports a total instead. */
const MAX_REPORTED_DIFF_MEMBERS = 50;

/** The seven components, in the order every report lists them. */
export const FINGERPRINT_COMPONENT_NAMES = [
  "nodes",
  "call_edges",
  "unresolved_calls",
  "raw_entry_points",
  "indirect_reachability_keys",
  "dropped_files",
  "indirect_reachability_evidence",
] as const;

export type FingerprintComponentName =
  (typeof FINGERPRINT_COMPONENT_NAMES)[number];

/**
 * One component: its members sorted, their count, and their digest.
 *
 * The members are kept alongside the digest so a comparison can name what
 * moved rather than only that something did.
 */
export interface FingerprintComponent {
  readonly count: number;
  readonly hash: string;
  readonly members: readonly string[];
}

export type CallGraphFingerprint = Readonly<
  Record<FingerprintComponentName, FingerprintComponent>
>;

/** A component reduced to what a recorded row or a committed baseline holds. */
export interface RecordedComponent {
  readonly count: number;
  readonly hash: string;
}

/**
 * The fingerprint as a measurement row carries it: counts and digests under a
 * schema version. Members are a run-time diffing aid at corpus scale — two
 * million of them is a run artefact, not a number to quote.
 */
export interface RecordedFingerprint {
  readonly schema_version: number;
  readonly components: Readonly<
    Record<FingerprintComponentName, RecordedComponent>
  >;
}

/**
 * The part of a call graph the fingerprint reads. A `CallGraph` from
 * `trace_call_graph` satisfies it; stating it separately keeps the fingerprint
 * independent of `CallableNode`'s other fields, none of which it consults.
 */
export interface FingerprintableGraph {
  readonly nodes: ReadonlyMap<
    SymbolId,
    { readonly enclosed_calls: readonly CallReference[] }
  >;
  readonly entry_points: readonly SymbolId[];
  readonly indirect_reachability?: ReadonlyMap<SymbolId, IndirectReachability>;
}

/** Where the calls of a file come from. `ResolutionRegistry` satisfies it. */
export interface CallSource {
  get_calls_for_file(file_id: FilePath): readonly CallReference[];
}

export interface FingerprintInput {
  /**
   * The raw graph from `trace_call_graph` — entry points unfiltered by
   * classification, so the fingerprint moves when resolution moves rather than
   * when the known-issues registry is edited.
   */
  readonly call_graph: FingerprintableGraph;
  /** The calls of each indexed file, including the ones no node encloses. */
  readonly resolutions: CallSource;
  /** Every file the load indexed. The domain `get_calls_for_file` is asked over. */
  readonly indexed_files: Iterable<FilePath>;
  /** The files the load read but could not index, from `LoadedProject`. */
  readonly dropped_files: ReadonlySet<FilePath>;
  /** Absolute, resolved path every member is made relative to. */
  readonly corpus_root: string;
}

function normalize_root(corpus_root: string): string {
  const forward = corpus_root.replace(/\\/g, "/");
  return forward.endsWith("/") ? forward : `${forward}/`;
}

/**
 * Strip the corpus root out of every path the value embeds.
 *
 * Symbol ids are `kind:file_path:start:…:name` and location keys are
 * `file_path:start:…`, so the root appears inside the value rather than at its
 * head. Replacing every occurrence covers both without parsing either.
 */
function relativize(value: string, normalized_root: string): string {
  return value.replace(/\\/g, "/").split(normalized_root).join("");
}

function build_component(members: string[]): FingerprintComponent {
  const sorted = [...members].sort(compare_paths);
  return {
    count: sorted.length,
    hash: digest_members(sorted),
    members: sorted,
  };
}

function node_members(call_graph: FingerprintableGraph, root: string): string[] {
  const members: string[] = [];
  for (const symbol_id of call_graph.nodes.keys()) {
    members.push(relativize(symbol_id, root));
  }
  return members;
}

/**
 * Every call the resolver produced a reference for, paired with the caller it
 * belongs to.
 *
 * A call enclosed by a function is attributed to that function; one at module
 * scope is attributed to `module:<relative path>`, because it has a caller in
 * every sense that matters to a reader even though no node holds it.
 */
function attributed_calls(
  input: FingerprintInput,
  root: string,
): { caller: string; call: CallReference }[] {
  const enclosing = new Map<LocationKey, SymbolId>();
  for (const [caller_id, node] of input.call_graph.nodes) {
    for (const call of node.enclosed_calls) {
      enclosing.set(location_key(call.location), caller_id);
    }
  }

  const attributed: { caller: string; call: CallReference }[] = [];
  for (const file of input.indexed_files) {
    for (const call of input.resolutions.get_calls_for_file(file)) {
      const owner = enclosing.get(location_key(call.location));
      const caller =
        owner === undefined
          ? `module:${relativize(file, root)}`
          : relativize(owner, root);
      attributed.push({ caller, call });
    }
  }
  return attributed;
}

/**
 * Distinct caller-to-callee pairs, each carrying how many call sites realise
 * it.
 *
 * One member per pair keeps the component the size AC #2 asks for, and the
 * `#n` suffix keeps the multiplicity that would otherwise be lost: measured on
 * the 200-file slice, 9,066 (call site, target) tuples collapse to 7,469
 * pairs, so a resolver change that double-registers a reference or moves how
 * many sites reach a polymorphic target would pass an unsuffixed component
 * untouched. Nothing else pins resolved-call multiplicity — `unresolved_calls`
 * covers only the sites with no target at all.
 */
function call_edge_members(
  attributed: readonly { caller: string; call: CallReference }[],
  root: string,
): string[] {
  const site_counts = new Map<string, number>();
  for (const { caller, call } of attributed) {
    for (const resolution of call.resolutions) {
      const pair = `${caller}->${relativize(resolution.symbol_id, root)}`;
      site_counts.set(pair, (site_counts.get(pair) ?? 0) + 1);
    }
  }
  return [...site_counts].map(([pair, count]) => `${pair}#${count}`);
}

/**
 * Every call site the resolver produced a reference for and could not place.
 *
 * The number this component reports is the count the epic quotes; the members
 * exist so a comparison can say which call sites gained or lost a target
 * rather than only that the total moved.
 */
function unresolved_call_members(
  attributed: readonly { caller: string; call: CallReference }[],
  root: string,
): string[] {
  const members: string[] = [];
  for (const { caller, call } of attributed) {
    if (call.resolutions.length > 0) continue;
    const site = relativize(location_key(call.location), root);
    members.push(`${caller}|${call.call_type}|${call.name}@${site}`);
  }
  return members;
}

function indirect_reachability_key_members(
  call_graph: FingerprintableGraph,
  root: string,
): string[] {
  const members: string[] = [];
  for (const symbol_id of indirect_reachability(call_graph).keys()) {
    members.push(relativize(symbol_id, root));
  }
  return members;
}

/**
 * The evidence tuple behind each indirect reachability: the function reached,
 * the kind of reason, the collection it was read out of when there is one, and
 * the read site that recorded it.
 */
function indirect_reachability_evidence_members(
  call_graph: FingerprintableGraph,
  root: string,
): string[] {
  const members: string[] = [];
  for (const [symbol_id, entry] of indirect_reachability(call_graph)) {
    const { reason } = entry;
    const collection =
      reason.type === "collection_read"
        ? relativize(reason.collection_id, root)
        : "";
    const read_site = relativize(location_key(reason.read_location), root);
    members.push(
      `${relativize(symbol_id, root)}|${reason.type}|${collection}|${read_site}`,
    );
  }
  return members;
}

function indirect_reachability(
  call_graph: FingerprintableGraph,
): ReadonlyMap<SymbolId, IndirectReachability> {
  return call_graph.indirect_reachability ?? EMPTY_INDIRECT_REACHABILITY;
}

/**
 * Refuse a fingerprint that still embeds an absolute path.
 *
 * A member that kept its absolute path makes the fingerprint a function of
 * where the corpus sits on disk, so a baseline committed from one checkout can
 * never match another's recomputation — and the diff would show every member
 * differing with no clue why. Members are sorted, and `/` sorts below every
 * character a symbol id starts with, so the offender is at index 0.
 */
export function assert_members_are_relative(
  fingerprint: CallGraphFingerprint,
): void {
  for (const name of FINGERPRINT_COMPONENT_NAMES) {
    const first = fingerprint[name].members[0];
    if (first !== undefined && (first.startsWith("/") || /^[A-Za-z]:\//.test(first))) {
      throw new Error(
        `Fingerprint component "${name}" holds an absolute path (${first}). ` +
          "The corpus root did not strip, so this fingerprint describes a location rather than a corpus — resolve the corpus root before loading.",
      );
    }
  }
}

export function fingerprint_call_graph(
  input: FingerprintInput,
): CallGraphFingerprint {
  const root = normalize_root(input.corpus_root);
  const attributed = attributed_calls(input, root);

  const dropped: string[] = [];
  for (const file_path of input.dropped_files) {
    dropped.push(relativize(file_path, root));
  }

  const fingerprint: CallGraphFingerprint = {
    nodes: build_component(node_members(input.call_graph, root)),
    call_edges: build_component(call_edge_members(attributed, root)),
    unresolved_calls: build_component(
      unresolved_call_members(attributed, root),
    ),
    raw_entry_points: build_component(
      input.call_graph.entry_points.map((id) => relativize(id, root)),
    ),
    indirect_reachability_keys: build_component(
      indirect_reachability_key_members(input.call_graph, root),
    ),
    dropped_files: build_component(dropped),
    indirect_reachability_evidence: build_component(
      indirect_reachability_evidence_members(input.call_graph, root),
    ),
  };

  assert_members_are_relative(fingerprint);
  return fingerprint;
}

export function record_fingerprint(
  fingerprint: CallGraphFingerprint,
): RecordedFingerprint {
  const components = {} as Record<FingerprintComponentName, RecordedComponent>;
  for (const name of FINGERPRINT_COMPONENT_NAMES) {
    components[name] = {
      count: fingerprint[name].count,
      hash: fingerprint[name].hash,
    };
  }
  return { schema_version: FINGERPRINT_SCHEMA_VERSION, components };
}

export interface ComponentComparison {
  readonly component: FingerprintComponentName;
  readonly identical: boolean;
  readonly baseline_count: number;
  readonly candidate_count: number;
  readonly baseline_hash: string;
  readonly candidate_hash: string;
  /** Members the baseline holds and the candidate does not, capped. */
  readonly only_baseline: readonly string[];
  /** Members the candidate holds and the baseline does not, capped. */
  readonly only_candidate: readonly string[];
  /** How many the cap dropped, per direction. */
  readonly only_baseline_total: number;
  readonly only_candidate_total: number;
}

export interface FingerprintComparison {
  readonly identical: boolean;
  readonly differing_components: readonly FingerprintComponentName[];
  readonly components: readonly ComponentComparison[];
}

/**
 * Both member lists are sorted, so the difference is a merge-join: it names
 * what moved without holding a second copy of either side.
 */
function diff_sorted(
  baseline: readonly string[],
  candidate: readonly string[],
): { only_baseline: string[]; only_candidate: string[]; baseline_total: number; candidate_total: number } {
  const only_baseline: string[] = [];
  const only_candidate: string[] = [];
  let baseline_total = 0;
  let candidate_total = 0;
  let left = 0;
  let right = 0;

  const take = (into: string[], member: string, total: number): number => {
    if (into.length < MAX_REPORTED_DIFF_MEMBERS) into.push(member);
    return total + 1;
  };

  while (left < baseline.length && right < candidate.length) {
    const order = compare_paths(baseline[left], candidate[right]);
    if (order === 0) {
      left++;
      right++;
    } else if (order < 0) {
      baseline_total = take(only_baseline, baseline[left++], baseline_total);
    } else {
      candidate_total = take(only_candidate, candidate[right++], candidate_total);
    }
  }
  while (left < baseline.length) {
    baseline_total = take(only_baseline, baseline[left++], baseline_total);
  }
  while (right < candidate.length) {
    candidate_total = take(only_candidate, candidate[right++], candidate_total);
  }

  return { only_baseline, only_candidate, baseline_total, candidate_total };
}

function compare_component(
  component: FingerprintComponentName,
  baseline: FingerprintComponent,
  candidate: FingerprintComponent,
): ComponentComparison {
  const identical = baseline.hash === candidate.hash;
  const diff = identical
    ? { only_baseline: [], only_candidate: [], baseline_total: 0, candidate_total: 0 }
    : diff_sorted(baseline.members, candidate.members);

  return {
    component,
    identical,
    baseline_count: baseline.count,
    candidate_count: candidate.count,
    baseline_hash: baseline.hash,
    candidate_hash: candidate.hash,
    only_baseline: diff.only_baseline,
    only_candidate: diff.only_candidate,
    only_baseline_total: diff.baseline_total,
    only_candidate_total: diff.candidate_total,
  };
}

/**
 * Compare two fingerprints component by component, naming the members that
 * moved in each direction.
 *
 * Both sides must come from the same corpus predicate and file count; the
 * caller enforces that through `assert_rows_comparable`, which
 * `diff_ingest_orders` calls before reaching here.
 */
export function compare_fingerprints(
  baseline: CallGraphFingerprint,
  candidate: CallGraphFingerprint,
): FingerprintComparison {
  const components = FINGERPRINT_COMPONENT_NAMES.map((name) =>
    compare_component(name, baseline[name], candidate[name]),
  );
  const differing = components
    .filter((comparison) => !comparison.identical)
    .map((comparison) => comparison.component);

  return {
    identical: differing.length === 0,
    differing_components: differing,
    components,
  };
}

/** Which components moved between two recorded rows, refusing a version skew. */
export function compare_recorded_fingerprints(
  baseline: RecordedFingerprint,
  candidate: RecordedFingerprint,
): readonly FingerprintComponentName[] {
  if (baseline.schema_version !== candidate.schema_version) {
    throw new Error(
      `Refusing to compare fingerprints across schema versions ${baseline.schema_version} and ${candidate.schema_version} — ` +
        "the members behind these digests are not the same kind of thing, so a difference would report as seven regressions.",
    );
  }
  return FINGERPRINT_COMPONENT_NAMES.filter(
    (name) =>
      baseline.components[name].hash !== candidate.components[name].hash,
  );
}
