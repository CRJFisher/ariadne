/**
 * JS/TS definition-feature derivation. TypeScript and JavaScript share the same
 * grammar for accessors (`get`/`set`) and object-literal method shorthand, so a
 * single combined leaf serves both rather than duplicate identical logic across
 * `.typescript.ts` and `.javascript.ts`.
 *
 * - `accessor_kind`: read from the `get` / `set` token on the definition line
 *   (class and object-literal accessors share this syntax).
 * - `definition_is_object_literal_method`: true for `kind === "method"` entries
 *   whose symbol_id is NOT in the class-method set. Class methods are registered
 *   via `ClassDefinition.methods`; anything else with `kind === "method"`
 *   (object-literal shorthand) falls through.
 */

import type {
  CallableNode,
  DefinitionFeatures,
  FilePath,
  SymbolId,
} from "@ariadnejs/types";

export function derive_definition_features_jsts(
  node: CallableNode,
  class_methods: ReadonlySet<SymbolId>,
  lines_by_file: ReadonlyMap<FilePath, string[]>,
): DefinitionFeatures {
  const def_line =
    lines_by_file.get(node.location.file_path)?.[node.location.start_line - 1] ?? "";
  const accessor_kind = classify_accessor_line(def_line);
  const is_object_literal_method =
    node.definition.kind === "method" && !class_methods.has(node.symbol_id);
  return {
    definition_is_object_literal_method: is_object_literal_method,
    accessor_kind,
  };
}

export function classify_accessor_line(line: string): "getter" | "setter" | null {
  // Requires whitespace + identifier + `(` after the keyword so identifiers that
  // merely start with `get`/`set` (e.g. `getThing()`) are not misread.
  const re = /^\s*(?:(?:public|private|protected|static|async|readonly)\s+)*(get|set)\s+[A-Za-z_$][\w$]*\s*\(/;
  const m = re.exec(line);
  if (m === null) return null;
  return m[1] === "get" ? "getter" : "setter";
}
