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
 * The seventh is not decoration. An order-dependence in which read site is
 * recorded as a function's reachability evidence never moves entry-point
 * membership, so nothing but this component would show it.
 *
 * The dropped-file set belongs here because it grows with the corpus — one
 * file at n=100, three at n=120, eight at n=200 — so a fingerprint compared
 * across two differently-sized slices says nothing without it.
 *
 * Calls are enumerated from the resolution registry rather than from each
 * node's `enclosed_calls`. A call written at module scope has no enclosing
 * function scope, so `call_resolver` never files it under a caller and it
 * reaches no node. Over the first 200 path-sorted `.ts` files of vscode's
 * `src/vs/base` at f3fa55c3, ingested forward, 1,908 of 15,095 call references
 * had no enclosing node — an eighth of the corpus's calls, invisible to a
 * fingerprint built from nodes alone. Those are the module-level registration
 * calls of the exported-singleton idiom, which is the construct order-dependence
 * shows up in, so a node-built fingerprint would be blind to exactly what it
 * exists to watch. Such a call is attributed to a synthetic `module:<path>`
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
  type SymbolId,
} from "@ariadnejs/types";
import * as path from "path";
import { compare_paths } from "./corpus_predicate";
import { digest_members } from "./streaming_digest";

/**
 * The contract version of the seven numbers. Bump when the digest algorithm or
 * its width changes, when any component's member grammar changes, or when the
 * component set changes. A recorded baseline carries it, and a comparison
 * across two versions is refused rather than reported as seven regressions.
 */
export const FINGERPRINT_SCHEMA_VERSION = 3;

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
interface RecordedComponent {
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

interface FingerprintInput {
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
  if (!path.isAbsolute(corpus_root)) {
    throw new Error(
      `The corpus root must be absolute, got "${corpus_root}". A relative root strips the wrong prefix and leaves machine-specific paths in every member.`,
    );
  }
  const forward = path.resolve(corpus_root).replace(/\\/g, "/");
  return forward.endsWith("/") ? forward : `${forward}/`;
}

function escape_for_regexp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A member is `kind:path:…` or `path:…`, so the corpus root appears at the head
 * of the value or immediately after a `:`. The replacement is anchored there
 * rather than applied everywhere: a root that recurs INSIDE a path would
 * otherwise be deleted mid-string and glue the surrounding segments together,
 * so `<root>/a/<root>/x.ts` and `<root>/ax.ts` would produce the same member.
 */
function build_relativizer(normalized_root: string): (value: string) => string {
  const anchored = new RegExp(`(^|:)${escape_for_regexp(normalized_root)}`, "g");
  const seen = new Map<string, string>();
  return (value: string): string => {
    const held = seen.get(value);
    if (held !== undefined) return held;
    const relative = value.replace(/\\/g, "/").replace(anchored, "$1");
    seen.set(value, relative);
    return relative;
  };
}

/**
 * The characters that separate fields inside a member, and the escape itself.
 *
 * A member built from several fields is only a function of those fields if no
 * field can contain a separator. Symbol ids end in a name taken from source
 * text, and `#` opens a private member name in TypeScript, so an unescaped
 * `caller->target#count` would let `new A().#x` style ids collide with a
 * genuinely different edge. Escaping is applied to every field of a
 * multi-field member; single-field components carry no separator and stay
 * verbatim, which is what makes them readable in a committed baseline.
 */
const FIELD_SEPARATORS = /[\\>#|@]/g;

function escape_field(value: string): string {
  return value.replace(FIELD_SEPARATORS, "\\$&");
}

/**
 * Sort the members and digest them. Takes ownership of the array and sorts it
 * in place: at two million members a defensive copy is a second array of the
 * same size, held at exactly the moment the process is nearest its ceiling.
 */
function build_component(members: string[]): FingerprintComponent {
  members.sort(compare_paths);
  return {
    count: members.length,
    hash: digest_members(members),
    members,
  };
}

function node_members(
  call_graph: FingerprintableGraph,
  relativize: (value: string) => string,
): string[] {
  const members: string[] = [];
  for (const symbol_id of call_graph.nodes.keys()) {
    members.push(relativize(symbol_id));
  }
  return members;
}

/**
 * Which node encloses each call reference.
 *
 * Ownership is keyed by the call REFERENCE, not by its location. Two distinct
 * references can share one location — the resolver emits a synthetic callback
 * invocation at the receiver call's own site — so a location-keyed map is
 * last-writer-wins over node iteration order, and that order is the order files
 * arrived. Measured on the 200-file `src/vs/base` slice, 527 source locations
 * hold more than one reference, 1,068 references in all, so a location-keyed
 * attribution decides every one of them by the walk. A fingerprint built to
 * detect order-dependence must not manufacture any.
 *
 * A reference can still be enclosed by two nodes — a callback's body and the
 * method around it both claim it. The smallest symbol id wins, which is a
 * property of the two definitions rather than of the walk. It resolves to the
 * one whose definition starts earlier in the file, since a symbol id leads with
 * its kind and position.
 */
function build_enclosing_callers(
  call_graph: FingerprintableGraph,
): ReadonlyMap<CallReference, SymbolId> {
  const enclosing = new Map<CallReference, SymbolId>();
  for (const [caller_id, node] of call_graph.nodes) {
    for (const call of node.enclosed_calls) {
      const held = enclosing.get(call);
      if (held === undefined || compare_paths(caller_id, held) < 0) {
        enclosing.set(call, caller_id);
      }
    }
  }
  return enclosing;
}

/**
 * Every call the resolver produced a reference for, paired with the caller it
 * belongs to.
 *
 * A call enclosed by a function is attributed to that function; one at module
 * scope is attributed to `module:<relative path>`, because it has a caller in
 * every sense that matters to a reader even though no node holds it.
 *
 * Yielded rather than collected. At corpus scale this is roughly two million
 * pairs, and holding them all so two components can each read them once puts
 * an array the size of the call universe beside the members those components
 * are building.
 */
function* attributed_calls(
  input: FingerprintInput,
  enclosing: ReadonlyMap<CallReference, SymbolId>,
  relativize: (value: string) => string,
): Generator<{ caller: string; call: CallReference }> {
  for (const file of input.indexed_files) {
    for (const call of input.resolutions.get_calls_for_file(file)) {
      const owner = enclosing.get(call);
      const caller =
        owner === undefined ? `module:${relativize(file)}` : relativize(owner);
      yield { caller, call };
    }
  }
}

/**
 * Distinct caller-to-callee pairs, each carrying how many call sites realise
 * it.
 *
 * One member per pair keeps the component one row per edge rather than one per
 * call site, and the `#n` suffix keeps the multiplicity that would otherwise be
 * lost: over the 200-file `src/vs/base` slice roughly a quarter of the
 * (reference, target) tuples share a pair with another, so a resolver change
 * that double-registers a reference, or that moves how many sites reach a
 * polymorphic target, would pass an unsuffixed component untouched. Nothing
 * else pins resolved-call multiplicity — `unresolved_calls` covers only the
 * sites with no target at all.
 *
 * `n` counts the references the resolver emitted for the pair. That is one per
 * source call site wherever the resolver emits one reference per site.
 */
function call_edge_members(
  attributed: Iterable<{ caller: string; call: CallReference }>,
  relativize: (value: string) => string,
): string[] {
  const site_counts = new Map<string, number>();
  for (const { caller, call } of attributed) {
    for (const resolution of call.resolutions) {
      const pair = `${escape_field(caller)}->${escape_field(relativize(resolution.symbol_id))}`;
      site_counts.set(pair, (site_counts.get(pair) ?? 0) + 1);
    }
  }
  return [...site_counts].map(([pair, count]) => `${pair}#${count}`);
}

/**
 * Every call site the resolver produced a reference for and could not place.
 *
 * The members exist so a comparison can say which call sites gained or lost a
 * target rather than only that the total moved.
 */
function unresolved_call_members(
  attributed: Iterable<{ caller: string; call: CallReference }>,
  relativize: (value: string) => string,
): string[] {
  const members: string[] = [];
  for (const { caller, call } of attributed) {
    if (call.resolutions.length > 0) continue;
    const site = relativize(location_key(call.location));
    members.push(
      `${escape_field(caller)}|${escape_field(call.call_type)}|${escape_field(call.name)}@${escape_field(site)}`,
    );
  }
  return members;
}

function indirect_reachability_key_members(
  call_graph: FingerprintableGraph,
  relativize: (value: string) => string,
): string[] {
  const members: string[] = [];
  for (const symbol_id of indirect_reachability(call_graph).keys()) {
    members.push(relativize(symbol_id));
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
  relativize: (value: string) => string,
): string[] {
  const members: string[] = [];
  for (const [symbol_id, entry] of indirect_reachability(call_graph)) {
    const { reason } = entry;
    const collection =
      reason.type === "collection_read" ? relativize(reason.collection_id) : "";
    const read_site = relativize(location_key(reason.read_location));
    members.push(
      `${escape_field(relativize(symbol_id))}|${escape_field(reason.type)}|${escape_field(collection)}|${escape_field(read_site)}`,
    );
  }
  return members;
}

function indirect_reachability(
  call_graph: FingerprintableGraph,
): ReadonlyMap<SymbolId, IndirectReachability> {
  return call_graph.indirect_reachability ?? EMPTY_INDIRECT_REACHABILITY;
}

/** A path segment that survived relativization: `/` at the head of the value or
 *  straight after a `:`, or a Windows drive letter in either position. */
const ABSOLUTE_SEGMENT = /(^|:)(\/|[A-Za-z]:\/)/;

/**
 * Refuse a fingerprint that still embeds an absolute path.
 *
 * A member that kept its absolute path makes the fingerprint a function of
 * where the corpus sits on disk, so a baseline committed from one checkout can
 * never match another's recomputation — and the diff would show every member
 * differing with no clue why. It happens whenever a symbol is defined outside
 * the corpus root, so it is a real condition rather than a defensive nicety.
 *
 * Every member is scanned. Checking only the first would miss six of the seven
 * components: a symbol id leads with its kind, so `class:` sorts before
 * `variable:` and an absolute path inside the latter never reaches index 0.
 */
export function assert_members_are_relative(
  fingerprint: CallGraphFingerprint,
): void {
  for (const name of FINGERPRINT_COMPONENT_NAMES) {
    for (const member of fingerprint[name].members) {
      if (!ABSOLUTE_SEGMENT.test(member)) continue;
      throw new Error(
        `Fingerprint component "${name}" holds an absolute path (${member}). ` +
          "This member names a location rather than a corpus, so the fingerprint could never be reproduced from another checkout — the symbol is defined outside the corpus root.",
      );
    }
  }
}

export function fingerprint_call_graph(
  input: FingerprintInput,
): CallGraphFingerprint {
  const relativize = build_relativizer(normalize_root(input.corpus_root));
  const enclosing = build_enclosing_callers(input.call_graph);

  const dropped: string[] = [];
  for (const file_path of input.dropped_files) {
    dropped.push(relativize(file_path));
  }

  const fingerprint: CallGraphFingerprint = {
    nodes: build_component(node_members(input.call_graph, relativize)),
    call_edges: build_component(
      call_edge_members(
        attributed_calls(input, enclosing, relativize),
        relativize,
      ),
    ),
    unresolved_calls: build_component(
      unresolved_call_members(
        attributed_calls(input, enclosing, relativize),
        relativize,
      ),
    ),
    raw_entry_points: build_component(
      input.call_graph.entry_points.map((id) => relativize(id)),
    ),
    indirect_reachability_keys: build_component(
      indirect_reachability_key_members(input.call_graph, relativize),
    ),
    dropped_files: build_component(dropped),
    indirect_reachability_evidence: build_component(
      indirect_reachability_evidence_members(input.call_graph, relativize),
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

interface ComponentComparison {
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
 * The multiset difference of two sorted member lists, as a merge-join: it names
 * what moved without holding a second copy of either side.
 *
 * A multiset rather than a set, because members repeat — `unresolved_calls`
 * carries one member per call site and two sites in one caller can be
 * character-identical. Three copies on the left against one on the right report
 * two on the left and none on the right, which is the honest reading: two call
 * sites were lost.
 */
function diff_sorted(
  baseline: readonly string[],
  candidate: readonly string[],
): {
  only_baseline: string[];
  only_candidate: string[];
  baseline_total: number;
  candidate_total: number;
} {
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
      candidate_total = take(
        only_candidate,
        candidate[right++],
        candidate_total,
      );
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
    ? {
        only_baseline: [],
        only_candidate: [],
        baseline_total: 0,
        candidate_total: 0,
      }
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
