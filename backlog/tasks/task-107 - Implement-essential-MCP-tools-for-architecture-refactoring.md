---
id: task-107
title: Implement essential MCP tools for architecture refactoring
status: In Progress
assignee: []
created_date: "2025-08-19"
labels: [mcp, tools, epic-11]
dependencies: []
---

## Context

During initial MCP server testing, we found only `get_symbol_context` is implemented. We need three core tools for effective architecture refactoring during Epic 11.

## Tools to Implement

### 1. find_references

**Purpose**: Find all usages of a symbol across the codebase
**Challenge**: Core API uses `find_references(file_path, position)` but we have symbol name
**Solution**: Search for symbol definitions first, then find references
**Returns**: List of locations where symbol is used

### 2. get_file_metadata

**Purpose**: Get all symbols defined in a file
**Wraps**: `get_definitions(file_path)`
**Returns**: For each symbol:
- Name
- Type (function, class, type, interface, etc.)
- Line number
- 1-line signature (e.g., `function parseFile(path: string, opts?: Options): Tree`)
**Use Case**: Understanding file structure and dependencies

### 3. get_source_code

**Purpose**: Extract complete source code of a function/class
**Challenge**: Need to resolve symbol name to Definition first
**Wraps**: `get_source_code(def, file_path)`
**Returns**: Full source text of the symbol

## Implementation Plan

1. [x] Create feature branch
2. [ ] Implement find_references tool
3. [ ] Implement get_file_metadata tool
4. [ ] Implement get_source_code tool
5. [ ] Add tests for each tool
6. [ ] Test with real Epic 11 scenarios
7. [ ] Update documentation

## Success Criteria

- [ ] All three tools working correctly
- [ ] Tests passing
- [ ] Can find all references to any symbol
- [ ] Can list all symbols in any file
- [ ] Can extract full source of any function/class
- [ ] Tools help with Epic 11 refactoring tasks

## Implementation Notes

_To be filled during implementation_

## Testing Notes

_To be filled during testing_
