# Task: Overhaul MCP Package for Call Graph Analysis

**Status**: To Do
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-22
**Priority**: Medium

## Context

Complete overhaul of `packages/mcp` to integrate with the refactored `packages/core` API.

This epic removes all legacy code and rebuilds MCP tools from scratch with a focus on **call graph analysis and navigation**.

**NO BACKWARDS COMPATIBILITY** - This is a complete rewrite.

## Background

`packages/core` has undergone massive refactoring (epic-11). The `Project` API now provides:
- Incremental file updates with automatic resolution
- Call graph detection via `detect_call_graph()`
- Comprehensive registries (definitions, types, scopes, exports, imports, resolutions)
- Full symbol resolution with location tracking
- Efficient query APIs for definitions, references, and relationships

## Goals

Build MCP tools that leverage call graph analysis for:
1. **Discovery** - Find entry points and understand codebase structure
2. **Navigation** - Traverse call relationships up and down
3. **Impact Analysis** - Understand dependencies and usage

## Scope

This task includes the following sub-tasks:

1. **Strip MCP to Foundation** ([task-epic-11.147.1](task-epic-11.147.1-Strip-MCP-to-Foundation.md))
   - Remove all legacy tools and adapters
   - Update server to use new Project API

2. **Implement list_functions Tool** ([task-epic-11.147.2](task-epic-11.147.2-Implement-list_functions-Tool.md))
   - List top-level functions ordered by tree-size
   - Show function signatures and call counts

3. **Implement show_call_tree_down Tool** ([task-epic-11.147.3](task-epic-11.147.3-Implement-show_call_tree_down-Tool.md))
   - Display ASCII call graph underneath a callable
   - Traverse down the call tree

4. **Implement show_call_stack_up Tool** ([task-epic-11.147.4](task-epic-11.147.4-Implement-show_call_stack_up-Tool.md))
   - Display ASCII call stack above a callable
   - Traverse up to find all callers

5. **Implement find_references Tool** ([task-epic-11.147.5](task-epic-11.147.5-Implement-find_references-Tool.md))
   - Find all references to a callable definition
   - Show call sites with context

6. **Implement find_definition Tool** ([task-epic-11.147.6](task-epic-11.147.6-Implement-find_definition-Tool.md))
   - Find definition for a reference symbol
   - Resolve symbol by name and location

## Architecture Decisions

### No Legacy Compatibility

This is a **complete rewrite**. We will not:
- Support old tool interfaces
- Maintain type adapters (types.ts)
- Preserve any legacy helper functions

### Lean on Project API

All tools should use the `Project` class APIs directly:
- `project.get_call_graph()` - Get complete call graph
- `project.definitions` - Query definitions
- `project.resolutions` - Query resolved references
- `project.get_definition()` - Get definition by SymbolId
- `project.get_source_code()` - Extract source code

### Focus on Call Graph

All tools center around call graph analysis:
- Entry points (functions never called)
- Call trees (what a function calls)
- Call stacks (who calls a function)
- References (where a function is used)

## Testing Strategy

Each sub-task should include:
1. Unit tests for core logic (tree traversal, symbol resolution)
2. Integration tests with realistic code samples
3. Manual testing via MCP client

## Success Criteria

- [ ] All legacy code removed
- [ ] All 6 tools implemented and tested
- [ ] MCP server starts successfully
- [ ] Tools work with TypeScript, JavaScript, Python, and Rust
- [ ] ASCII output is readable and helpful
- [ ] Error messages are clear and actionable

## Related Work

- Epic 11 (packages/core refactoring)
- Project API ([project.ts](../../../../packages/core/src/project/project.ts))
- Call Graph Detection ([detect_call_graph.ts](../../../../packages/core/src/trace_call_graph/detect_call_graph.ts))
