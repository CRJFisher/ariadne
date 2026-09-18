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
 * ## What a member name does not say
 *
 * The closure names members; it does not say which of them a conforming type
 * may leave out. A TypeScript optional signature (`saveViewState?(): string`)
 * and a Rust trait method with a default body are members here like any other,
 * so a type covering only the mandatory ones is not matched — vscode's
 * `IEditorContribution`, whose other two members are optional, is answered only
 * by a class declaring all three. The missed edge costs a call graph an edge and
 * leaves its target looking unreachable, which is the failure this module
 * exists to remove, so it is a real bound rather than a conservative choice —
 * but closing it means indexing optionality (no definition carries it today)
 * and re-measuring the floor, since reading it would drop
 * `IEditorContribution`'s required set to one method and put the interface
 * below the floor entirely. TASK-376.23 carries that.
 *
 * ## The floor, and the fan-out it bounds
 *
 * Membership is over-approximate by construction: any class carrying the right
 * member names conforms, whether its author meant it to or not. Two measured
 * bounds keep that from fabricating edges. An interface declaring fewer than
 * `MINIMUM_CONFORMING_METHODS` methods identifies nothing and is never matched
 * at all. One matched by more than `MAXIMUM_CONFORMING_CLASSES` classes is
 * naming a vocabulary the corpus shares rather than an implementation, so its
 * whole answer is refused instead of fanned out.
 *
 * Both are calibrated over three corpora — angular/angular at `5ad8231`
 * (`packages/`), microsoft/TypeScript at `cc5c6e2d3` (`folder:src`, 601 files)
 * and microsoft/vscode at `f3fa55c3` (`src`, 8,494 files, 303.5 s CPU):
 *
 *     corpus      interfaces  edges  mean  widest  false
 *     angular              7     10   1.4       2      1
 *     TypeScript          11     38   3.5       8      9
 *     vscode              43    178   4.1      24     13
 *
 * 23 of 226 edges are false, 10.2%, and all but one are one shape: a short
 * generic verb set matched onto a type that shares the vocabulary without
 * implementing the concept — `{get, set, clear}` onto TypeScript's `SortedMap`,
 * `{show, hide, update, dispose}` onto twelve vscode widgets. The exception is
 * angular's `AbstractBoundTemplate`, whose five members the member index
 * credits to the class enclosing the object literal that implements it, so the
 * edge names real implementing code under the wrong owner.
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
 * The width bound comes from vscode, where `{layout, focus, dispose}` on
 * `IAICustomizationManagementSectionWidget` matched **286** classes — every
 * widget in the corpus. That one interface carried 55% of the 516 edges the
 * unbounded run produced. The widest answer the bound admits anywhere in the
 * three corpora is 24 (`IExtensionFeatureMarkdownAndTableRenderer`), which is
 * therefore also the measured ceiling on what one inferred edge adds to a
 * dispatch's fan-out (TASK-394 AC #3).
 *
 * What the step recovers, over TypeScript `src` against the same tree without
 * it: `polymorphic_no_implementations` 7,790 → 7,738 and resolved call
 * references 80,239 → 80,291 of 107,695.
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
 * The candidates come from the rarest of the interface's member names — the
 * types whose own member index holds it, plus everything below them, since a
 * subclass carries what its bases declare — and each is then confirmed against
 * its whole member closure, so coverage a superclass supplies counts. That
 * makes the rarest name the bound on the whole search: angular's
 * `CompilerFacade` (19 members) and `TcbEnvironment` (6) each have one that
 * names a single type, so the cost is that name's fan-out rather than the
 * corpus's size.
 *
 * An answer wider than `MAXIMUM_CONFORMING_CLASSES` is refused whole: past that
 * width the member set is a vocabulary rather than a signature, and no subset of
 * the matches is more credible than another.
 */
export function infer_structural_subtypes(
  interface_id: SymbolId,
  definitions: DefinitionRegistry
): SymbolId[] {
  const required = required_member_names(interface_id, definitions);
  if (required === null) {
    return [];
  }

  const rarest = required
    .map((name) => definitions.get_members_by_name(name))
    .reduce((fewest, carriers) => (carriers.size < fewest.size ? carriers : fewest));
  const candidates = new Set<SymbolId>();
  for (const carrier of rarest) {
    candidates.add(carrier);
    for (const below of definitions.get_subtype_closure(carrier)) {
      candidates.add(below);
    }
  }

  const conforming = [...candidates].filter(
    (candidate) =>
      definitions.get(candidate)?.kind === "class" &&
      covers(required, candidate, definitions)
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
  const required = required_member_names(interface_id, definitions);
  if (required === null) {
    return [];
  }
  return candidates.filter(
    (candidate) =>
      definitions.get(candidate)?.kind === "class" &&
      covers(required, candidate, definitions)
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
 * The member names a conforming class must carry, or null when the interface's
 * own member set is below the floor and identifies nothing.
 *
 * The closure rather than the declaration, so an interface extending another
 * requires the inherited signatures too.
 */
function required_member_names(
  interface_id: SymbolId,
  definitions: DefinitionRegistry
): SymbolName[] | null {
  if (definitions.get(interface_id)?.kind !== "interface") {
    return null;
  }
  const closure = definitions.get_member_closure(interface_id);
  const methods = [...closure.values()].filter(
    (member_id) => definitions.get(member_id)?.kind === "method"
  );
  if (methods.length < MINIMUM_CONFORMING_METHODS) {
    return null;
  }
  return [...closure.keys()];
}

/** Whether `candidate`'s own members and its superclasses' cover every required name. */
function covers(
  required: readonly SymbolName[],
  candidate: SymbolId,
  definitions: DefinitionRegistry
): boolean {
  const closure = definitions.get_member_closure(candidate);
  return required.every((name) => closure.has(name));
}
