# Folder Structure Review - Post-Restructuring Analysis

## Executive Summary

This document reviews the current `packages/core/src/` folder structure against the Architecture.md specification, identifying unused modules, redundancies, and opportunities for enhancement.

## Current vs Required Structure

### ✅ Actively Used Modules (Wired into CodeGraph)

#### Stage 1: Per-File Analysis

- ✅ `/scope_analysis/scope_tree` - Building scope trees
- ✅ `/call_graph/function_calls` - Finding function calls
- ✅ `/call_graph/method_calls` - Finding method calls
- ✅ `/call_graph/constructor_calls` - Finding constructor calls
- ✅ `/import_export/import_resolution` - Extracting imports (partially stubbed)
- ✅ `/import_export/export_detection` - Detecting exports
- ✅ `/type_analysis/type_tracking` - Tracking types (stubbed)

#### Stage 2: Global Assembly

- ✅ `/import_export/module_graph` - Building module dependency graph
- ⚠️ `/import_export/namespace_resolution` - Exists but not wired
- ⚠️ `/scope_analysis/symbol_resolution` - Exists but not wired
- ⚠️ `/call_graph/call_chain_analysis` - Exists but not wired

#### Supporting Infrastructure

- ✅ `/project/file_scanner.ts` - File scanning and parsing
- ✅ `/ast` - AST utilities for tree-sitter
- ✅ `/utils` - General utilities

### 🔴 Unused/Redundant Modules

#### Duplicate Inheritance Structures

**Issue**: Two parallel inheritance hierarchies exist

- `/inheritance/class_detection/` - New placeholder (not wired)
- `/inheritance_analysis/` - Existing structure with FULL implementations:
  - `/class_hierarchy` - Has language-specific implementations (JS, Python, Rust)
  - `/interface_implementation` - TypeScript-specific interface handling
  - `/method_override` - Method override detection

**Critical Finding**: The `/inheritance_analysis/class_hierarchy/` has complete, tested implementations for building class hierarchies but is NOT being used. The code_graph.ts has a stub returning empty ClassHierarchy.

**Recommendation**:

- Delete `/inheritance/` folder (just placeholder)
- Rename `/inheritance_analysis/` to `/inheritance/`
- **IMMEDIATELY wire up** the existing `build_class_hierarchy` function - this is working code being wasted
- Use existing language-specific implementations instead of creating new ones

#### Redundant Scope Modules

**Issue**: Overlapping scope functionality

- ~~`/scope_queries/`~~ - **COMPLETED**: Successfully moved to `scope_analysis/scope_tree/queries/`
- `/scope_analysis/definition_finder/` - Not directly used
- `/scope_analysis/usage_finder/` - Not directly used

**Recommendation**:

- ✅ ~~Delete `/scope_queries/` if truly redundant~~ - **DONE**: Moved to proper module structure
- Keep `definition_finder` and `usage_finder` - they could enhance symbol resolution

#### Storage Layer

**Issue**: Storage modules not integrated with new architecture

- `/storage/` - Full storage abstraction layer
  - `/cache_layer`
  - `/disk_storage`
  - `/memory_storage`
- `/storage/storage_interface.ts` - Defines StoredFile, ProjectState

**Current Status**: Not used in new CodeGraph architecture
**Recommendation**: Keep for future incremental update support, but mark as "not currently integrated"

#### Project Management

**Issue**: Project management layer partially obsolete

- `/project/file_tracker/` - File change tracking
- `/project/incremental_updates/` - Incremental parsing
- `/project/project_manager/` - Project lifecycle

**Current Status**: Only `file_scanner.ts` is used
**Recommendation**: Keep for future incremental analysis, mark as "future enhancement"

#### Integration Tests

- `/integration/` - Integration test utilities

**Recommendation**: Keep for testing infrastructure

### 🟡 Modules Needing Implementation

These exist but need implementation or wiring:

1. **Class Detection** (`/inheritance/class_detection/`)

   - Status: Placeholder created
   - Task: epic-11.51
   - Note: Should use existing `/inheritance_analysis/` code

3. **Symbol Resolution** (`/scope_analysis/symbol_resolution/`)

   - Status: Exists but not wired
   - Could be wired to build SymbolIndex

4. **Call Chain Analysis** (`/call_graph/call_chain_analysis/`)

   - Status: Exists but not wired
   - Could enhance CallGraph with chain analysis

5. **Namespace Resolution** (`/import_export/namespace_resolution/`)
   - Status: Exists but not wired
   - Needed for proper namespace import handling

### 🔧 Additional Unused Modules (Potential Enhancements)

These modules exist but aren't mentioned in the architecture:

1. **Type Analysis Extensions**

   - `/type_analysis/parameter_type_inference/` - Could infer parameter types
   - `/type_analysis/return_type_inference/` - Could infer return types
   - `/type_analysis/type_propagation/` - Could propagate types through code

   **Potential**: These could significantly enhance TypeIndex accuracy

2. **Scope Analysis Extensions**

   - `/scope_analysis/definition_finder/` - Find symbol definitions
   - `/scope_analysis/usage_finder/` - Find symbol usages

   **Potential**: These could enhance SymbolIndex building

## Recommended Actions

### Immediate Cleanup

1. **Delete** `/inheritance/class_detection/` (empty placeholder)
2. **Rename** `/inheritance_analysis/` → `/inheritance/`
3. ✅ ~~**Delete** `/scope_queries/` (if truly redundant with scope_analysis)~~ - **COMPLETED**: Moved to `scope_analysis/scope_tree/queries/`
4. **Move** leftover test files to proper test directories

### Wire Up Existing Code

1. **Wire** `/inheritance_analysis/class_hierarchy/` into Stage 2
2. **Wire** `/scope_analysis/symbol_resolution/` into Stage 2
3. **Wire** `/call_graph/call_chain_analysis/` into Stage 2
4. **Wire** `/import_export/namespace_resolution/` into Stage 2

### Future Enhancements (Keep but Mark as Future)

1. **Storage Layer** - For incremental updates
2. **Project Management** - For file watching/tracking
3. **Type Inference Modules** - For better type analysis
4. **Definition/Usage Finders** - For better symbol analysis

### Implementation Tasks

1. Implement class detection using existing inheritance_analysis code (task epic-11.51)

## File Organization Issues

### Misplaced Files

- `/project/incremental_updates/updater.test.ts` - Should be in **tests** folder

### Top-Level Files (Correct)

- `code_graph.ts` - Main API implementation ✅
- `graph_queries.ts` - Query functions ✅
- `index.ts` - Public exports ✅
- `example.ts` - Usage examples ✅

## Priority Actions

### 🚨 Critical (Do Immediately)

1. **Wire up `/inheritance_analysis/class_hierarchy/`** - Complete working code sitting unused!
2. **Delete `/inheritance/class_detection/`** - Empty placeholder duplicating existing functionality
3. **Rename `/inheritance_analysis/` → `/inheritance/`** - Fix naming consistency

### ⚠️ High Priority (Do Soon)

1. Wire up `/scope_analysis/symbol_resolution/` for SymbolIndex
2. Wire up `/call_graph/call_chain_analysis/` for CallGraph chains
3. Wire up `/import_export/namespace_resolution/` for namespace imports
4. Move test files to proper locations

### 📋 Medium Priority (Plan For)

1. Integrate type inference modules for better accuracy
2. Consider integrating storage layer for incremental updates

## Summary

The codebase has significant unused infrastructure from the previous architecture. Much of it (storage, project management, type inference) could enhance the new architecture but isn't currently wired. The main issues are:

1. **Duplicate inheritance structures** - Need consolidation
2. **Unwired Stage 2 modules** - Several exist but aren't connected
3. **Working code not being used** - Especially class_hierarchy!
4. **Storage/project layers** - Valuable for incremental updates but not integrated
5. **Type inference modules** - Could significantly improve type analysis

Most "unused" code represents future enhancement opportunities rather than true dead code. The most critical issue is that we have complete, working implementations (like class_hierarchy) that aren't being used while we create stubs and placeholders for the same functionality.
