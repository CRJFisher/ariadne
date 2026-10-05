/**
 * Derive definition-site features for an entry point, routing by language.
 *
 * Separate from call-site `SyntacticFeatures` — those describe the call; these
 * describe the callee. Accessor syntax and object-literal-method shorthand are
 * a JS/TS grammar concept, so JS/TS entries route to the `.jsts.ts` leaf while
 * every other language carries the neutral record (no accessor syntax, no
 * object-literal-method concept).
 */

import type {
  CallableNode,
  DefinitionFeatures,
  FilePath,
  Language,
  SymbolId,
} from "@ariadnejs/types";
import { derive_definition_features_jsts } from "./derive_definition_features.jsts";

export function derive_definition_features(
  node: CallableNode,
  class_methods: ReadonlySet<SymbolId>,
  lines_by_file: ReadonlyMap<FilePath, string[]>,
  language: Language,
): DefinitionFeatures {
  switch (language) {
    case "typescript":
    case "javascript":
      return derive_definition_features_jsts(node, class_methods, lines_by_file);
    default:
      // Languages whose indexer records the accessor role on the definition
      // need no source-line reading to recover it.
      return {
        definition_is_object_literal_method: false,
        accessor_kind:
          node.definition.kind === "method"
            ? (node.definition.accessor_kind ?? null)
            : null,
      };
  }
}
