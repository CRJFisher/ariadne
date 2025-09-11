# Task 11.100.12: Transform class_hierarchy to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.12.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.12.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/inheritance/class_hierarchy/`
**Files**: 5+ files (~1,000 lines)

- `class_hierarchy.ts` - Core inheritance tracking
- `class_hierarchy.javascript.ts` - JS class extends
- `class_hierarchy.typescript.ts` - TS inheritance
- `class_hierarchy.python.ts` - Python class hierarchy
- `class_hierarchy.rust.ts` - Rust impl/trait

## Current Implementation

### Manual Inheritance Detection

```typescript
function build_class_hierarchy(node: SyntaxNode) {
  if (node.type === "class_declaration") {
    const className = node.childForFieldName("name");
    const heritage = node.childForFieldName("heritage");

    if (heritage) {
      // Extract parent class
      const extendsClause = heritage.childForFieldName("extends_clause");
      if (extendsClause) {
        const parent = extendsClause.childForFieldName("value");
        recordInheritance(className.text, parent.text);
      }

      // Extract interfaces (TypeScript)
      const implementsClause = heritage.childForFieldName("implements_clause");
      if (implementsClause) {
        for (const iface of implementsClause.children) {
          if (iface.type === "type_identifier") {
            recordImplementation(className.text, iface.text);
          }
        }
      }
    }
  }

  // Python multiple inheritance
  else if (node.type === "class_definition") {
    const name = node.childForFieldName("name");
    const superclasses = node.childForFieldName("superclasses");

    if (superclasses) {
      for (const parent of superclasses.children) {
        if (parent.type === "identifier") {
          recordInheritance(name.text, parent.text);
        }
      }
    }
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; class_hierarchy_queries.scm

;; JavaScript/TypeScript class inheritance
(class_declaration
  name: (identifier) @hierarchy.class.name
  heritage: (class_heritage
    (extends_clause
      value: (_) @hierarchy.extends))) @hierarchy.inheritance

;; TypeScript interface implementation
(class_declaration
  name: (identifier) @hierarchy.class.name
  heritage: (class_heritage
    (implements_clause
      (type_identifier) @hierarchy.implements))) @hierarchy.implementation

;; TypeScript interface extension
(interface_declaration
  name: (type_identifier) @hierarchy.interface.name
  heritage: (extends_type_clause
    (type_identifier) @hierarchy.extends)) @hierarchy.interface.extension

;; Python class inheritance (single)
(class_definition
  name: (identifier) @hierarchy.class.name
  superclasses: (argument_list
    (identifier) @hierarchy.parent)) @hierarchy.python.single

;; Python multiple inheritance
(class_definition
  name: (identifier) @hierarchy.class.name
  superclasses: (argument_list
    (identifier) @hierarchy.parent.first
    ("," (identifier) @hierarchy.parent.additional)*)) @hierarchy.python.multiple

;; Python metaclass
(class_definition
  name: (identifier) @hierarchy.class.name
  superclasses: (argument_list
    (keyword_argument
      name: (identifier) @hierarchy.metaclass.keyword
      (#eq? @hierarchy.metaclass.keyword "metaclass")
      value: (identifier) @hierarchy.metaclass))) @hierarchy.python.metaclass

;; Rust trait implementation
(impl_item
  trait: (type_identifier) @hierarchy.trait
  "for"
  type: (type_identifier) @hierarchy.struct) @hierarchy.rust.impl

;; Rust trait bounds
(trait_bounds
  (type_identifier) @hierarchy.bound.trait) @hierarchy.rust.bounds

;; Rust struct with trait bounds
(struct_item
  name: (type_identifier) @hierarchy.struct.name
  type_parameters: (type_parameters
    (constrained_type_parameter
      left: (type_identifier) @hierarchy.type_param
      bounds: (trait_bounds
        (type_identifier) @hierarchy.bound)))) @hierarchy.rust.constrained

;; Abstract classes (various patterns)
(class_declaration
  name: (identifier) @hierarchy.abstract.name
  decorators: (decorator_list
    (decorator
      (identifier) @hierarchy.decorator
      (#match? @hierarchy.decorator "abstract|Abstract")))) @hierarchy.abstract

;; Mixin patterns
(class_declaration
  name: (identifier) @hierarchy.mixin.name
  (#match? @hierarchy.mixin.name ".*Mixin$")) @hierarchy.mixin

;; Generic class inheritance
(class_declaration
  name: (identifier) @hierarchy.generic.class
  type_parameters: (type_parameters) @hierarchy.generic.params
  heritage: (class_heritage
    (extends_clause
      value: (generic_type
        (type_identifier) @hierarchy.generic.parent
        type_arguments: (type_arguments) @hierarchy.generic.args)))) @hierarchy.generic.inheritance
```

### New Implementation

```typescript
export function build_class_hierarchy_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): ClassHierarchy {
  const query = loadHierarchyQuery(language);
  const captures = query.captures(tree.rootNode);

  const hierarchy: ClassHierarchy = {
    classes: new Map(),
    interfaces: new Map(),
    inheritance: new Map(),
    implementations: new Map(),
  };

  // Process inheritance relationships
  const inheritanceGroups = groupByRelationship(captures, "hierarchy");

  for (const group of inheritanceGroups) {
    const relType = detectRelationshipType(group);

    switch (relType) {
      case "extends":
        processExtends(group, hierarchy);
        break;
      case "implements":
        processImplements(group, hierarchy);
        break;
      case "trait_impl":
        processTraitImpl(group, hierarchy);
        break;
      case "multiple_inheritance":
        processMultipleInheritance(group, hierarchy);
        break;
    }
  }

  // Build inheritance chains
  buildInheritanceChains(hierarchy);

  // Detect circular inheritance
  detectCircularInheritance(hierarchy);

  return hierarchy;
}

function processExtends(
  group: QueryCapture[],
  hierarchy: ClassHierarchy
): void {
  const className = group.find((c) => c.name.includes(".class.name"))?.node
    .text;
  const parentName = group.find((c) => c.name.includes(".extends"))?.node.text;

  if (className && parentName) {
    if (!hierarchy.inheritance.has(className)) {
      hierarchy.inheritance.set(className, []);
    }
    hierarchy.inheritance.get(className)!.push({
      type: "extends",
      parent: parentName,
      location: group[0].node.startPosition,
    });
  }
}

function buildInheritanceChains(hierarchy: ClassHierarchy): void {
  // Build complete inheritance chains for each class
  for (const [className, parents] of hierarchy.inheritance) {
    const chain = [];
    let current = className;
    const visited = new Set<string>();

    while (hierarchy.inheritance.has(current) && !visited.has(current)) {
      visited.add(current);
      const parent = hierarchy.inheritance.get(current)?.[0]?.parent;
      if (parent) {
        chain.push(parent);
        current = parent;
      } else {
        break;
      }
    }

    hierarchy.classes.set(className, {
      name: className,
      parents: parents.map((p) => p.parent),
      chain: chain,
      isAbstract: checkAbstract(className, hierarchy),
    });
  }
}
```

## Transformation Steps

### 1. Document Hierarchy Patterns

- [ ] Single inheritance
- [ ] Multiple inheritance (Python)
- [ ] Interface implementation
- [ ] Trait implementation (Rust)
- [ ] Abstract classes
- [ ] Mixins

### 2. Create Hierarchy Queries

- [ ] **Create language-specific .scm files**:
  - `queries/class_hierarchy.javascript.scm` - JS class extends, prototype chains
  - `queries/class_hierarchy.typescript.scm` - TS interfaces, abstract classes, implements
  - `queries/class_hierarchy.python.scm` - Python multiple inheritance, metaclasses
  - `queries/class_hierarchy.rust.scm` - Rust trait implementations, bounds
- [ ] Class extends patterns
- [ ] Interface implements
- [ ] Trait implementations
- [ ] Multiple inheritance
- [ ] Generic inheritance

### 3. Build Hierarchy Analysis

- [ ] Extract relationships
- [ ] Build inheritance chains
- [ ] Track implementations
- [ ] Detect circular inheritance

### 4. Special Cases

- [ ] Metaclasses (Python)
- [ ] Trait bounds (Rust)
- [ ] Generic constraints
- [ ] Abstract methods
- [ ] Diamond inheritance

## Expected Improvements

### Code Reduction

- **Before**: ~1,000 lines
- **After**: ~100 lines + queries
- **Reduction**: 90%

### Accuracy

- Complete inheritance tracking
- Multiple inheritance support
- Trait/interface handling

### Performance

- Single-pass relationship extraction
- Efficient chain building
- Fast cycle detection

## Success Criteria

### Functional Requirements
- [ ] All inheritance captured
- [ ] Interface implementations tracked
- [ ] Inheritance chains built
- [ ] Circular inheritance detected
- [ ] 90% code reduction

### Quality Gates (MANDATORY)

**All quality gates are defined in the required subtasks:**

- [ ] **100% test coverage achieved** (Task 11.100.X.1)
- [ ] **All tests passing** (Task 11.100.X.1)  
- [ ] **Zero TypeScript compilation errors** (Task 11.100.X.2)
- [ ] **Zero TypeScript warnings** (Task 11.100.X.2)
- [ ] **Performance improvement validated** (queries faster than manual)
- [ ] **Real-world accuracy confirmed** (corpus/ validation passes)
- [ ] **All language-specific .scm files created and tested**
## Dependencies

- Requires class_detection for class info
- Used by method_override for override detection
- Required by type_propagation for type resolution

## Notes

- JavaScript uses prototype and class inheritance
- TypeScript adds interfaces and abstract classes
- Python supports multiple inheritance
- Rust uses traits instead of inheritance
- Must handle generic type parameters
