# Epic 11 - Restructured Task List

## Overview

Epic 11 has been restructured based on the comprehensive PROCESSING_PIPELINE.md document. All old migration tasks have been archived, and new tasks focus on implementing the missing pieces of the processing pipeline architecture.

## Task Organization

### Archived Tasks
All incomplete tasks (11.1-11.53) have been moved to `/archived/` folder.
Completed tasks have been moved to `/backlog/tasks/completed/` folder.

### New Task Structure (11.60-11.68)

The new tasks are organized by priority and dependencies to implement the processing pipeline architecture properly.

## New Tasks

### Critical Infrastructure (Must Do First)

#### task-epic-11.60: Implement Class Detection Module
- **Priority**: CRITICAL
- **Layer**: 2 (Per-File Analysis)
- **Problem**: Module is referenced in Architecture.md but doesn't exist
- **Impact**: Class hierarchy and type registry have no input without this

#### task-epic-11.61: Complete Type Registry Implementation  
- **Priority**: CRITICAL
- **Layer**: 6 (Global Assembly)
- **Problem**: No central type definition storage
- **Impact**: Cannot resolve types across files
- **Dependencies**: Needs class_detection (11.60)

### Integration & Wiring

#### task-epic-11.62: Wire Processing Layer Dependencies
- **Priority**: HIGH
- **Problem**: Modules work in isolation, missing connections
- **Scope**: Wire 6 critical dependencies that have TODOs but no actual code
- **Dependencies**: Needs 11.60, 11.61

#### task-epic-11.63: Remove Import Extraction Duplication
- **Priority**: HIGH
- **Problem**: Both import_resolution and symbol_resolution extract imports
- **Impact**: Violates single responsibility, potential inconsistencies

### Missing Functionality

#### task-epic-11.64: Implement Generic Type Resolution
- **Priority**: MEDIUM
- **Layers**: 3 & 7
- **Problem**: No handling of generic/template types
- **Impact**: Type tracking fails for generic code

#### task-epic-11.65: Implement Async Flow Analysis
- **Priority**: MEDIUM  
- **Layers**: 4 & 9
- **Problem**: Cannot trace async/await or Promise chains
- **Impact**: Call chains break at async boundaries

#### task-epic-11.66: Implement Virtual Method Resolution
- **Priority**: MEDIUM
- **Layer**: 9
- **Problem**: Cannot resolve polymorphic method calls
- **Impact**: Missing overridden methods in call graph

### Code Quality

#### task-epic-11.67: Consolidate Types to @ariadnejs/types
- **Priority**: MEDIUM
- **Problem**: Many modules still use local type definitions
- **Scope**: Systematic migration to shared types package

### Verification

#### task-epic-11.68: Verify and Test Complete Processing Pipeline
- **Priority**: LOW (Do Last)
- **Scope**: End-to-end integration testing
- **Dependencies**: All other tasks (11.60-11.67)

## Implementation Order

1. **Phase 1 - Critical Infrastructure**
   - task-epic-11.60 (class_detection)
   - task-epic-11.61 (type_registry)

2. **Phase 2 - Integration**
   - task-epic-11.62 (wire dependencies)
   - task-epic-11.63 (remove duplication)

3. **Phase 3 - Missing Features**
   - task-epic-11.64 (generics)
   - task-epic-11.65 (async)
   - task-epic-11.66 (virtual methods)

4. **Phase 4 - Quality**
   - task-epic-11.67 (type consolidation)

5. **Phase 5 - Verification**
   - task-epic-11.68 (integration testing)

## Key Improvements Over Old Structure

1. **Architecture-Driven**: Tasks derived from PROCESSING_PIPELINE.md gaps
2. **Clear Dependencies**: Explicit layer dependencies and data flow
3. **Rich Context**: Each task includes why it's needed and impact
4. **Type Safety**: Emphasis on using @ariadnejs/types throughout
5. **Testing Focus**: Every task includes comprehensive test requirements

## Success Criteria

When all tasks are complete:
- Two-phase processing architecture fully implemented
- All layers properly connected with correct data flow
- No duplicate functionality between modules
- Cross-file analysis works correctly
- All 4 languages (JS, TS, Python, Rust) supported
- Performance targets met (<100ms per file)
- Complete test coverage

## Reference Documents

- `/docs/PROCESSING_PIPELINE.md` - The architectural blueprint
- `/packages/core/ARCHITECTURE_ISSUES.md` - Problems to solve
- `/packages/core/LAYER_INTERFACES.md` - Data contracts between layers
- `/docs/Architecture.md` - Overall system architecture