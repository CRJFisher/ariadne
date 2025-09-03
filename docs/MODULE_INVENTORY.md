# Module Inventory

## Overview

This document inventories all modules in `packages/core/src` and their integration status with the processing pipeline. Updated after epic 11.74 refactoring.

## Integration Status Summary

**Wired into Processing**: 22 modules (63%)
**Not Wired**: 13 modules (37%)
**Removed in 11.74**: 5 modules

---

## Changes from Epic 11.74

### Removed Modules

1. **variable_analysis/** - Merged into scope_tree
2. **definition_extraction/** - Functionality moved to scope_tree/class_detection
3. **type_resolution/** - Merged into type_registry
4. **call_graph/call_resolution/** - Merged into enrichment pattern
5. **scope_analysis/definition_finder/** - Merged into symbol_resolution

### New Modules

1. **call_graph/enrichment/** - Standardized enrichment pattern
2. **ast/member_access/** - Namespace member access support

### Newly Wired

1. **type_analysis/parameter_type_inference** - Layer 3 in file_analyzer
2. **type_analysis/return_type_inference** - Layer 3 in file_analyzer  
3. **type_analysis/generic_resolution** - Global phase in code_graph
4. **type_analysis/type_propagation** - Global phase in code_graph
5. **ast/member_access** - Namespace resolution in code_graph

---

## Module Analysis

### 1. scope_analysis/scope_tree ✅ WIRED

**Current Integration**: Layer 1 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 1 - Scope Analysis
**Purpose**: Builds hierarchical scope structure with symbols
**Implementation**: Complete with variable extraction
**Duplication**: None (absorbs variable_analysis functionality)
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

**Current Integration**: Layer 3 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 3 - Local Type Analysis
**Purpose**: Tracks variable types within file scope
**Implementation**: Complete with language support
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 6. type_analysis/parameter_type_inference ✅ WIRED

**Current Integration**: Layer 3 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 3 - Local Type Analysis
**Purpose**: Infers parameter types from usage and defaults
**Implementation**: Complete with confidence scoring
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 7. type_analysis/return_type_inference ✅ WIRED

**Current Integration**: Layer 3 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 3 - Local Type Analysis
**Purpose**: Infers return types from function bodies
**Implementation**: Complete with async/generator support
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 8. call_graph/function_calls ✅ WIRED

**Current Integration**: Layer 4 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 4 - Local Call Analysis
**Purpose**: Finds function calls
**Implementation**: Complete with language dispatchers
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 9. call_graph/method_calls ✅ WIRED

**Current Integration**: Layer 4 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 4 - Local Call Analysis
**Purpose**: Finds method calls with receiver types
**Implementation**: Complete with hierarchy resolver
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 10. call_graph/constructor_calls ✅ WIRED

**Current Integration**: Layer 4 in `file_analyzer.ts`
**Pipeline Position**: Per-File Phase, Layer 4 - Local Call Analysis
**Purpose**: Finds constructor calls with type extraction
**Implementation**: Complete with type resolver
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 11. import_export/module_graph ✅ WIRED

**Current Integration**: Used in `code_graph.ts`
**Pipeline Position**: Global Assembly Phase, Layer 5 - Module Graph Construction
**Purpose**: Builds module dependency graph
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 12. type_analysis/type_registry ✅ WIRED

**Current Integration**: Used in `code_graph.ts`
**Pipeline Position**: Global Assembly Phase, Layer 6 - Type Registry
**Purpose**: Central registry for all type definitions
**Implementation**: Complete with proper TypeKind enum
**Duplication**: None (absorbed type_resolution functionality)
**Next Steps**: None - properly integrated

---

### 13. inheritance/class_hierarchy ✅ WIRED

**Current Integration**: Used in `code_graph.ts`
**Pipeline Position**: Global Assembly Phase, Layer 6 - Class Hierarchy
**Purpose**: Builds inheritance tree
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 14. type_analysis/generic_resolution ✅ WIRED

**Current Integration**: Used in `code_graph.ts`
**Pipeline Position**: Global Assembly Phase, Layer 7 - Type Resolution
**Purpose**: Resolves generic type parameters
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 15. type_analysis/type_propagation ✅ WIRED

**Current Integration**: Used in `code_graph.ts`
**Pipeline Position**: Global Assembly Phase, Layer 7b - Type Propagation
**Purpose**: Propagates types through data flow
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 16. ast/member_access ✅ WIRED

**Current Integration**: Used in `code_graph.ts` for namespace resolution
**Pipeline Position**: Global Assembly Phase, Layer 7c - Namespace Resolution
**Purpose**: Finds member access expressions for namespace resolution
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 17. call_graph/enrichment ✅ WIRED

**Current Integration**: Used in `code_graph.ts`
**Pipeline Position**: Global Assembly Phase, Layer 7d - Call Enrichment
**Purpose**: Unified enrichment pattern for all call types
**Implementation**: Complete (replaces call_resolution)
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 18. scope_analysis/symbol_resolution ✅ WIRED

**Current Integration**: Used in `code_graph.ts`
**Pipeline Position**: Global Assembly Phase, Layer 8 & 9 - Symbol Resolution
**Purpose**: Resolves symbols across files
**Implementation**: Complete (absorbed definition_finder)
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 19. call_graph/call_chain_analysis ✅ WIRED

**Current Integration**: Used in `code_graph.ts`
**Pipeline Position**: Call Graph Completion
**Purpose**: Traces complete call chains
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 20. project/file_scanner ✅ WIRED

**Current Integration**: Used directly in `code_graph.ts`
**Pipeline Position**: Foundation - File Discovery
**Purpose**: Scans files in project
**Implementation**: Complete
**Duplication**: Some with file_tracker
**Next Steps**: None - properly integrated

---

### 21. utils ✅ WIRED

**Current Integration**: Used throughout codebase
**Purpose**: Shared utilities
**Implementation**: Complete with index.ts
**Duplication**: None
**Next Steps**: None - properly integrated

---

### 22. type_analysis/type_adapters ✅ WIRED

**Current Integration**: Used in `file_analyzer.ts`
**Purpose**: Type conversion utilities
**Implementation**: Complete
**Duplication**: None
**Next Steps**: None - properly integrated

---

## NOT WIRED MODULES

### 23. import_export/namespace_resolution ❌ NOT WIRED (directly)

**Should Be**: Global Assembly Phase, Layer 7 - Cross-File Type Resolution
**Purpose**: Resolves namespace members
**Implementation**: Complete dispatcher
**Note**: Partially used inline in code_graph.ts but not via index exports
**Next Steps**: Consider using index exports for consistency

---

### 24. inheritance/interface_implementation ❌ NOT WIRED

**Should Be**: Global Assembly Phase, Layer 6 - with Class Hierarchy
**Purpose**: Tracks interface implementations
**Implementation**: Complete
**Duplication**: None
**Next Steps**: Wire alongside class hierarchy building

---

### 25. inheritance/method_override ❌ NOT WIRED

**Should Be**: Global Assembly Phase, Layer 6 - with Class Hierarchy
**Purpose**: Detects method overrides
**Implementation**: Complete
**Duplication**: Some overlap with class hierarchy's override tracking
**Next Steps**: Wire alongside class hierarchy building

---

### 26. project/file_tracker ❌ NOT WIRED

**Should Be**: Foundation layer before per-file analysis
**Purpose**: Tracks file changes
**Implementation**: Complete
**Duplication**: Some overlap with file_scanner
**Next Steps**: Consider for incremental analysis support

---

### 27. project/incremental_updates ❌ NOT WIRED

**Should Be**: Orchestration layer for incremental processing
**Purpose**: Handles incremental updates
**Implementation**: Stub only
**Duplication**: None
**Next Steps**: Implement for performance improvement

---

### 28. project/project_manager ❌ NOT WIRED

**Should Be**: Top-level orchestration
**Purpose**: Central project management
**Implementation**: Complete
**Duplication**: Overlaps with options passed to generate_code_graph
**Next Steps**: Consider as alternative entry point

---

### 29. scope_analysis/usage_finder ❌ NOT WIRED

**Should Be**: Per-File Phase, Layer 1 - with Scope Analysis
**Purpose**: Finds symbol usages
**Implementation**: Complete
**Duplication**: Partially covered by scope_tree
**Next Steps**: Wire into scope analysis layer

---

### 30. storage/cache_layer ❌ NOT WIRED

**Should Be**: Cross-cutting concern for all phases
**Purpose**: TTL-based caching
**Implementation**: Complete interface
**Duplication**: None
**Next Steps**: Wire for performance improvement

---

### 31. storage/disk_storage ❌ NOT WIRED

**Should Be**: Optional persistence layer
**Purpose**: Persistent file storage
**Implementation**: Complete interface
**Duplication**: None
**Next Steps**: Wire for persistent caching

---

### 32. storage/memory_storage ❌ NOT WIRED

**Should Be**: Default storage backend
**Purpose**: In-memory storage
**Implementation**: Complete
**Duplication**: None
**Next Steps**: Wire as default storage

---

### 33. error_collection/analysis_errors ❌ NOT WIRED

**Should Be**: Cross-cutting concern
**Purpose**: Error collection
**Implementation**: Complete but unused
**Duplication**: None
**Next Steps**: Wire error collection throughout

---

### 34. scope_queries/ ❌ NOT WIRED

**Should Be**: Query interface layer
**Purpose**: Query scope data
**Implementation**: Minimal
**Duplication**: None
**Next Steps**: Consider for query API

---

### 35. scope_analysis/scope_entity_connections ❌ NOT WIRED

**Should Be**: Layer 7 Symbol Registration
**Purpose**: Connect scopes to entities
**Implementation**: Complete
**Duplication**: None
**Next Steps**: Wire into symbol registration

---

## Critical Findings

### Major Improvements from 11.74

1. **Consolidation Success**: Removed 5 redundant modules, merging functionality into appropriate locations
2. **Type Analysis Complete**: All type inference and resolution modules now wired
3. **Enrichment Pattern**: New standardized enrichment replaced scattered call resolution
4. **Integration Rate**: Increased from 35% to 63% wired modules

### Remaining Gaps

1. **Interface/Override Detection**: Complete but not wired
2. **Storage Layer**: No caching or persistence active
3. **Incremental Processing**: Infrastructure exists but not implemented
4. **Error Collection**: Complete but unused

### Architecture Strengths

1. **Clear Phase Separation**: Per-file → Global → Enrichment
2. **Language Support**: Consistent dispatcher pattern
3. **Type Flow**: Bidirectional type tracking working
4. **Symbol Resolution**: Comprehensive cross-file resolution

---

## Recommendations

### Immediate Actions

1. **Wire Interface Tracking**: Add interface_implementation and method_override
2. **Complete Namespace**: Use namespace_resolution index exports
3. **Add Error Collection**: Wire error_collection throughout

### Medium Term

1. **Add Caching**: Wire storage layers for performance
2. **Incremental Processing**: Implement incremental_updates
3. **Query API**: Build on scope_queries

### Long Term

1. **Project Manager**: Consider as alternative orchestration
2. **Performance**: Add persistent caching with disk_storage
3. **Monitoring**: Add metrics collection

---

## Module Categories

### ✅ Core Pipeline (Properly Wired) - 22 modules

- All scope, import/export, class detection
- All call analysis (function/method/constructor)
- Type registry, hierarchy, inference, resolution
- Module graph and symbol resolution
- Enrichment pattern

### ⚠️ Complete but Unwired (Priority) - 6 modules

- Interface/override detection
- Storage layers
- Error collection
- Scope entity connections

### 📦 Infrastructure (Future) - 5 modules

- Project management
- Incremental updates
- Query interface
- File tracking

### 🎯 Success Metrics

- **63%** modules wired (up from 35%)
- **100%** type analysis wired
- **100%** call analysis wired
- **5** redundant modules removed
- **2** new focused modules added
