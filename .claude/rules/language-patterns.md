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

A folder that owns `{feature}.{language}.ts` leaves has a sibling `{feature}.ts` marshaller
owning the language switch. The switch belongs beside the leaves it selects: never displace
it upward into a stage orchestrator, and never branch on language at a call site.

Gold standard: `resolve_references/import_resolution/` — `import_resolution.ts` marshals to
`import_resolution.{javascript,python,rust,typescript}.ts`. `project/detect_test_file.ts` has
the same shape.

A stage orchestrator calls the marshaller and threads `language`; adding a language then
touches one folder — a new leaf plus one switch arm.

Enforcement: `.claude/hooks/file_naming_validator.ts` (PreToolUse) enforces the
`{feature}.{language}.ts` shape. That the marshaller exists and owns the switch is
review-enforced — no hook checks placement.

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
- Test file detectors in `project/`

Receiver type inference is the exception: `resolve_references/call_resolution/receiver_resolution.ts`
is one unified module handling all four languages, with per-language cases annotated inline.
