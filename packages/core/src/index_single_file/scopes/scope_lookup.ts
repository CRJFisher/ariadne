import type {
  LexicalScope,
  ScopeId,
  SymbolName,
  Location,
} from "@ariadnejs/types";

/**
 * Match a function/method/constructor definition to the scope of its body.
 *
 * The definition location is the function NAME (identifier), while the scope
 * location spans from the parameters to the closing brace. Tree-sitter places
 * the name and the scope differently across the constructs we index, so several
 * strategies are tried from most to least precise:
 *   0. Arrow functions: the definition spans the whole node and the scope
 *      contains it rather than starting after it, so match by smallest
 *      containing scope.
 *   1. Same line as the definition ends, exact name match.
 *   2. Within 5 lines, for multi-line signatures.
 *   3. Within 2 lines with no name match, when either side is anonymous and the
 *      name was captured inconsistently.
 *
 * `def_name` is empty or "<anonymous>" for anonymous functions.
 */
export function find_body_scope_for_definition(
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  def_name: SymbolName,
  def_location: Location,
): ScopeId {
  const callable_scopes = Array.from(scopes.values()).filter(scope =>
    scope.type === "function" || scope.type === "method" || scope.type === "constructor",
  );

  const is_anonymous = def_name === "" || def_name === "<anonymous>";

  if (is_anonymous) {
    const containment_candidates: { scope: LexicalScope; size: number }[] = [];

    for (const scope of callable_scopes) {
      const scope_is_anonymous = scope.name === null || scope.name === "";
      if (!scope_is_anonymous) continue;

      const scope_contains_def =
        scope.location.start_line <= def_location.start_line &&
        scope.location.end_line >= def_location.end_line &&
        (scope.location.start_line < def_location.start_line ||
          scope.location.start_column <= def_location.start_column) &&
        (scope.location.end_line > def_location.end_line ||
          scope.location.end_column >= def_location.end_column);

      if (scope_contains_def) {
        const size =
          (scope.location.end_line - scope.location.start_line) * 10000 +
          (scope.location.end_column - scope.location.start_column);
        containment_candidates.push({ scope, size });
      }
    }

    if (containment_candidates.length > 0) {
      containment_candidates.sort((a, b) => a.size - b.size);
      return containment_candidates[0].scope.id;
    }
  }

  let candidates: { scope: LexicalScope; distance: number }[] = [];

  for (const scope of callable_scopes) {
    if (scope.location.start_line !== def_location.end_line) continue;
    if (scope.location.start_column < def_location.end_column) continue;

    const distance = scope.location.start_column - def_location.end_column;
    const scope_is_anonymous = scope.name === null || scope.name === "";

    if ((is_anonymous && scope_is_anonymous) ||
        (!is_anonymous && scope.name === def_name)) {
      candidates.push({ scope, distance });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0].scope.id;
  }

  candidates = [];
  for (const scope of callable_scopes) {
    const line_diff = scope.location.start_line - def_location.end_line;
    if (line_diff < 0 || line_diff > 5) continue;

    const distance = line_diff * 10000 + (scope.location.start_column || 0);
    const scope_is_anonymous = scope.name === null || scope.name === "";

    if ((is_anonymous && scope_is_anonymous) ||
        (!is_anonymous && scope.name === def_name)) {
      candidates.push({ scope, distance });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0].scope.id;
  }

  // Requiring at least one anonymous side avoids matching two distinct named
  // definitions that merely sit close together.
  const location_candidates: { scope: LexicalScope; line_diff: number }[] = [];

  for (const scope of callable_scopes) {
    const line_diff = scope.location.start_line - def_location.end_line;
    if (line_diff < 0 || line_diff > 2) continue;
    if (line_diff === 0 && scope.location.start_column < def_location.end_column) continue;

    const scope_is_anonymous = scope.name === null || scope.name === "";
    if (!is_anonymous && !scope_is_anonymous) continue;

    location_candidates.push({ scope, line_diff });
  }

  if (location_candidates.length > 0) {
    location_candidates.sort((a, b) => {
      if (a.line_diff !== b.line_diff) return a.line_diff - b.line_diff;
      return a.scope.location.start_column - b.scope.location.start_column;
    });
    return location_candidates[0].scope.id;
  }

  throw new Error(
    `No body scope found for ${def_name} at ${def_location.file_path}:${def_location.start_line}`,
  );
}

/**
 * Walk up the scope tree from `scope_id` to the nearest enclosing
 * function/method/constructor scope. A call at module level has no enclosing
 * function, so the root scope (the one with a null parent) is returned instead.
 */
export function find_enclosing_function_scope(
  scope_id: ScopeId,
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
): ScopeId {
  let current_id: ScopeId = scope_id;
  const visited = new Set<ScopeId>();

  while (true) {
    if (visited.has(current_id)) {
      throw new Error("Cycle detected in scope tree");
    }
    visited.add(current_id);

    const scope = scopes.get(current_id);
    if (!scope) {
      throw new Error(`Scope ${current_id} not found`);
    }

    if (is_function_scope(scope)) {
      return scope.id;
    }

    if (scope.parent_id === null) {
      return scope.id;
    }

    current_id = scope.parent_id;
  }
}

function is_function_scope(scope: LexicalScope): boolean {
  return (
    scope.type === "function" ||
    scope.type === "method" ||
    scope.type === "constructor"
  );
}
