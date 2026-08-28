/**
 * Indirect reachability detection.
 *
 * Detects functions and methods that are reachable without direct call edges:
 * - Functions stored in collections that are read (e.g., `return HANDLERS`)
 * - Named functions passed as values/arguments (e.g., `apply(doubler, 21)`)
 * - Bound or instance methods read as values via a bare member-name read that
 *   resolves to the method through lexical scope (e.g., `register(self._acquire_connection)`,
 *   `out.write = this.write.bind(this)`, `self._processor = self.process`)
 *
 * These callables should not be considered entry points.
 */

import type { FilePath, SymbolId, SymbolName, Location, FunctionCollection, IndirectReachability } from "@ariadnejs/types";
import type { DefinitionRegistry } from "./registries/definition";

type SymbolResolver = (scope_id: string, name: SymbolName) => SymbolId | null;

interface VariableReadReference {
  kind: string;
  access_type?: string;
  scope_id: string;
  name: SymbolName;
  location: Location;
}

/**
 * The single writer of an indirect-reachability map.
 *
 * A function can be read as a value from many files and the map holds one
 * entry per function, so which read site becomes the reported evidence used to
 * be decided by whichever of six writers reached the key first — some
 * first-wins, some last-wins, all of them walking in ingest order. The entry
 * kept is the one earliest in the project instead, so the evidence is a
 * function of the corpus rather than of the order its files arrived in.
 */
export function record_indirect_reachability(
  into: Map<SymbolId, IndirectReachability>,
  fn_id: SymbolId,
  entry: IndirectReachability
): void {
  const held = into.get(fn_id);
  if (held === undefined || precedes(entry, held)) {
    into.set(fn_id, entry);
  }
}

/**
 * Whether `candidate` sits earlier in the project than `held`: file path, then
 * line, then column.
 *
 * The comparison runs on past the read site's start because the start alone is
 * not a total order, and a pair it leaves unordered is a pair the walk decides.
 * Two references can share a start — `apply_twice` is read both as the callee
 * name and as the whole call expression at one column — and one read of a
 * collection that spreads another reaches the same function under two
 * collection ids at one location. Ending sooner wins, so the tighter span is
 * the witness.
 */
function precedes(
  candidate: IndirectReachability,
  held: IndirectReachability
): boolean {
  const here = candidate.reason.read_location;
  const there = held.reason.read_location;
  if (here.file_path !== there.file_path) {
    return here.file_path < there.file_path;
  }
  if (here.start_line !== there.start_line) {
    return here.start_line < there.start_line;
  }
  if (here.start_column !== there.start_column) {
    return here.start_column < there.start_column;
  }
  if (here.end_line !== there.end_line) {
    return here.end_line < there.end_line;
  }
  if (here.end_column !== there.end_column) {
    return here.end_column < there.end_column;
  }
  if (candidate.reason.type !== held.reason.type) {
    return candidate.reason.type < held.reason.type;
  }
  return collection_of(candidate) < collection_of(held);
}

function collection_of(entry: IndirectReachability): string {
  return entry.reason.type === "collection_read" ? entry.reason.collection_id : "";
}

/**
 * Detect indirect reachability from variable read references.
 *
 * Two cases mark a symbol reachable: reading a function-collection variable
 * (every stored function is reachable) and reading a named function/method as
 * a value (the callable itself is reachable).
 */
export function detect_indirect_reachability(
  file_references: Map<FilePath, readonly VariableReadReference[]>,
  definitions: DefinitionRegistry,
  resolve: SymbolResolver
): Map<SymbolId, IndirectReachability> {
  const indirect_reachability = new Map<SymbolId, IndirectReachability>();

  for (const references of file_references.values()) {
    for (const ref of references) {
      if (ref.kind !== "variable_reference" || ref.access_type !== "read") {
        continue;
      }

      const symbol_id = resolve(ref.scope_id, ref.name);
      if (!symbol_id) continue;

      const collection = definitions.get_function_collection(symbol_id);
      if (collection) {
        mark_collection_as_consumed(
          symbol_id,
          collection,
          ref.location,
          definitions,
          resolve,
          indirect_reachability,
          new Set()
        );
        continue;
      }

      // A bare member-name read (`self._acquire_connection`, `this.write`)
      // resolves to the method symbol via lexical scope, so a method passed as a
      // value or stored in a field is reachable just like a free function.
      // Constructors are excluded: reading a constructor as a value is not a real
      // pattern (constructor invocations arrive as call references, not reads).
      const def = definitions.get(symbol_id);
      if (def && (def.kind === "function" || def.kind === "method")) {
        // A Python `def foo` emits a variable_reference read at the def location;
        // that self-read is not the function being passed as a value.
        if (
          ref.location.file_path === def.location.file_path &&
          ref.location.start_line === def.location.start_line &&
          ref.location.start_column === def.location.start_column
        ) {
          continue;
        }
        record_indirect_reachability(indirect_reachability, symbol_id, {
          reason: { type: "function_reference", read_location: ref.location },
        });
      }
    }
  }

  return indirect_reachability;
}

/**
 * Mark all functions in a collection as indirectly reachable, recursing through
 * spread members (e.g. `...JAVASCRIPT_HANDLERS`). `visited` breaks cycles in
 * mutually-spreading collections.
 */
function mark_collection_as_consumed(
  collection_id: SymbolId,
  collection: FunctionCollection,
  read_location: Location,
  definitions: DefinitionRegistry,
  resolve: SymbolResolver,
  indirect_reachability: Map<SymbolId, IndirectReachability>,
  visited: Set<SymbolId>
): void {
  if (visited.has(collection_id)) return;
  visited.add(collection_id);

  for (const fn_id of collection.stored_functions) {
    record_indirect_reachability(indirect_reachability, fn_id, {
      reason: {
        type: "collection_read",
        collection_id,
        read_location,
      },
    });
  }

  // `stored_references` holds names (function names or spread variable names)
  // that must be resolved in the collection's own defining scope.
  if (collection.stored_references) {
    const collection_def = definitions.get(collection_id);
    if (!collection_def) return;
    const defining_scope = collection_def.defining_scope_id;

    for (const ref_name of collection.stored_references) {
      const ref_id = resolve(defining_scope, ref_name);
      if (!ref_id) continue;

      const ref_def = definitions.get(ref_id);
      if (!ref_def) continue;

      if (ref_def.kind === "function") {
        record_indirect_reachability(indirect_reachability, ref_id, {
          reason: {
            type: "collection_read",
            collection_id,
            read_location,
          },
        });
      } else if (
        (ref_def.kind === "variable" || ref_def.kind === "constant") &&
        ref_def.function_collection
      ) {
        // Spread of another collection — recurse into its members.
        mark_collection_as_consumed(
          ref_id,
          ref_def.function_collection,
          read_location,
          definitions,
          resolve,
          indirect_reachability,
          visited
        );
      }
    }
  }
}
