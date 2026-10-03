/**
 * Which classes satisfy an interface without declaring that they do.
 *
 * A declared heritage edge is not always there to find. Angular's compiler
 * implements `CompilerFacade` against its own copy of the declaration, so a
 * receiver typed by core's replica has no declared implementer anywhere in the
 * project; vscode's `IEditorContribution` declares `dispose(): void` without
 * extending `IDisposable`. In both shapes the implementation exists and the
 * call can be answered, and only the members say so — which is what this
 * module reads.
 *
 * Structural conformance is a property of members alone, so there is no
 * language leaf here: a Python class satisfying a Protocol, a Rust type whose
 * inherent methods cover a trait, and a TypeScript class satisfying an
 * interface all reach the same test. Each is pinned by an integration case in
 * `project.integration.test.ts` — what varies per language is what the indexer
 * puts in the member closure, not what this module does with it.
 *
 * ## What a conforming class must carry
 *
 * Every mandatory member of the interface's closure, and at least
 * `MINIMUM_CONFORMING_METHODS` of its methods. A member the language lets a
 * conforming type leave out — a TypeScript optional signature
 * (`getBuildInfo?(): string`), a Rust trait method with a default body — is not
 * required, but a method of that kind the class does carry counts toward the
 * floor: the floor measures how many of the interface's method names the class
 * shares with it, which is what identifies an implementation.
 *
 * So vscode's `IEditorContribution` (`dispose(); saveViewState?();
 * restoreViewState?(state)`) is answered by a class carrying all three and by no
 * class carrying `dispose` alone. That refusal is the floor's, not a gap: a
 * contribution declaring only `dispose` shares exactly as much with the interface
 * as every other disposable in the corpus, and in vscode itself the interface has
 * 75 declared implementers and never reaches this module.
 *
 * ## The floor, and the fan-out it bounds
 *
 * Membership is over-approximate by construction: any class carrying the right
 * member names conforms, whether its author meant it to or not. Two measured
 * bounds keep that from fabricating edges. An interface declaring fewer than
 * `MINIMUM_CONFORMING_METHODS` methods identifies nothing and is never matched
 * at all, and neither is one whose members are all optional. One matched by more
 * than `MAXIMUM_CONFORMING_CLASSES` classes is naming a vocabulary the corpus
 * shares rather than an implementation, so its whole answer is refused instead
 * of fanned out.
 *
 * Both are calibrated over three corpora — angular/angular at `5ad8231`
 * (`packages/`), microsoft/TypeScript at `cc5c6e2d3` (`folder:src`, 601 files)
 * and microsoft/vscode at `f3fa55c3` (`src`, 8,494 files, 382 s CPU):
 *
 *     corpus      interfaces  edges  mean  widest  false
 *     angular              8     11   1.4       2      1
 *     TypeScript          13     79   6.1      16      9
 *     vscode              46    182   4.0      24     13
 *
 * 23 of 272 edges are false, 8.5%, and all but one are one shape: a short
 * generic verb set matched onto a type that shares the vocabulary without
 * implementing the concept — `{get, set, clear}` onto TypeScript's `SortedMap`,
 * `{show, hide, update, dispose}` onto twelve vscode widgets. The exception is
 * angular's `AbstractBoundTemplate`, whose five members the member index
 * credits to the class enclosing the object literal that implements it, so the
 * edge names real implementing code under the wrong owner. The 45 edges that
 * exist only because optional members are left out of the requirement are all
 * implementations: TypeScript's `ResolutionCacheHost`, `ReadBuildProgramHost`,
 * `CompilerHostLikeForCache` and `GetPackageJsonEntrypointsHost` onto the
 * project and harness hosts that serve them (41), vscode's `ILocalPtyService`
 * onto `PtyHostService` and `IResolvedTextFileEditorModel` onto
 * `TextFileEditorModel` and its test subclass (3), and angular's
 * `TestingZoneType` onto `ZoneImpl` (1).
 *
 * The floor sits at three methods because two does not hold: measured at a
 * two-method floor with no width bound, the same angular corpus infers 51 edges
 * of which 31 are false — `RDomTokenList` (`{add, remove}`) taking 14 of them
 * and `IInjectorService` (`{get, has}`) 11 — and TypeScript infers 68 with 11
 * false. Raising it further is not the instrument for the residue: the false
 * sets left are three- and four-method ones, and a higher floor drops real
 * three-method hosts (`DocumentPositionMapperHost`, `CacheableExportInfoMapHost`,
 * six edges each) before it drops them.
 *
 * The floor counts carried methods rather than mandatory ones because counting
 * only the mandatory set refuses real implementations: an interface with two
 * mandatory methods and one optional one drops out whole, which over the three
 * corpora loses 25 edges — vscode's `EncodedTokensProvider` onto its six
 * tokenization supports and `ITunnelDiscoveryProvider` onto its six tunnel
 * services among them — and recovers none the carried count does not. Counting
 * properties toward the floor fails the other way: data-shape interfaces enter,
 * and vscode infers 628 edges where the method floor infers 182.
 *
 * The width bound comes from vscode, where `{layout, focus, dispose}` on
 * `IAICustomizationManagementSectionWidget` matched **286** classes — every
 * widget in the corpus. That one interface carried 55% of the 516 edges an
 * unbounded run produced. The bound also refuses `IVisibleEditorPane` (62
 * matches). The widest answer it admits anywhere in the three corpora is 24
 * (`IExtensionFeatureMarkdownAndTableRenderer`), which is therefore also the
 * measured ceiling on what one inferred edge adds to a dispatch's fan-out
 * (TASK-394 AC #3).
 *
 * What the step recovers, over TypeScript `src` against the same tree without
 * it: `polymorphic_no_implementations` 7,790 → 7,738 and resolved call
 * references 80,239 → 80,291 of 107,695 when conformance required every member
 * name, and reading optionality takes it further on the current tree, 7,905 →
 * 7,848 and 80,508 → 80,565 of 107,701.
 */

import type { SymbolId, SymbolName } from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";

/**
 * The narrowest member set that identifies an implementation rather than a
 * vocabulary in common, and the widest answer that is still an answer. Both
 * calibrated by measurement (above).
 */
const MINIMUM_CONFORMING_METHODS = 3;
const MAXIMUM_CONFORMING_CLASSES = 32;

/**
 * Every class whose members cover `interface_id`'s, found without a declared
 * edge.
 *
 * The candidates come from the rarest of the interface's mandatory member
 * names — the types whose own member index holds it, plus everything below
 * them, since a subclass carries what its bases declare — and each is then
 * confirmed against its whole member closure, so coverage a superclass
 * supplies counts. That makes the rarest name the bound on the whole search:
 * angular's `CompilerFacade` (19 members) and `TcbEnvironment` (6) each have
 * one that names a single type, so the cost is that name's fan-out rather than
 * the corpus's size. Where the mandatory methods alone fall short of the floor,
 * a conforming class must carry one of the optional methods, so their carriers
 * together seed the search instead whenever they are fewer — an interface whose
 * one mandatory member is `dispose` is not a search over every disposable.
 *
 * An answer wider than `MAXIMUM_CONFORMING_CLASSES` is refused whole: past that
 * width the member set is a vocabulary rather than a signature, and no subset of
 * the matches is more credible than another.
 */
export function infer_structural_subtypes(
  interface_id: SymbolId,
  definitions: DefinitionRegistry
): SymbolId[] {
  const requirement = conformance_requirement(interface_id, definitions);
  if (requirement === null) {
    return [];
  }

  const candidates = new Set<SymbolId>();
  for (const carrier of seed_carriers(requirement, definitions)) {
    candidates.add(carrier);
    for (const below of definitions.get_subtype_closure(carrier)) {
      candidates.add(below);
    }
  }

  const conforming = [...candidates].filter(
    (candidate) =>
      definitions.get(candidate)?.kind === "class" &&
      covers(requirement, candidate, definitions)
  );
  return conforming.length > MAXIMUM_CONFORMING_CLASSES ? [] : conforming;
}

/**
 * Which of `candidates` cover `interface_id`'s members — the per-candidate half
 * of the test above, with no width bound, because the candidates are a subset of
 * the conforming set rather than the whole of it.
 *
 * This answers "did anything that just arrived conform?" cheaply, for a pass
 * holding some newly-indexed classes and a list of interfaces no class declares.
 * A pass that gets a yes runs the full `infer_structural_subtypes`, so the width
 * bound is applied in one place and to the whole answer.
 */
function conforming_candidates(
  interface_id: SymbolId,
  candidates: readonly SymbolId[],
  definitions: DefinitionRegistry
): SymbolId[] {
  const requirement = conformance_requirement(interface_id, definitions);
  if (requirement === null) {
    return [];
  }
  return candidates.filter(
    (candidate) =>
      definitions.get(candidate)?.kind === "class" &&
      covers(requirement, candidate, definitions)
  );
}

/**
 * Connect every type a resolve pass changed to the interfaces it satisfies
 * without declaring them, and answer with the interfaces that gained an edge.
 *
 * An interface nothing declares against is answered lazily, at the dispatch that
 * needs it. That leaves one gap, and this closes it: a conforming class arriving
 * after the dispatch already failed. Nothing links the two files — the caller
 * names the interface and the class names neither — so the class's arrival has to
 * be what asks the question, and the interfaces answered here rejoin the pass's
 * changed types so every caller dispatching through them is re-answered.
 *
 * What arrives is not always the conforming class itself: coverage is a property
 * of a whole member closure, so a base class arriving completes its subclass's
 * coverage while only the base counts as changed. The candidates are therefore
 * the changed types and everything below them.
 *
 * The work is bounded by the pass, not the project: `pending_interfaces` holds
 * only those a dispatch has already found no declaring class for, and the cheap
 * per-candidate trigger runs before the full discovery. An interface whose
 * declared implementations were found is never among them, so an inferred edge
 * can never shadow a declared one.
 */
export function infer_conformance_to_pending_interfaces(
  changed_types: ReadonlySet<SymbolId>,
  pending_interfaces: Iterable<SymbolId>,
  definitions: DefinitionRegistry
): Set<SymbolId> {
  const inferred = new Set<SymbolId>();
  const candidates = changed_classes(changed_types, definitions);
  if (candidates.length === 0) {
    return inferred;
  }
  for (const interface_id of pending_interfaces) {
    if (conforming_candidates(interface_id, candidates, definitions).length === 0) {
      continue;
    }
    // Something that just arrived conforms, so re-derive the interface's whole
    // conforming set: the width bound is a property of that set, and applying it
    // to one pass's slice of it would let repeated passes past it.
    for (const subtype_id of infer_structural_subtypes(interface_id, definitions)) {
      definitions.infer_subtype(interface_id, subtype_id);
      inferred.add(interface_id);
    }
  }
  return inferred;
}

/** Every class a pass's `changed_types` cover: the changed types and all below them. */
function changed_classes(
  changed_types: ReadonlySet<SymbolId>,
  definitions: DefinitionRegistry
): SymbolId[] {
  const closed_over = new Set<SymbolId>();
  for (const type_id of changed_types) {
    closed_over.add(type_id);
    for (const below of definitions.get_subtype_closure(type_id)) {
      closed_over.add(below);
    }
  }
  return [...closed_over].filter((type_id) => definitions.get(type_id)?.kind === "class");
}

/**
 * The member names a conforming class must carry: every mandatory one, and
 * `optional_methods_needed` of the optional methods — what the mandatory
 * methods leave short of `MINIMUM_CONFORMING_METHODS`.
 */
interface ConformanceRequirement {
  readonly mandatory: readonly SymbolName[];
  readonly optional_methods: readonly SymbolName[];
  readonly optional_methods_needed: number;
}

/**
 * What an interface asks of a conforming class: every mandatory member name,
 * and at least `MINIMUM_CONFORMING_METHODS` of its method names, optional ones
 * counting. Null when the interface cannot identify anything — fewer methods
 * than the floor, or no mandatory member to seed the search from.
 *
 * The closure rather than the declaration, so an interface extending another
 * asks for the inherited signatures too.
 */
function conformance_requirement(
  interface_id: SymbolId,
  definitions: DefinitionRegistry
): ConformanceRequirement | null {
  if (definitions.get(interface_id)?.kind !== "interface") {
    return null;
  }
  const mandatory: SymbolName[] = [];
  const optional_methods: SymbolName[] = [];
  let mandatory_methods = 0;
  for (const [name, member_id] of definitions.get_member_closure(interface_id)) {
    const member = definitions.get(member_id);
    const optional = (member?.kind === "method" || member?.kind === "property") && member.optional;
    if (optional) {
      if (member.kind === "method") {
        optional_methods.push(name);
      }
      continue;
    }
    mandatory.push(name);
    if (member?.kind === "method") {
      mandatory_methods++;
    }
  }
  if (
    mandatory_methods + optional_methods.length < MINIMUM_CONFORMING_METHODS ||
    mandatory.length === 0
  ) {
    return null;
  }
  return {
    mandatory,
    optional_methods,
    optional_methods_needed: Math.max(0, MINIMUM_CONFORMING_METHODS - mandatory_methods),
  };
}

/**
 * The types a conforming class is found at or below: the carriers of the
 * rarest mandatory name, or — when the class must carry an optional method to
 * clear the floor — every optional method's carriers together, whichever is
 * fewer.
 */
function seed_carriers(
  requirement: ConformanceRequirement,
  definitions: DefinitionRegistry
): ReadonlySet<SymbolId> {
  const rarest = requirement.mandatory
    .map((name) => definitions.get_members_by_name(name))
    .reduce((fewest, carriers) => (carriers.size < fewest.size ? carriers : fewest));
  if (requirement.optional_methods_needed === 0) {
    return rarest;
  }
  const optional_carriers = new Set<SymbolId>();
  for (const name of requirement.optional_methods) {
    for (const carrier of definitions.get_members_by_name(name)) {
      optional_carriers.add(carrier);
    }
  }
  return optional_carriers.size < rarest.size ? optional_carriers : rarest;
}

/**
 * Whether `candidate`'s own members and its superclasses' carry every mandatory
 * name and clear the method floor.
 */
function covers(
  requirement: ConformanceRequirement,
  candidate: SymbolId,
  definitions: DefinitionRegistry
): boolean {
  const closure = definitions.get_member_closure(candidate);
  if (!requirement.mandatory.every((name) => closure.has(name))) {
    return false;
  }
  let carried = 0;
  for (const name of requirement.optional_methods) {
    if (closure.has(name)) {
      carried++;
    }
  }
  return carried >= requirement.optional_methods_needed;
}
