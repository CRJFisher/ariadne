/**
 * Imports - Process import statements
 */

import type {
  FilePath,
  SymbolId,
  SymbolName,
  LexicalScope,
  SymbolDefinition,
  Import,
  NamedImport,
  Language,
} from "@ariadnejs/types";
import { variable_symbol } from "@ariadnejs/types";
import type { NormalizedCapture } from "../capture_types";

/**
 * Process imports with language-specific handling
 */
export function process_imports(
  import_captures: NormalizedCapture[],
  root_scope: LexicalScope,
  symbols: Map<SymbolId, SymbolDefinition>,
  _file_path: FilePath,
  language: Language
): Import[] {
  const imports: Import[] = [];

  // Group captures by import statement
  for (const capture of import_captures) {
    // Skip captures that are marked to skip (e.g., import.source that aren't side-effects)
    if (capture.context?.skip) {
      continue;
    }

    // Get source from normalized capture context with validation
    const source = capture.context?.source_module || "";
    const location = capture.node_location;

    // Validate capture has required data
    if (!capture.text && capture.text !== "") {
      continue; // Skip if no import name
    }

    // Determine import type based on modifiers and entity
    let import_item: Import;

    if (capture.context?.is_side_effect_import) {
      // Side-effect import
      import_item = {
        kind: "side_effect" as const,
        source: source as FilePath,
        location,
        modifiers: [],
        language: language,
        node_type: "import_statement",
      };
      // Skip symbol creation for side-effect imports
      imports.push(import_item);
      continue;
    } else if (capture.modifiers.is_default) {
      // Default import
      import_item = {
        kind: "default" as const,
        source: source as FilePath,
        name: capture.text as SymbolName,
        resolved_export: {} as any, // Will be resolved later
        location,
        modifiers: [],
        language: language,
        node_type: "import_statement",
      };
    } else if (capture.modifiers.is_namespace || (language === "python" && capture.text === "*") || (language === "rust" && capture.modifiers.is_wildcard)) {
      // Namespace import, Python wildcard import, or Rust glob import
      const modifiers: string[] = [];

      // Mark Python wildcard imports specially
      if (language === "python" && capture.text === "*") {
        modifiers.push("wildcard");
      }

      // Mark Rust glob imports
      if (language === "rust" && capture.modifiers.is_wildcard) {
        modifiers.push("glob");
      }

      // Handle relative imports in Python
      if (language === "python" && source.startsWith(".")) {
        modifiers.push("relative");
      }

      // Handle Rust module paths
      if (language === "rust") {
        if (source.startsWith("crate::")) {
          modifiers.push("crate_relative");
        } else if (source.startsWith("super::")) {
          modifiers.push("super_relative");
        } else if (source.startsWith("self::")) {
          modifiers.push("self_relative");
        }
      }

      import_item = {
        kind: "namespace" as const,
        source: source as FilePath,
        namespace_name: capture.text === "*" ? "STAR_IMPORT" as any : capture.text as any,
        exports: new Map(),
        location,
        modifiers,
        language: language,
        node_type: "import_statement",
      };
    } else if (capture.context?.import_alias && typeof capture.context.import_alias === "string") {
      // Named import with alias (with validation)
      const modifiers: string[] = [];

      // Handle relative imports in Python
      if (language === "python" && source.startsWith(".")) {
        modifiers.push("relative");
      }

      // Handle Rust module paths
      if (language === "rust") {
        if (source.startsWith("crate::")) {
          modifiers.push("crate_relative");
        } else if (source.startsWith("super::")) {
          modifiers.push("super_relative");
        } else if (source.startsWith("self::")) {
          modifiers.push("self_relative");
        }
      }

      import_item = {
        kind: "named" as const,
        source: source as FilePath,
        imports: [
          {
            name: capture.text as SymbolName,
            alias: capture.context.import_alias as SymbolName,
            is_type_only: capture.modifiers.is_type_only || false,
          },
        ],
        resolved_exports: new Map(),
        location,
        modifiers,
        language: language,
        node_type: "import_statement",
      };
    } else {
      // Regular named import
      const modifiers: string[] = [];

      // Handle relative imports in Python
      if (language === "python" && source.startsWith(".")) {
        modifiers.push("relative");
      }

      // Handle Rust module paths
      if (language === "rust") {
        if (source.startsWith("crate::")) {
          modifiers.push("crate_relative");
        } else if (source.startsWith("super::")) {
          modifiers.push("super_relative");
        } else if (source.startsWith("self::")) {
          modifiers.push("self_relative");
        }
      }

      import_item = {
        kind: "named" as const,
        source: source as FilePath,
        imports: [
          {
            name: capture.text as SymbolName,
            is_type_only: capture.modifiers.is_type_only || false,
          },
        ],
        resolved_exports: new Map(),
        location,
        modifiers,
        language: language,
        node_type: "import_statement",
      };
    }

    imports.push(import_item);

    // Create symbol for imported name (skip for side-effect and wildcard imports)
    if (!capture.context?.is_side_effect_import &&
        !(language === "python" && capture.text === "*") &&
        !(language === "rust" && capture.modifiers?.is_wildcard)) {
      const symbol_id = variable_symbol(capture.text, location);
      const symbol: SymbolDefinition = {
        id: symbol_id,
        name: capture.text as SymbolName,
        kind: "import",
        location,
        scope_id: root_scope.id,
        is_hoisted: false,
        is_exported: false,
        is_imported: true,
        import_source: source as FilePath,
        references: [],
      };

      root_scope.symbols.set(
        capture.text as SymbolName,
        symbol
      );
      symbols.set(symbol_id, symbol);
    }
  }

  return imports;
}
