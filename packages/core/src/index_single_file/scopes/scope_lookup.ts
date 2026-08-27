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
 *   0. Anonymous functions: the definition spans the whole node, so its own
 *      scope is the outermost anonymous scope INSIDE that span.
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
    // Matching by containment IN the definition, rather than by a scope that
    // contains it, is what makes the forms agree. `(v) => v` puts its scope on
    // exactly the definition's span, but `async (v) => v` and `function (v) {}`
    // start their scope at the parameter list, after the definition's own
    // start — so a scope containing the definition is never the definition's
    // own, and an enclosing callback's scope would be borrowed instead, making
    // that callback's node report calls it does not hold.
    const owned_candidates: { scope: LexicalScope; size: number }[] = [];

    for (const scope of callable_scopes) {
      const scope_is_anonymous = scope.name === null || scope.name === "";
      if (!scope_is_anonymous) continue;

      const def_contains_scope =
        scope.location.start_line >= def_location.start_line &&
        scope.location.end_line <= def_location.end_line &&
        (scope.location.start_line > def_location.start_line ||
          scope.location.start_column >= def_location.start_column) &&
        (scope.location.end_line < def_location.end_line ||
          scope.location.end_column <= def_location.end_column);

      if (def_contains_scope) {
        const size =
          (scope.location.end_line - scope.location.start_line) * 10000 +
          (scope.location.end_column - scope.location.start_column);
        owned_candidates.push({ scope, size });
      }
    }

    // The outermost, so a nested callback's scope is never taken for its own.
    if (owned_candidates.length > 0) {
      owned_candidates.sort((a, b) => b.size - a.size);
      return owned_candidates[0].scope.id;
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

