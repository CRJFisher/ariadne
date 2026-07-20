---
paths: packages/*/src/**
---

# Testing Requirements

## Test Structure

```text
module_name/
├── module_name.ts      # Core functionality
├── module_name.test.ts # Core functionality tests
```

## Testing Approach

- When debugging, **always add cases to EXISTING test files**. If the test file doesn't exist yet, create them in the STANDARD FORMAT: `module_name.test.ts`
- **Fix issues, don't hide them** - Never modify tests to pass
- **Test real scenarios** - Use realistic code samples
- **Document gaps** - Note any untested edge cases
- _NEVER_ use `toMatchObject` matcher - use `toEqual` instead and create the expected, typed literal objects

## Test Helper Functions

Test helper functions should go in the first common ancestor test file of all dependent test files:

- If helper is used by `a/b.test.ts` and `a/c.test.ts`, put it in `a/a.test.ts`
- If helper is used by `a/b.test.ts` and `a/x/c.test.ts`, put it in `a/a.test.ts`
- Export the helper so child test files can import it

Placing helpers beside their consumers keeps them discoverable and stops a generic, catch-all utility file from accreting unrelated helpers. File naming — including when a dedicated `test_utils.ts` is permitted — is owned by `file-naming.md`.

## Integration Test Patterns

Choose based on scope:

- `build_index_single_file()` with inline code — AST-level extraction, single-construct, metadata/factory tests
- `Project` + `update_file()` with inline code — cross-file resolution, full pipeline tests
- `Project` + temp directory — filesystem-dependent features, import resolution
- Fixture files (`tests/fixtures/{lang}/code/`) — project-level integration, multi-file scenarios

Use inline code for small focused tests (1–10 lines); fixtures for multi-file or complex scenarios.

## Assertion Requirements

Assert the exact extracted value — never use weak existence checks:

- Use `toEqual` with typed literal objects
- Never: `toBeDefined()`, `instanceof Map` alone, `toHaveLength(n > 0)`, `not.toThrow()` alone, `if (node) { expect... }` guards
- Test `is_exported` for both `true` and `false` cases
