---
paths: packages/core/src/**
---

# Language-Specific Code Patterns

## Language Dispatch Pattern

Language-specific code follows the `{module}.{language}.ts` naming convention. The main module dispatches to language-specific implementations based on file extension:

```typescript
// module_name.ts (main entry point — dispatcher)
import { handle_python } from "./module_name.python";
import { handle_typescript } from "./module_name.typescript";

function process(file_path: FilePath): void {
  if (file_path.endsWith(".py")) return handle_python(file_path);
  if (file_path.endsWith(".ts")) return handle_typescript(file_path);
}
```

See `@.claude/rules/file-naming.md` for the complete naming convention.

## When to Create Language-Specific Files

Create `module.{language}.ts` when:

1. **Language-specific semantics** — e.g., Python's module-level variable reassignment creates multiple definitions
2. **Different tree-sitter AST structures** — Different query patterns needed per language
3. **Behavior triggered by file extension** — e.g., `.py` files need Python-specific export handling

## Cross-Language Consistency

When fixing a bug in a language-specific file:

1. **Consider applicability** — Does the fix apply to other languages?
2. **Apply consistently** — If applicable, apply the fix to all relevant language files
3. **Test thoroughly** — Include both unit tests for the language-specific module and integration tests for end-to-end behavior

## Supported Languages

TypeScript, JavaScript, Python, Rust.

Each has:

- Tree-sitter `.scm` query files in `query_code_tree/queries/`
- Capture handlers in `query_code_tree/capture_handlers/`
- Metadata extractors in `query_code_tree/metadata_extractors/`
- Symbol factories in `query_code_tree/symbol_factories/`
- Scope boundary extractors in `scopes/extractors/`
- Import resolvers in `resolve_references/import_resolution/`
- Receiver resolvers in `resolve_references/call_resolution/`
- Test file detectors in `project/`
