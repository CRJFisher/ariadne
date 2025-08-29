---
id: task-epic-11.60
title: Implement Class Detection Module
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, layer-2, per-file-analysis, critical-gap]
dependencies: []
parent_task_id: epic-11
---

## Description

Implement the missing `/inheritance/class_detection` module that is referenced in Architecture.md but doesn't exist. This module is critical for the per-file analysis phase (Layer 2) and provides essential input for the class hierarchy and type registry modules.

## Context

From PROCESSING_PIPELINE.md Layer 2 (Local Structure Detection):
- The module should extract class definitions during per-file analysis
- It runs in parallel without needing information from other files
- Outputs feed into the type registry and class hierarchy in the global assembly phase

From ARCHITECTURE_ISSUES.md:
- This is a breaking issue - class hierarchy has no input data without this
- Type registry has incomplete information without class definitions
- Must run in per-file phase for parallelization

## Acceptance Criteria

### Core Functionality
- [ ] Implement `/inheritance/class_detection/index.ts` with proper dispatcher pattern
- [ ] Extract class definitions with:
  - Class name and location
  - Base classes (extends)
  - Implemented interfaces
  - Generic parameters with constraints
  - Abstract/final modifiers
  - Decorators/annotations
- [ ] Extract class members:
  - Methods (with visibility, static, abstract flags)
  - Properties/fields (with types, visibility, static flags)
  - Constructors with parameters
- [ ] Use types from `@ariadnejs/types` package for all public interfaces

### Language-Specific Implementations
- [ ] `/inheritance/class_detection/class_detection.javascript.ts`:
  - ES6 class declarations
  - Class expressions
  - Prototype-based pseudo-classes
- [ ] `/inheritance/class_detection/class_detection.typescript.ts`:
  - All JavaScript patterns
  - Abstract classes
  - Interface implementations
  - Generic class parameters
  - Decorators
- [ ] `/inheritance/class_detection/class_detection.python.ts`:
  - Class definitions with inheritance
  - Metaclasses
  - Decorators (especially @dataclass, @abstractmethod)
  - Multiple inheritance
- [ ] `/inheritance/class_detection/class_detection.rust.ts`:
  - Struct definitions
  - Impl blocks (inherent and trait implementations)
  - Generic parameters with trait bounds
  - Derive macros

### Testing
- [ ] `/inheritance/class_detection/class_detection.test.ts` with test contracts for all languages
- [ ] Test basic class detection
- [ ] Test inheritance detection
- [ ] Test generic parameters
- [ ] Test nested classes
- [ ] Test abstract/interface patterns

### Integration
- [ ] Integrate with code_graph.ts per-file analysis phase
- [ ] Output format compatible with type_registry expectations
- [ ] Output format compatible with class_hierarchy expectations

## Implementation Notes

### Type Definitions (in @ariadnejs/types)
```typescript
export interface ClassDefinition {
  name: string;
  location: Location;
  extends?: string[];
  implements?: string[];
  is_abstract?: boolean;
  is_final?: boolean;
  generics?: GenericParameter[];
  methods: MethodDefinition[];
  properties: PropertyDefinition[];
  decorators?: string[];
  language: Language;
}
```

### Processing Order
1. Parse AST to find class-like nodes
2. Extract class name and modifiers
3. Extract inheritance relationships
4. Extract generic parameters
5. Walk class body to find members
6. Resolve member types where possible (local only)

### Language-Specific Patterns

**JavaScript/TypeScript:**
- Look for `class_declaration` and `class` nodes
- Check for `extends` and `implements` clauses
- Extract decorators from preceding nodes

**Python:**
- Look for `class_definition` nodes
- Parse argument list for base classes
- Check decorators for special semantics (@dataclass changes behavior)

**Rust:**
- Look for `struct_item` nodes
- Find associated `impl_item` blocks
- Match trait implementations to structs

### Relationship to Other Modules
- **Depends on:** AST parsing, scope_tree (for nested class context)
- **Feeds into:** type_registry, class_hierarchy
- **Parallel with:** import_resolution, export_detection

## Success Metrics
- All test contracts pass for all 4 languages
- Can extract classes from real codebases (test on ariadne itself)
- Output integrates cleanly with type_registry
- No performance regression in per-file analysis

## References
- Stub created at: `/packages/core/src/inheritance/class_detection/index.ts`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 2)
- Architecture issues: `/packages/core/ARCHITECTURE_ISSUES.md` (Issue #9)
- Related modules: `/inheritance/class_hierarchy`, `/type_analysis/type_registry`