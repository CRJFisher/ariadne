# Task Epic-11.80: Configuration-Driven Refactoring Overview

## Summary

Complete refactoring of 18 modules from language-specific implementations to configuration-driven pattern, following the recipe established in function_calls refactoring (70% code reduction achieved). Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide for each module.

## Status

- ✅ **COMPLETED**: function_calls (task epic-11.80.1-11.80.7) - 70% reduction achieved

## Modules Requiring Refactoring

### HIGH PRIORITY - Call Graph Modules

Similar to function_calls, high duplication, clear ROI:

- **task-epic-11.81**: method_calls (1,446 lines → ~450 expected)
- **task-epic-11.82**: constructor_calls (1,152 lines → ~350 expected)

### HIGH PRIORITY - Import/Export Modules

Critical for dependency analysis, clear patterns:

- **task-epic-11.83**: import_resolution (998 lines → ~350 expected)
- **task-epic-11.84**: export_detection (1,252 lines → ~375 expected)
- **task-epic-11.87**: namespace_resolution (4 language files)

### MEDIUM PRIORITY - Inheritance Modules

OOP analysis, moderate complexity:

- **task-epic-11.86**: class_detection (4 language files)
- **task-epic-11.88**: class_hierarchy (3 language files)
- **task-epic-11.89**: interface_implementation (3 language files)
- **task-epic-11.90**: method_override (4 language files)

### MEDIUM PRIORITY - Scope Analysis

More complex rules, but still configuration potential:

- **task-epic-11.85**: scope_tree (4 language files)
- **task-epic-11.91**: symbol_resolution (4 language files)

### LOWER PRIORITY - Type Analysis

Complex type systems, may need significant bespoke logic:

- **task-epic-11.92**: return_type_inference (4 language files)
- **task-epic-11.93**: type_tracking (4 language files)
- **task-epic-11.94**: parameter_type_inference (4 language files)
- **task-epic-11.95**: type_propagation (4 language files)
- **task-epic-11.96**: generic_resolution (3 language files - no JS)

### LOWER PRIORITY - AST Utilities

- **task-epic-11.97**: member_access (3 language files)

## Expected Impact

Based on function_calls results (70% reduction):

- **Total current lines**: ~15,000-20,000 (estimated)
- **Expected after refactoring**: ~5,000-7,000
- **Code reduction**: 65-70%
- **Maintenance burden**: Significantly reduced
- **Testing efficiency**: Improved through consolidated structure

## Implementation Strategy

1. Start with HIGH PRIORITY modules (most similar to function_calls)
2. Apply lessons learned to progressively more complex modules
3. Document any new patterns discovered
4. Update backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md with learnings

## Success Metrics

- [ ] Each module achieves 50%+ code reduction
- [ ] All tests pass after refactoring
- [ ] No functionality lost
- [ ] Consistent file structure across all modules
- [ ] Clear separation between configuration and bespoke logic

## Notes

- Some modules (especially type analysis) may have lower reduction rates due to genuinely different type systems
- Prioritization based on: similarity to function_calls, code duplication level, and impact on system

