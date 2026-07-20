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

## Detailed Rules

Detailed, situational guidance lives in `.claude/rules/` and auto-loads by file path when you touch a matching file — this trunk never restates it:

- **File naming** (`file-naming.md`) loads on `packages/*/src/**`; **testing** (`testing.md`) loads on the test-bearing trees (`packages/*/src/**`, `packages/*/tests/**`, `.claude/hooks/**`, `.claude/skills/**`, `scripts/**`).
- **Documentation style** (`documentation-style.md`) loads on any Markdown edit.
- Pipeline-stage and subsystem rules load on their owning source paths.

## Code Structure

- **Naming**: `snake_case` functions and variables, `UPPER_SNAKE_CASE` constants, `PascalCase` classes and interfaces. File and folder naming is owned and enforced by `.claude/rules/file-naming.md`.
- **Functional Style**: Prefer pure functions over stateful classes
- **Exports**: Only export what is actually used by external modules
- **Dependencies**: Check existing libraries before adding new ones
- Variables should almost always be non-nullable. Only make them nullable if you have a good reason to do so and its completely unavoidable.

## Debugging

- Create debug scripts in a temporary folder, not in this project.

## Refactoring

- Use `git mv` to move files and folders so we preserve the history.
