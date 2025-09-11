# Task 11.100.4: Transform class_detection to Tree-sitter Queries

## Parent Task
11.100 - Transform Entire Codebase to Tree-sitter Query System

## Module Overview
**Location**: `src/inheritance/class_detection/`
**Files**: 6+ files (~1,000 lines)
- `class_detection.ts` - Generic processor
- `class_detection.javascript.ts` - ES6 classes
- `class_detection.typescript.ts` - TS classes/interfaces
- `class_detection.python.ts` - Python classes
- `class_detection.rust.ts` - Rust structs/impls

## Current Implementation

### Manual Class Extraction
```typescript
function find_class_definitions(node: SyntaxNode) {
  if (node.type === 'class_declaration') {
    const name = node.childForFieldName('name');
    const superclass = node.childForFieldName('superclass');
    const body = node.childForFieldName('body');
    
    // Extract methods
    const methods = [];
    for (const child of body.children) {
      if (child.type === 'method_definition') {
        // ... extract method details
      }
    }
    // ... build ClassDefinition
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern
```scheme
;; class_queries/all_languages.scm

;; JavaScript/TypeScript classes
(class_declaration
  name: (identifier) @class.name
  superclass: (identifier)? @class.extends
  body: (class_body) @class.body) @class

(class_body
  (method_definition
    static: (static)? @method.static
    key: (property_identifier) @method.name
    value: (function) @method.body)) @class.method

(class_body
  (property_definition
    static: (static)? @property.static
    key: (property_identifier) @property.name
    value: (_)? @property.value)) @class.property

;; TypeScript interfaces
(interface_declaration
  name: (type_identifier) @interface.name
  body: (interface_body) @interface.body) @interface

;; Python classes
(class_definition
  name: (identifier) @class.name
  superclasses: (argument_list
    (identifier) @class.extends)
  body: (block) @class.body) @class

(class_definition
  body: (block
    (function_definition
      name: (identifier) @method.name))) @class.method

;; Rust structs and impls
(struct_item
  name: (type_identifier) @struct.name
  body: (field_declaration_list)? @struct.fields) @struct

(impl_item
  type: (type_identifier) @impl.type
  body: (declaration_list) @impl.body) @impl

(impl_item
  trait: (type_identifier) @impl.trait
  type: (type_identifier) @impl.type) @impl.trait_impl
```

### New Implementation
```typescript
export function find_classes_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): ClassDefinition[] {
  const query = loadClassQuery(language);
  const captures = query.captures(tree.rootNode);
  
  // Group captures by class
  const classGroups = groupByClass(captures);
  
  return classGroups.map(group => {
    const classNode = group.find(c => c.name === 'class');
    const methods = group.filter(c => c.name === 'class.method');
    const properties = group.filter(c => c.name === 'class.property');
    
    return {
      name: extractText(group, 'class.name'),
      extends: extractText(group, 'class.extends'),
      methods: methods.map(extractMethodInfo),
      properties: properties.map(extractPropertyInfo),
      location: classNode.node.startPosition
    };
  });
}
```

## Transformation Steps

### 1. Document Class Patterns
- [ ] Class declarations (all languages)
- [ ] Method definitions
- [ ] Property/field definitions
- [ ] Inheritance patterns
- [ ] Interfaces/traits
- [ ] Static members

### 2. Create Class Queries
- [ ] JavaScript ES6 classes
- [ ] TypeScript classes/interfaces
- [ ] Python classes with metaclasses
- [ ] Rust structs/impls/traits

### 3. Build Class Extractor
- [ ] Group captures by class
- [ ] Extract class metadata
- [ ] Build method list
- [ ] Track inheritance chain

## Expected Improvements

### Code Reduction
- **Before**: ~1,000 lines
- **After**: ~100 lines + queries
- **Reduction**: 90%

### Completeness
- Finds all class-like constructs
- Handles edge cases (anonymous classes, etc.)

## Success Criteria
- [ ] All classes detected
- [ ] Methods and properties captured
- [ ] Inheritance tracked
- [ ] 90% code reduction