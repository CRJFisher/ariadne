# Guidelines

## Goals

- When refactoring, always investigate the existing information architecture beforehand. If the refactor will change the information architecture, then the refactor should include tasks to update and improve the information architecture.
- The information architecture should follow the DDD principles.
- Folders and file names should be expressive of the main, high-level action of the code within.

## Project Layout / Intention Tree

- the top of the intention tree (the actual purpose of this codebase) is to detect call graphs and thereby find the entry point to the codebase.
- every change to the code needs to be justified in terms of its contribution to the top-level intention tree.
- the module layout is the instantiation of the intention tree.
- we _never_ add 'extra' functionality outside of this intention tree, even if it is 'well-meaning' and 'might' be used one day. 'extra', surplus code reduces our longterm velocity. it is much better to spend effort reviewing narrow, focussed code and its integration, rather than trying to cover a wide surface area.
- all namings and documentation should _only_ reflect the trunk and branches of the intention tree, not the 'differential' changes we make to the codebase. E.g. if we're changing 'method_resolution.ts', we don't just create a file like 'enhanced_method_resolution.ts', we just improve 'method_resolution.ts', leaving the core intention tree intact.

## Refactoring Ethos

- DO NOT SUPPORT BACKWARD COMPATIBILITY - JUST _CHANGE_ THE CODE.

## Processing Pipeline

The core pipeline has three stages. Subsystem-specific guidance lives in `.claude/rules/`.

1. **Per-file indexing** (`index_single_file/`) — 4-pass semantic indexing: query tree → scopes → definitions → references
2. **Project resolution** (`project/` + `resolve_references/`) — Registry updates, import location fixing, name resolution → call resolution
3. **Entry point detection** (`trace_call_graph/`) — Build call graph, identify unreachable functions with language-specific filtering

## Documentation Style: Canonical and Self-Contained

When writing or updating documentation, always write in a **canonical, self-contained** style. Documentation should describe the system as it currently IS, not as it was or how it changed.

**DO:**

- Describe the system as it currently IS
- Write in present tense ("The system works like this...")
- Be authoritative and direct
- Assume reader has no prior knowledge or context
- Focus on WHAT to do, not what NOT to do
- State the approach confidently without justification

**DON'T:**

- Reference "old approaches," "previous versions," or "deprecated methods"
- Use "revised," "updated," or "new" framing
- Explain what you're NOT doing or alternative approaches you rejected
- Include defensive justifications for design choices
- Write comparisons to alternatives (unless teaching concepts)
- Use apologetic or hedging language
- Assume reader knows the history or evolution

**Why:** Documentation should be the authoritative source of truth about the current system. Historical context belongs in commit messages, architecture decision records (separate files), or changelog files - not in the canonical system documentation.

**Note:** This applies to system documentation (README, task docs, architecture docs). Implementation notes in task files may reference history when documenting specific changes made.

## Code Style Guidelines

### Naming Convention - pythonic

- **Functions**: `snake_case`
- **Variables**: `snake_case`
- **Constants**: `UPPER_SNAKE_CASE`
- **Classes/Interfaces**: `PascalCase`
- **Files**: `snake_case.ts`

### Code Structure

- **Functional Style**: Prefer pure functions over stateful classes
- **Exports**: Only export what is actually used by external modules
- **Dependencies**: Check existing libraries before adding new ones
- Variables should almost always be non-nullable. Only make them nullable if you have a good reason to do so and its completely unavoidable.

## Testing Requirements

### Test Structure

```text
module_name/
├── module_name.ts      # Core functionality
├── module_name.test.ts # Core functionality tests
```

### Testing Approach

- When debugging, **always add cases to EXISTING test files**. If the test file doesn't exist yet, create them in the STANDARD FORMAT: `module_name.test.ts`
- **Fix issues, don't hide them** - Never modify tests to pass
- **Test real scenarios** - Use realistic code samples
- **Document gaps** - Note any untested edge cases
- _NEVER_ use `toMatchObject` matcher - use `toEqual` instead and create the expected, typed literal objects

### Test Helper Functions

Test helper functions should go in the first common ancestor test file of all dependent test files:

- If helper is used by `a/b.test.ts` and `a/c.test.ts`, put it in `a/a.test.ts`
- If helper is used by `a/b.test.ts` and `a/x/c.test.ts`, put it in `a/a.test.ts`
- Export the helper so child test files can import it

This avoids generic utility files like `test_utils.ts` that become dumping grounds.

### Integration Test Patterns

Choose based on scope:

- `build_index_single_file()` with inline code — AST-level extraction, single-construct, metadata/factory tests
- `Project` + `update_file()` with inline code — cross-file resolution, full pipeline tests
- `Project` + temp directory — filesystem-dependent features, import resolution
- Fixture files (`tests/fixtures/{lang}/code/`) — project-level integration, multi-file scenarios

Use inline code for small focused tests (1–10 lines); fixtures for multi-file or complex scenarios.

### Assertion Requirements

Assert the exact extracted value — never use weak existence checks:

- Use `toEqual` with typed literal objects
- Never: `toBeDefined()`, `instanceof Map` alone, `toHaveLength(n > 0)`, `not.toThrow()` alone, `if (node) { expect... }` guards
- Test `is_exported` for both `true` and `false` cases

## Debugging

- Create debug scripts in a temporary folder, not in this project.

## Refactoring

- Use `git mv` to move files and folders so we preserve the history.
