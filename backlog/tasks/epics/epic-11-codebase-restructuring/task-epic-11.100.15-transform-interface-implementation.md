# Task 11.100.15: Transform interface_implementation to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.15.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.15.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/inheritance/interface_implementation/`
**Files**: 5+ files (~1,200 lines)

- `interface_implementation.ts` - Core interface tracking
- `interface_implementation.typescript.ts` - TS interfaces
- `interface_implementation.python.ts` - Python protocols
- `interface_implementation.rust.ts` - Rust traits
- Language-specific implementation patterns

## Current Implementation

### Manual Interface Detection

```typescript
function find_interface_implementations(node: SyntaxNode) {
  // TypeScript interfaces
  if (node.type === "class_declaration") {
    const heritage = node.childForFieldName("heritage");
    if (heritage) {
      const implementsClause = heritage.childForFieldName("implements_clause");
      if (implementsClause) {
        const interfaces = [];
        for (const child of implementsClause.children) {
          if (child.type === "type_identifier") {
            interfaces.push(child.text);
          }
        }
        return interfaces;
      }
    }
  }

  // Rust trait implementations
  else if (node.type === "impl_item") {
    const trait = node.childForFieldName("trait");
    const type = node.childForFieldName("type");

    if (trait && type) {
      return {
        trait: trait.text,
        implementor: type.text,
        methods: extractTraitMethods(node),
      };
    }
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; interface_implementation_queries.scm

;; TypeScript interface declaration
(interface_declaration
  name: (type_identifier) @interface.name
  body: (interface_body
    (property_signature
      name: (property_identifier) @interface.property)
    (method_signature
      name: (property_identifier) @interface.method))) @interface.declaration

;; TypeScript class implements interface
(class_declaration
  name: (identifier) @impl.class
  heritage: (class_heritage
    (implements_clause
      (type_identifier) @impl.interface))) @impl.typescript

;; TypeScript interface extending interface
(interface_declaration
  name: (type_identifier) @interface.child
  heritage: (extends_type_clause
    (type_identifier) @interface.parent)) @interface.extends

;; Python Protocol (PEP 544)
(class_definition
  name: (identifier) @protocol.name
  superclasses: (argument_list
    (identifier) @protocol.base
    (#eq? @protocol.base "Protocol"))
  body: (block
    (function_definition
      name: (identifier) @protocol.method))) @protocol.python

;; Python ABC implementation
(class_definition
  name: (identifier) @abc.class
  superclasses: (argument_list
    (identifier) @abc.base
    (#match? @abc.base "ABC|ABCMeta"))
  body: (block
    (decorated_definition
      (decorator_list
        (decorator
          (identifier) @abc.decorator
          (#eq? @abc.decorator "abstractmethod")))
      (function_definition
        name: (identifier) @abc.method)))) @abc.python

;; Rust trait definition
(trait_item
  name: (type_identifier) @trait.name
  body: (declaration_list
    (function_signature_item
      name: (identifier) @trait.method)
    (associated_type
      name: (type_identifier) @trait.associated))) @trait.rust

;; Rust trait implementation
(impl_item
  trait: (type_identifier) @impl.trait
  "for"
  type: (type_identifier) @impl.type
  body: (declaration_list
    (function_item
      name: (identifier) @impl.method))) @impl.rust

;; Rust generic trait bounds
(impl_item
  (type_parameters
    (type_parameter
      (type_identifier) @impl.generic
      (trait_bounds
        (type_identifier) @impl.bound))))
  trait: (type_identifier) @impl.trait
  type: (_) @impl.type) @impl.rust.generic

;; Go interface (for reference)
(interface_type
  (method_spec
    name: (field_identifier) @interface.method
    parameters: (parameter_list) @interface.params
    result: (_)? @interface.return)) @interface.go

;; Type checking (duck typing patterns)
(if_statement
  condition: (call
    function: (identifier) @typecheck.func
    (#match? @typecheck.func "hasattr|isinstance|issubclass")
    arguments: (argument_list
      (_) @typecheck.object
      (string) @typecheck.attr))) @typecheck.duck
```

### New Implementation

```typescript
export function find_interface_implementations_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): InterfaceImplementationInfo {
  const query = loadInterfaceQuery(language);
  const captures = query.captures(tree.rootNode);

  const info: InterfaceImplementationInfo = {
    interfaces: new Map(),
    implementations: new Map(),
    traits: new Map(),
    protocols: new Map(),
  };

  // Process interface/trait declarations
  const declarations = captures.filter(
    (c) =>
      c.name.includes(".declaration") ||
      c.name.includes(".trait") ||
      c.name.includes(".protocol")
  );

  for (const declGroup of groupByDeclaration(declarations)) {
    const interfaceInfo = extractInterfaceInfo(declGroup);
    info.interfaces.set(interfaceInfo.name, interfaceInfo);
  }

  // Process implementations
  const implementations = captures.filter((c) => c.name.includes(".impl"));

  for (const implGroup of groupByImplementation(implementations)) {
    const impl = extractImplementationInfo(implGroup);

    if (!info.implementations.has(impl.interface)) {
      info.implementations.set(impl.interface, []);
    }

    info.implementations.get(impl.interface)!.push(impl);

    // Verify implementation completeness
    verifyImplementation(impl, info.interfaces.get(impl.interface));
  }

  return info;
}

function extractInterfaceInfo(group: QueryCapture[]): InterfaceInfo {
  const name =
    group.find((c) => c.name.includes(".name"))?.node.text || "unknown";

  const methods = group
    .filter((c) => c.name.includes(".method"))
    .map((c) => c.node.text);

  const properties = group
    .filter((c) => c.name.includes(".property"))
    .map((c) => c.node.text);

  const parent = group.find(
    (c) => c.name.includes(".parent") || c.name.includes(".base")
  )?.node.text;

  return {
    name,
    methods,
    properties,
    extends: parent,
    isProtocol: group.some((c) => c.name.includes("protocol")),
    isTrait: group.some((c) => c.name.includes("trait")),
    location: group[0].node.startPosition,
  };
}

function verifyImplementation(
  impl: Implementation,
  interface: InterfaceInfo | undefined
): void {
  if (!interface) return;

  // Check if all required methods are implemented
  const missingMethods = interface.methods.filter(
    (m) => !impl.methods.includes(m)
  );

  const missingProperties = interface.properties.filter(
    (p) => !impl.properties.includes(p)
  );

  impl.isComplete =
    missingMethods.length === 0 && missingProperties.length === 0;
  impl.missingMembers = [...missingMethods, ...missingProperties];
}
```

## Transformation Steps

### 1. Document Interface Patterns

- [ ] Interface declarations
- [ ] Interface implementations
- [ ] Trait definitions
- [ ] Protocol definitions
- [ ] Abstract base classes
- [ ] Duck typing patterns

### 2. Create Interface Queries

- [ ] **Create language-specific .scm files**:
  - `queries/interface_implementation.javascript.scm` - JS duck typing patterns, mixins
  - `queries/interface_implementation.typescript.scm` - TS interfaces, implements clauses
  - `queries/interface_implementation.python.scm` - Python Protocols, ABCs, type checking
  - `queries/interface_implementation.rust.scm` - Rust traits, impl blocks, bounds
- [ ] Interface/trait declarations
- [ ] Implementation clauses
- [ ] Method signatures
- [ ] Property signatures
- [ ] Extension relationships

### 3. Build Implementation Tracking

- [ ] Extract interface definitions
- [ ] Find implementations
- [ ] Verify completeness
- [ ] Track inheritance chains

### 4. Special Cases

- [ ] Multiple interface implementation
- [ ] Generic interfaces
- [ ] Associated types (Rust)
- [ ] Protocol composition
- [ ] Structural typing

## Expected Improvements

### Code Reduction

- **Before**: ~1,200 lines
- **After**: ~120 lines + queries
- **Reduction**: 90%

### Accuracy

- Complete interface tracking
- Implementation verification
- Missing member detection

### Performance

- Single-pass extraction
- Efficient relationship building
- Fast completeness checking

## Success Criteria

### Functional Requirements
- [ ] All interfaces captured
- [ ] Implementations tracked
- [ ] Completeness verified
- [ ] 90% code reduction
- [ ] Missing members identified

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

- Related to class_hierarchy for inheritance
- Used by type_analysis for type checking
- Required by method_override for interface methods

## Notes

- TypeScript has explicit interfaces
- Python uses Protocols (PEP 544) and ABCs
- Rust uses traits instead of interfaces
- Go has structural interfaces
- Must verify implementation completeness
