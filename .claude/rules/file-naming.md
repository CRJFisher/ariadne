---
paths: packages/*/src/**
---

# File Naming Conventions

## Folder-Module Naming Rule

Each folder represents a module. The folder name provides the namespace, so sub-modules do NOT repeat the folder name.

```text
{folder}/
  index.ts                       # Barrel file for exports
  {folder}.ts                    # Main implementation
  {folder}.test.ts               # Main tests
  {folder}.{language}.ts         # Language-specific variant (suffix, not prefix!)
  {submodule}.ts                 # Helper/submodule (no folder prefix)
  {submodule}.test.ts            # Submodule tests
  {submodule}.{language}.ts      # Language variant of submodule
```

### Language Suffix Rule

Language identifiers ALWAYS come as a suffix, never a prefix:

- `imports.python.ts` - correct
- `python.imports.ts` - incorrect (blocked by hook)

Supported languages: typescript, javascript, python, rust

### Language Mechanism Rule (terminal)

The dotted suffix is the default — and only general — mechanism for
language-specific code:

- `{module}.{language}.ts` is the default for any language-specific variant.
- Prefix-named files inside a dedicated sub-folder (e.g.
  `extractors/python_scope_boundary_extractor.ts`) are permitted only for
  shared-base hierarchies — language classes extending a common base that
  lives in the same sub-folder.
- A directory segment below `src/` may never be a language name —
  `typescript`, `javascript`, `python`, `rust`, `go`, `java` — whether or not
  that language has an accepted suffix, and whatever its capitalisation. Only
  whole segments match, so `typescript_helpers/` is fine, and a package may be
  named after a language.
- Per-language top-level modules (a `python_imports.ts` at a module root)
  are prohibited by convention; the hook does not detect them, so this one
  rests on review.
- `classify_entry_points/builtins/` uses filename = `group_id`
  (`check_<group_id>.ts`); a group id may name a language as part of the
  pattern it classifies without invoking the suffix rule.

### Special Cases

- **Package `src/` root**: Files directly in `packages/*/src/` use simple `snake_case.ts`
- **Extractor directories**: Use prefix naming (`python_scope_boundary_extractor.ts`)
- **Non-TS files**: `.scm` and `.md` files allowed in `src/`
- **Special allowed**: `test_utils.ts` (test utilities, not ad-hoc tests)

## Naming Philosophy

A name must be **fully true**: it describes ALL of the file's content, not most
of it. When a name stops being true because the file grew a second concern,
split it into precisely-named leaves rather than widening the name to cover
both.

`{folder}/{folder}.ts` is reserved for the folder's main implementation. A
store, a sub-step, or a helper never claims the folder name — a
`ResolutionRegistry` store inside `resolution/` is `resolution_registry.ts`,
not `resolution.ts`.

File names describe their responsibility, not their category.

**Preferred** (functionality-descriptive):

- `detect_test_file.ts` - describes what it does
- `resolve_module_path.ts` - describes its purpose

**Avoid** (category-descriptive):

- `file_utils.ts` - generic, unclear purpose
- `helpers.ts` - too broad

### Banned Category Names

These basenames are blocked in `packages/*/src` (closed set, same as the hook's):

`utils.ts`, `types.ts`, `common.ts`, `errors.ts`, `helpers.ts`, `constants.ts`,
`analytics.ts`, `misc.ts`, `shared.ts`

The stem before the first dot carries the name, so `types.d.ts` and
`utils.python.ts` are blocked alongside the plain forms. `index.ts` and
`*.test.ts` are exempt.

The basename is checked before the folder-module rule, so a banned name is
blocked in the main-implementation position too: `analytics/analytics.ts` is
blocked even though `{folder}/{folder}.ts` is otherwise the main-implementation
name. The folder itself is not inspected — `analytics/query_stats.ts` is
fine — so a folder whose name is a banned category takes `index.ts` as its
entry point, or gets renamed to the concept it holds.

## Language-Specific Marshalling Pattern

When functionality varies by language, use a marshalling file that dispatches to language-specific implementations:

```text
{functionality}/
  {functionality}.ts              # Marshalling file - routes by language
  {functionality}.typescript.ts   # TypeScript implementation
  {functionality}.python.ts       # Python implementation
```

Examples: `import_resolution.ts`, `capture_handlers.ts`

## Hook Enforcement

File naming is enforced twice, both paths sharing the checks in
`.claude/hooks/file_naming.ts`: `.claude/hooks/file_naming_validator.ts` blocks
a non-conforming Write or Edit as it happens, and
`.claude/hooks/file_naming_validator_stop.ts` audits every workspace package at
session end. Violations are blocked with a suggested correct name whenever one
exists.

On the allow path, `file_naming_validator.ts` also emits an encourage-only
nudge (never a block) from `.claude/hooks/marshaller_nudge.ts`: writing a new
`{feature}.{language}.ts` leaf under `packages/core/src` while no sibling
`{feature}.ts` marshaller exists injects a PreToolUse `additionalContext`
reminder to add the in-folder marshaller, deduped per session, feature, and
folder.
