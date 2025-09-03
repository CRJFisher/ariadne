# Module Inventory

## Overview

This document inventories all top-level modules in `packages/core/src` and their integration status with the processing pipeline. It serves as a sister document to `PROCESSING_PIPELINE.md`, focusing on the implementation reality vs the architectural design.

## Integration Status Summary

**Wired into Processing**: 13 modules (35%)
**Not Wired**: 24 modules (65%)

---

## Module Analysis

### 1. scope_analysis/scope_tree ✅ WIRED

**Current Integration**: Layer 1 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 1 - Scope Analysis
**Purpose**: Builds hierarchical scope structure with symbols
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 2. import_export/import_resolution ✅ WIRED

**Current Integration**: Layer 2 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 2 - Local Structure Detection
**Purpose**: Extracts import declarations
**Implementation**: Complete with language dispatchers
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 3. import_export/export_detection ✅ WIRED

**Current Integration**: Layer 2 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 2 - Local Structure Detection
**Purpose**: Detects export statements
**Implementation**: Complete with language dispatchers
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 4. inheritance/class_detection ✅ WIRED

**Current Integration**: Layer 2 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 2 - Local Structure Detection
**Purpose**: Finds class definitions
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 5. type_analysis/type_tracking ✅ WIRED

**Current Integration**: Layer 3 in `file_analyzer.ts` (imported but not fully used)
**Pipeline Position**: Per-File Phase, Layer 3 - Local Type Analysis
**Purpose**: Tracks variable types within file scope
**Implementation**: Complete
**Duplication**: Some overlap with type_registry for type storage
**Next Steps**: Better integrate with per-file analysis flow

---

### 6. call_graph/function_calls ✅ WIRED

**Current Integration**: Layer 4 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 4 - Local Call Analysis
**Purpose**: Finds function calls
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 7. call_graph/method_calls ✅ WIRED

**Current Integration**: Layer 4 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 4 - Local Call Analysis
**Purpose**: Finds method calls with receiver types
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 8. call_graph/constructor_calls ✅ WIRED

**Current Integration**: Layer 4 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 4 - Local Call Analysis
**Purpose**: Finds constructor calls
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 9. variable_analysis/variable_extraction ✅ WIRED

**Current Integration**: Layer 5 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 5 - Variable Extraction
**Purpose**: Extracts variable declarations
**Implementation**: Complete
**Duplication**: Some overlap with scope_tree which also tracks variables
**Next Steps**: Consider merging with scope analysis

---

### 10. import_export/module_graph ✅ WIRED

**Current Integration**: Used in `code_graph.ts`
**Pipeline Position**: Global Assembly Phase, Layer 5 - Module Graph Construction
**Purpose**: Builds module dependency graph
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 11. type_analysis/type_registry ✅ WIRED

**Current Integration**: Used in `code_graph.ts`
**Pipeline Position**: Global Assembly Phase, Layer 6 - Type Registry
**Purpose**: Central registry for all type definitions
**Implementation**: Complete - "critical missing piece" now implemented
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 12. inheritance/class_hierarchy ✅ WIRED

**Current Integration**: Used in `code_graph.ts` via `build_class_hierarchy`
**Pipeline Position**: Global Assembly Phase, Layer 6 - Class Hierarchy
**Purpose**: Builds inheritance tree
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 13. scope_analysis/symbol_resolution ✅ WIRED

**Current Integration**: Used in `code_graph.ts`
**Pipeline Position**: Global Assembly Phase, Layer 8 & 9 - Symbol Resolution
**Purpose**: Resolves symbols across files
**Implementation**: Complete
**Duplication**: Overlaps with definition_finder - both find definitions
**Next Steps**: Consider merging with definition_finder

---

## NOT WIRED MODULES

### 14. call_graph/call_chain_analysis ❌ NOT WIRED

**Should Be**: Enrichment Phase - Call Graph Completion
**Purpose**: Traces complete call chains
**Implementation**: Complete
**Duplication**: Partially integrated via `build_call_chains` direct import
**Next Steps**: Properly integrate through index.ts

---

### 15. call_graph/call_resolution ❌ NOT WIRED

**Should Be**: Global Assembly Phase, Layer 9 - Global Call Resolution
**Purpose**: Resolves method/constructor calls using hierarchy
**Implementation**: Complete
**Duplication**: Functionality partially covered by enrichment functions
**Next Steps**: Wire into main flow after class hierarchy

---

### 16. import_export/namespace_resolution ❌ NOT WIRED

**Should Be**: Global Assembly Phase, Layer 7 - Cross-File Type Resolution
**Purpose**: Resolves namespace members
**Implementation**: Complete dispatcher
**Duplication**: None
**Next Steps**: Wire into type resolution phase

---

### 17. inheritance/interface_implementation ❌ NOT WIRED

**Should Be**: Global Assembly Phase, Layer 6 - with Class Hierarchy
**Purpose**: Tracks interface implementations
**Implementation**: Complete
**Duplication**: None
**Next Steps**: Wire alongside class hierarchy building

---

### 18. inheritance/method_override ❌ NOT WIRED

**Should Be**: Global Assembly Phase, Layer 6 - with Class Hierarchy
**Purpose**: Detects method overrides
**Implementation**: Complete
**Duplication**: Some overlap with class hierarchy's override tracking
**Next Steps**: Wire alongside class hierarchy building

---

### 19. project/file_tracker ❌ NOT WIRED

**Should Be**: Foundation layer before per-file analysis
**Purpose**: Tracks file changes
**Implementation**: Complete
**Duplication**: Some overlap with file_scanner
**Next Steps**: Consider for incremental analysis support

---

### 20. project/incremental_updates ❌ NOT WIRED

**Should Be**: Orchestration layer for incremental processing
**Purpose**: Handles incremental updates
**Implementation**: Stub only
**Duplication**: None
**Next Steps**: Implement for performance improvement

---

### 21. project/project_manager ❌ NOT WIRED

**Should Be**: Top-level orchestration
**Purpose**: Central project management
**Implementation**: Complete
**Duplication**: Overlaps with options passed to generate_code_graph
**Next Steps**: Consider as alternative entry point

---

### 22. scope_analysis/definition_finder ❌ NOT WIRED

**Should Be**: Already covered by symbol_resolution
**Purpose**: Finds definitions with scope context
**Implementation**: Complete
**Duplication**: SIGNIFICANT - overlaps with symbol_resolution
**Next Steps**: DEPRECATE or merge with symbol_resolution

---

### 23. scope_analysis/usage_finder ❌ NOT WIRED

**Should Be**: Per-File Phase, Layer 1 - with Scope Analysis
**Purpose**: Finds symbol usages
**Implementation**: Complete
**Duplication**: Partially covered by scope_tree
**Next Steps**: Wire into scope analysis layer

---

### 24. storage/cache_layer ❌ NOT WIRED

**Should Be**: Cross-cutting concern for all phases
**Purpose**: TTL-based caching
**Implementation**: Complete interface
**Duplication**: None
**Next Steps**: Wire for performance improvement

---

### 25. storage/disk_storage ❌ NOT WIRED

**Should Be**: Optional persistence layer
**Purpose**: Persistent file storage
**Implementation**: Complete interface
**Duplication**: None
**Next Steps**: Wire for persistent caching

---

### 26. storage/memory_storage ❌ NOT WIRED

**Should Be**: Default storage backend
**Purpose**: In-memory storage
**Implementation**: Complete
**Duplication**: None
**Next Steps**: Wire as default storage

---

### 27. type_analysis/generic_resolution ❌ NOT WIRED

**Should Be**: Global Assembly Phase, Layer 7 - Type Resolution
**Purpose**: Resolves generic type parameters
**Implementation**: Complete
**Duplication**: None
**Next Steps**: Critical gap - wire into type resolution

---

### 28. type_analysis/parameter_type_inference ❌ NOT WIRED

**Should Be**: Per-File Phase, Layer 3 - Local Type Analysis
**Purpose**: Infers parameter types
**Implementation**: Complete
**Duplication**: Partially done in return_type_inference
**Next Steps**: Wire into file_analyzer Layer 3

---

### 29. type_analysis/return_type_inference ❌ NOT WIRED

**Should Be**: Per-File Phase, Layer 3 - Local Type Analysis
**Purpose**: Infers return types
**Implementation**: Complete
**Duplication**: None
**Next Steps**: Wire into file_analyzer Layer 3

---

### 30. type_analysis/type_propagation ❌ NOT WIRED

**Should Be**: Global Assembly Phase, Layer 7 - Type Resolution
**Purpose**: Propagates types through data flow
**Implementation**: Complete
**Duplication**: None
**Next Steps**: Wire into global type resolution

---

### 31. utils ❌ NOT WIRED (partially)

**Current Integration**: Some utilities imported directly
**Purpose**: Shared utilities
**Implementation**: Complete
**Duplication**: None
**Next Steps**: Use index.ts exports consistently

---

### 33. ast/\* ❌ NOT WIRED

**Should Be**: Foundation utilities
**Purpose**: AST utilities
**Implementation**: Complete but no index.ts
**Duplication**: None
**Next Steps**: Add index.ts, use throughout

---

### 34. definition_extraction/\* ❌ NOT WIRED

**Should Be**: Per-File Phase, Layer 6
**Purpose**: Extract definitions
**Implementation**: Partial
**Duplication**: Covered by scope_tree and class_detection
**Next Steps**: DEPRECATE - functionality covered elsewhere

---

### 35. error_collection/\* ❌ NOT WIRED

**Should Be**: Cross-cutting concern
**Purpose**: Error collection
**Implementation**: Complete but unused
**Duplication**: None
**Next Steps**: Wire error collection throughout

---

### 36. scope_queries/\* ❌ NOT WIRED

**Should Be**: Query interface layer
**Purpose**: Query scope data
**Implementation**: Minimal
**Duplication**: None
**Next Steps**: Consider for query API

---

### 37. project/file_scanner ✅ WIRED (directly)

**Current Integration**: Used directly in `code_graph.ts`
**Purpose**: Scans files in project
**Implementation**: Complete
**Duplication**: Some with file_tracker
**Next Steps**: None - properly integrated

---

## Critical Findings

### Duplication Issues

1. **scope_analysis/definition_finder vs symbol_resolution**: Both find definitions. Symbol_resolution is more complete and already wired.

2. **variable_analysis vs scope_tree**: Both track variables. Scope_tree is more integrated.

3. **call_resolution vs enrichment functions**: Enrichment functions directly handle what call_resolution should do.

### Missing Critical Wiring

1. **Generic type resolution** - Complete but not wired
2. **Type propagation** - Complete but not wired
3. **Parameter/return type inference** - Complete but not wired
4. **Namespace resolution** - Complete but not wired
5. **Interface tracking** - Complete but not wired

### Architecture Gaps

1. **No incremental processing** despite having modules for it
2. **No caching layer** active despite complete implementations
3. **No error collection** active despite infrastructure
4. **Query layer** exists but unused

---

## Recommendations

### Immediate Actions

1. **DELETE/DEPRECATE**:

   - `definition_extraction/` - covered by other modules
   - `scope_analysis/definition_finder` - duplicates symbol_resolution

2. **WIRE CRITICAL TYPE FEATURES**:

   - `type_analysis/generic_resolution`
   - `type_analysis/type_propagation`
   - `type_analysis/parameter_type_inference`
   - `type_analysis/return_type_inference`
   - `import_export/namespace_resolution`

3. **CONSOLIDATE**:
   - Merge variable_analysis into scope_tree
   - Merge definition_finder into symbol_resolution
   - Standardize on enrichment pattern vs call_resolution

### Medium Term

1. **Add Caching**: Wire storage layers for performance
2. **Add Error Collection**: Wire error_collection throughout
3. **Incremental Processing**: Implement incremental_updates

### Long Term

1. **Query API**: Build on scope_queries
2. **Project Manager**: Consider as alternative orchestration
3. **AST Module**: Formalize with index.ts

---

## Module Categories

### ✅ Core Pipeline (Properly Wired)

- scope_tree, import/export detection, class detection
- function/method/constructor calls
- module_graph, type_registry, class_hierarchy

### ⚠️ Complete but Unwired (Priority)

- Type analysis modules (generic, propagation, inference)
- Namespace resolution
- Interface/override detection

### 🔄 Duplicated Functionality (Consolidate)

- definition_finder → symbol_resolution
- variable_analysis → scope_tree

### 📦 Infrastructure (Future)

- Storage layers
- Project management
- Incremental updates

### ❌ Deprecated (Remove)

- definition_extraction
