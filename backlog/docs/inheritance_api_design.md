# Class Inheritance API Design

## Overview

This document outlines the design for adding class inheritance analysis to Ariadne core.

## Key Findings from AST Research

### TypeScript/JavaScript

- Classes use `class_declaration` nodes
- Inheritance info is in `class_heritage` node which contains:
  - `extends_clause` with parent class identifier
  - `implements_clause` with implemented interfaces (TypeScript only)

### Python

- Classes use `class_definition` nodes  
- Superclasses are in `argument_list` field (named "superclasses")
- Multiple inheritance supported (comma-separated in argument_list)

### Rust

- Uses `impl_item` for trait implementations
- Inheritance via traits, not traditional class inheritance

## Proposed API Methods on Project Class

```typescript
interface ClassRelationship {
  parent_class?: string;           // Name of parent class
  parent_class_def?: Def;          // Definition of parent class (if found)
  implemented_interfaces: string[]; // Names of implemented interfaces
  interface_defs: Def[];           // Definitions of interfaces (if found)
}

class Project {
  /**
   * Get inheritance information for a class definition
   */
  get_class_relationships(class_def: Def): ClassRelationship | null;

  /**
   * Find all classes that extend a given class
   */
  find_subclasses(class_def: Def): Def[];

  /**
   * Find all classes that implement a given interface
   */
  find_implementations(interface_def: Def): Def[];

  /**
   * Get complete inheritance chain for a class (all ancestors)
   */
  get_inheritance_chain(class_def: Def): Def[];

  /**
   * Check if one class is a subclass of another
   */
  is_subclass_of(child_def: Def, parent_def: Def): boolean;
}
```

## Implementation Strategy

1. **Phase 1: Direct Relationships**
   - Extract parent class from AST during parsing
   - Store in a new optional field on Def or in a separate map
   - Support TypeScript, JavaScript ES6, and Python initially

2. **Phase 2: Reverse Lookups**
   - Build indexes mapping parent classes to their children
   - Build indexes mapping interfaces to their implementers
   - Update indexes when files change

3. **Phase 3: Advanced Features**
   - Inheritance chain traversal
   - Diamond problem detection
   - Trait/interface resolution

## Data Storage Options

### Option 1: Extend Def Interface

```typescript
interface Def {
  // ... existing fields ...
  parent_class?: string;
  implemented_interfaces?: string[];
}
```

### Option 2: Separate Inheritance Map

```typescript
class Project {
  private inheritance_map: Map<string, ClassRelationship>;
}
```

### Decision: Option 2 (Separate Map)

- Keeps Def interface clean
- Allows for richer relationship data
- Easier to maintain backwards compatibility

## Language-Specific Considerations

### TypeScript

- Support both extends and implements
- Handle generic type parameters
- Consider declaration merging

### JavaScript

- ES6 class extends only (no implements)
- Prototype-based inheritance out of scope

### Python

- Multiple inheritance support
- Method resolution order (MRO) consideration
- Metaclasses out of scope initially

### Rust

- Trait implementations via impl blocks
- No traditional inheritance
- May need different API approach
