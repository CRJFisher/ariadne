---
paths: packages/core/src/**
---

# Language-Specific Code Patterns

## Language Dispatch Pattern

Language-specific code follows the `{module}.{language}.ts` naming convention. The main module dispatches to language-specific implementations on the threaded `language` parameter:

```typescript
// module_name.ts (main entry point — dispatcher)
import { handle_python } from "./module_name.python";
import { handle_typescript } from "./module_name.typescript";

function process(file_path: FilePath, language: Language): void {
  switch (language) {
    case "python":
      return handle_python(file_path);
    case "typescript":
      return handle_typescript(file_path);
  }
}
```

A file's language is decided once at parse ingress (`detect_language.ts`) and
threaded to dispatchers as a parameter — never re-derived from the path
downstream of parse.

See `@.claude/rules/file-naming.md` for the complete naming convention.

## Dispatch Lives in an In-Folder Marshaller

The language switch happens once, in a marshaller that sits in the same folder as the leaves
it selects — `{feature}.ts` beside `{feature}.{language}.ts`, or the folder's `index.ts` when
the folder is the feature. Never displace the switch upward into a stage orchestrator or
inline it at a call site: an orchestrator threads `language` and calls the marshaller.

Two shapes, both live:

- `resolve_references/import_resolution/import_resolution.ts` marshals to
  `import_resolution.{javascript,python,rust,typescript}.ts`. `project/detect_test_file.ts`
  is the same.
- `index_single_file/query_code_tree/capture_handlers/index.ts` switches on `language` for
  the whole folder.

Below the switch, language is already resolved: a leaf imports its same-language siblings
directly (`capture_handlers.rust.ts` imports `symbol_factories.rust`), and a feature with
only one language leaf needs no marshaller at all. Adding a language touches one folder — a
new leaf plus one switch arm.

Enforcement: `file_naming_validator.ts` (PreToolUse) enforces the `{feature}.{language}.ts`
shape; it does not verify that a dotted suffix is a real language. Marshaller placement is
review-carried.

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

Each has tree-sitter `.scm` queries in `query_code_tree/queries/`, plus
`{feature}.{language}.ts` leaves spread across `query_code_tree/`, `scopes/extractors/`,
`resolve_references/`, and `project/`. Enumerate the current set rather than trusting a list:

```bash
find packages/core/src -name "*.ts" -not -name "*.test.ts" \
  | grep -E "\.(javascript|typescript|python|rust)\.ts$"
```

A language branch deliberately left inline in an otherwise language-neutral file carries an
`// @language <langs>` comment so that audit can still find it —
`call_resolution/receiver_resolution.ts` is one unified module by design and marks its Rust
case that way. Tag form: `@.claude/rules/types-language-annotations.md`.
