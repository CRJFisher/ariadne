# Task Epic-11.80: Enhance function_calls with Configuration Pattern and Integrations

## Status
Pending

## Parent Epic
Epic 11: Codebase Restructuring

## Description
Refactor function_calls module to use configuration-driven language processing and integrate with enhanced data structures for improved call resolution.

**Note**: This is a parent task. See sub-tasks 11.80.1 through 11.80.5 for implementation details.

## Sub-Tasks

### Configuration Pattern Implementation
- **11.80.1** - Extract language configurations and create generic processor
- **11.80.2** - Preserve bespoke handlers for language-specific features

### Enhanced Data Structure Integration
- **11.80.3** - Integrate scope_tree for local symbol resolution
- **11.80.4** - Integrate import_resolver for external function tracking  
- **11.80.5** - Integrate type_tracker for method call resolution

### Pattern Propagation
- **11.80.6** - Apply configuration pattern to method_calls module
- **11.80.7** - Apply configuration pattern to constructor_calls module

## Overview

This parent task coordinates two major improvements to the call detection system:

1. **Configuration-Driven Refactoring**: Replace 86% of duplicated language-specific code with configuration-based processing
2. **Enhanced Integration**: Add data structures from TODO comments for improved call resolution

## Implementation Strategy

### Phase 1: Configuration Pattern
Sub-tasks 11.80.1 and 11.80.2 establish the configuration-driven approach, extracting common patterns while preserving necessary language-specific logic.

### Phase 2: Enhanced Integration  
Sub-tasks 11.80.3, 11.80.4, and 11.80.5 integrate the data structures mentioned in the TODO comments for improved call resolution.

### Phase 3: Pattern Propagation
Sub-tasks 11.80.6 and 11.80.7 apply the proven pattern to related modules.

## Expected Outcomes

### Code Reduction
- Current: ~747 lines across 4 language files
- After refactor: ~247 lines (67% reduction)
- Better maintainability and consistency

### Enhanced Capabilities
- Accurate cross-file call resolution
- Import-aware function call tracking
- Type-informed method call detection
- Scope-aware local function resolution

## Success Criteria
- [ ] All existing tests pass without modification
- [ ] 60%+ code reduction achieved
- [ ] Enhanced resolution using integrated data structures
- [ ] Clear separation of generic vs bespoke logic
- [ ] Documentation updated to reflect new pattern

## Related Files
- `/packages/core/src/call_graph/function_calls/`
- `/packages/core/src/call_graph/method_calls/` (apply pattern here too)
- `/packages/core/src/call_graph/constructor_calls/` (apply pattern here too)
- `/docs/Architecture.md` (configuration-driven pattern documentation)

## Notes
This refactoring establishes a pattern that can be applied across multiple language-specific modules in the codebase, significantly reducing duplication and improving maintainability.
