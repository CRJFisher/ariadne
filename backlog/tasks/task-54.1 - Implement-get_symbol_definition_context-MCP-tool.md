---
id: task-54.1
title: Implement get_symbol_definition_context MCP tool
status: In Progress
assignee:
  - '@claude'
created_date: '2025-07-30'
updated_date: '2025-07-30'
labels: []
dependencies: []
parent_task_id: task-54
---

## Description

Implement the first context-oriented MCP tool that provides rich symbol information without requiring file positions. This tool will resolve symbols by name and return comprehensive context including definition, usage, and relationships.

## Acceptance Criteria

- [x] Symbol resolution by name without position implemented
- [x] TypeScript interfaces defined for request and response
- [x] Basic usage statistics included
- [x] Comprehensive test coverage
- [x] Performance under 200ms for typical queries
- [x] Function call relationships implemented via call-graph API
- [ ] Full definition code extraction (blocked by task-55: enclosing_range bug)
- [x] Documentation extraction from comments/JSDoc
- [ ] Class inheritance and interface implementation relationships

## Implementation Plan

1. Define TypeScript interfaces for SymbolContextRequest and SymbolContextResponse
2. Create symbol resolution logic that finds symbols by name across the project
3. Implement context extraction including definition code and documentation
4. Add usage tracking to count references and categorize them
5. Implement relationship analysis (calls, called by, extends, etc.)
6. Add caching layer for performance optimization
7. Create comprehensive test suite
8. Integrate with MCP server infrastructure

## Implementation Notes

### ✅ COMPLETED FEATURES

1. **Core Symbol Resolution**
   - Symbol lookup by name without positions ✅
   - TypeScript interfaces for request/response ✅
   - Fuzzy matching with suggestions for "symbol not found" ✅
   - Cross-file import and reference tracking ✅
   - Test reference filtering with `includeTests` flag ✅

2. **Context Information**
   - Symbol metadata (name, kind, signature) ✅
   - Basic usage statistics (direct references, imports, tests) ✅
   - Function call relationships via `Project.get_call_graph()` ✅
   - Lines of code metrics via `metadata.line_count` ✅
   - Documentation extraction via `get_source_with_context()` ✅
   - Decorator/annotation extraction ✅

3. **Integration & Testing**
   - MCP server integration with tool registration ✅
   - Comprehensive test suite with 100% pass rate ✅
   - Performance under 200ms for typical queries ✅
   - Removed old position-based tools completely ✅

### 🚫 BLOCKED FEATURES (Core Dependencies)

1. **Full Function Body Extraction** - **BLOCKED by task-55**
   - Issue: `enclosing_range` field is undefined in Def objects
   - Impact: Can only return function signatures, not full implementations
   - Current: Returns signature line only
   - Needed: Fix enclosing_range in core to include full function body

2. **~~Documentation Extraction~~** - **✅ RESOLVED**
   - **UPDATE**: Core DOES provide documentation extraction via `get_source_with_context()`!
   - **Available**: JSDoc extraction for JS/TS, docstring extraction for Python
   - **Available**: Decorator/annotation extraction for all languages
   - **Implemented**: Now extracts documentation and annotations successfully

3. **Class Inheritance Relationships** - **BLOCKED by core limitation**
   - Issue: No API to analyze extends/implements relationships  
   - Impact: `RelationshipInfo.extends/implements` always undefined
   - Current: Returns undefined for non-function symbols
   - Needed: AST traversal utilities for class relationships

### 📝 FILES MODIFIED

- `packages/mcp/src/tools/get_symbol_context.ts` - Main implementation (443 lines)
- `packages/mcp/src/start_server.ts` - Tool integration, removed old tools
- `packages/mcp/tests/get_symbol_context.test.ts` - Test suite (245 lines)
- `packages/mcp/docs/core-limitations.md` - Updated with enclosing_range bug

### 🔍 CORE LIMITATIONS DISCOVERED

1. **enclosing_range Bug** - Most critical, created task-55 to fix
2. **~~Missing documentation extraction APIs~~** - **RESOLVED**: `get_source_with_context()` works perfectly! ✅
3. **Limited relationship analysis** - Function calls work, class inheritance doesn't
4. **Test detection scope** - Works for named functions only, not test blocks

### 🎯 NEXT STEPS

**When task-55 is completed (enclosing_range fix):**

- Implement full function body extraction
- Update tests to verify complete implementations
- Remove workaround using metadata.line_count

**Independent improvements:**

- Smart file loading based on imports (currently loads all files)
- Caching layer for repeated symbol lookups
- Enhanced error handling and validation
