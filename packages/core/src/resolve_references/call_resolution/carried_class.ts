/**
 * The class a call site carries into a callable's parameter.
 *
 * A class handed to a factory (`build(MyForm)`) is the only evidence that says
 * what `cls` holds inside `def build(cls, **kw): return cls(**kw)`. That
 * evidence lives in the callers' files while the construction that needs it
 * lives in the callee's, so it is gathered here as calls resolve and read back
 * when the callee's own file resolves.
 *
 * One class or none. A parameter every call site hands the same class is that
 * class; a parameter reached from two different classes is not one type, and
 * answering with either would manufacture an edge where a missing one stood, so
 * it answers nothing. A call site passing something that is not a class says
 * nothing about the parameter and neither adds to the answer nor withdraws it.
 */

import type { FilePath, FunctionCallReference, SymbolId } from "@ariadnejs/types";
import type { ReceiverResolutionContext } from "./receiver_resolution";
import { resolve_read_value } from "./value_source";

/** One call site handing one class to the parameter at `position`. */
export interface ClassArgumentSite {
  readonly file_id: FilePath;
  readonly position: number;
  readonly class_id: SymbolId;
}

/** Callee → every call site that hands it a class, across the project. */
export type ClassArgumentsByCallee = ReadonlyMap<SymbolId, readonly ClassArgumentSite[]>;

/** The mutable form a single resolve pass gathers into. */
export type GatheredClassArguments = Map<SymbolId, ClassArgumentSite[]>;

export function record_class_argument(
  gathered: GatheredClassArguments,
  callee_id: SymbolId,
  site: ClassArgumentSite
): void {
  const sites = gathered.get(callee_id);
  if (sites) {
    sites.push(site);
  } else {
    gathered.set(callee_id, [site]);
  }
}

/**
 * The class every call site agrees `callee_id`'s parameter at `position` holds,
 * or null where the sites name no class or more than one.
 */
export function carried_class(
  index: ClassArgumentsByCallee,
  callee_id: SymbolId,
  position: number
): SymbolId | null {
  let agreed: SymbolId | null = null;
  for (const site of index.get(callee_id) ?? []) {
    if (site.position !== position) {
      continue;
    }
    if (agreed !== null && agreed !== site.class_id) {
      return null;
    }
    agreed = site.class_id;
  }
  return agreed;
}

/**
 * `held` with everything `resolved_files` contributed replaced by what the pass
 * answered for them, sharing `held` outright when neither side moves.
 *
 * A pass answers for every file it resolved, so what those files recorded
 * before is replaced rather than merged: a call site that no longer passes a
 * class leaves the index.
 */
export function replace_files_in_class_arguments(
  held: ClassArgumentsByCallee,
  answered: ClassArgumentsByCallee,
  resolved_files: ReadonlySet<FilePath>
): ClassArgumentsByCallee {
  const replaces = holds_any_file(held, resolved_files);
  if (!replaces && answered.size === 0) {
    return held;
  }
  const merged = replaces
    ? without_files_in_class_arguments(held, resolved_files)
    : new Map<SymbolId, readonly ClassArgumentSite[]>(held);
  for (const [callee_id, sites] of answered) {
    const kept = merged.get(callee_id);
    merged.set(callee_id, kept ? [...kept, ...sites] : sites);
  }
  return merged;
}

/** `index` with every site `file_ids` contributed dropped, and every callee left with none. */
export function without_files_in_class_arguments(
  index: ClassArgumentsByCallee,
  file_ids: ReadonlySet<FilePath>
): Map<SymbolId, readonly ClassArgumentSite[]> {
  const result = new Map<SymbolId, readonly ClassArgumentSite[]>();
  for (const [callee_id, sites] of index) {
    const kept = sites.filter((site) => !file_ids.has(site.file_id));
    if (kept.length === sites.length) {
      result.set(callee_id, sites);
    } else if (kept.length > 0) {
      result.set(callee_id, kept);
    }
  }
  return result;
}

export function holds_any_file(
  index: ClassArgumentsByCallee,
  file_ids: ReadonlySet<FilePath>
): boolean {
  for (const sites of index.values()) {
    if (sites.some((site) => file_ids.has(site.file_id))) {
      return true;
    }
  }
  return false;
}

/**
 * The callees whose carried classes differ between two states — the callables
 * whose bodies must be answered again, since a parameter's type is what their
 * constructions read. Compared by the set of (position, class) pairs rather
 * than by site, so a caller moving a line changes nothing.
 */
export function callees_with_changed_carriers(
  before: ClassArgumentsByCallee,
  after: ClassArgumentsByCallee
): Set<SymbolId> {
  const changed = new Set<SymbolId>();
  for (const callee_id of new Set([...before.keys(), ...after.keys()])) {
    if (carried_signature(before, callee_id) !== carried_signature(after, callee_id)) {
      changed.add(callee_id);
    }
  }
  return changed;
}

function carried_signature(index: ClassArgumentsByCallee, callee_id: SymbolId): string {
  const pairs = new Set(
    (index.get(callee_id) ?? []).map((site) => `${site.position}:${site.class_id}`)
  );
  return [...pairs].sort().join("|");
}

/**
 * Record the class each of one resolved call site's arguments names, against
 * every function the call reaches.
 *
 * Recorded against the target rather than the call because the reader is the
 * target's body: `cls(**kw)` inside `build` is answered where `build` is
 * declared, from what every caller of `build` passed.
 */
export function gather_class_arguments(
  gathered: GatheredClassArguments,
  call: FunctionCallReference,
  targets: readonly SymbolId[],
  context: ReceiverResolutionContext
): void {
  const call_arguments = call.call_arguments;
  if (!call_arguments || call_arguments.every((argument) => argument === null)) {
    return;
  }
  // Functions only: a method declares its receiver as its first parameter, so
  // an argument list written without one (`go = r.run; go(A, B)`) sits one
  // position off every parameter it binds, and recording it would name the
  // wrong class at exactly the site this channel exists to answer.
  const callables = targets.filter(
    (target) => context.definitions.get(target)?.kind === "function"
  );
  if (callables.length === 0) {
    return;
  }

  for (const [position, argument] of call_arguments.entries()) {
    if (argument === null) {
      continue;
    }
    const held = resolve_read_value([argument], call.scope_id, call.location, context);
    if (held?.kind !== "class_object") {
      continue;
    }
    for (const callable_id of callables) {
      record_class_argument(gathered, callable_id, {
        file_id: call.location.file_path,
        position,
        class_id: held.class_id,
      });
    }
  }
}
