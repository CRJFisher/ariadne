# Task 11.100.7: Transform type_tracking to Tree-sitter Queries

## Parent Task
11.100 - Transform Entire Codebase to Tree-sitter Query System

## Module Overview
**Location**: `src/type_analysis/type_tracking/`
**Files**: 7+ files (~3,000 lines)
- `type_tracking.ts` - Core type tracking
- `type_tracking.javascript.ts` - JS type patterns
- `type_tracking.typescript.ts` - TS type annotations
- `type_tracking.python.ts` - Python type hints
- `type_tracking.rust.ts` - Rust type system

## Current Implementation

### Manual Type Extraction
```typescript
function track_types(node: SyntaxNode) {
  // TypeScript type annotations
  if (node.type === 'type_annotation') {
    const type = node.childForFieldName('type');
    // ... extract type info
  }
  // Variable declarations with types
  else if (node.type === 'variable_declarator') {
    const name = node.childForFieldName('name');
    const type = findTypeAnnotation(node);
    const value = node.childForFieldName('value');
    // ... infer or extract type
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern
```scheme
;; type_queries/all_languages.scm

;; TypeScript type annotations
(variable_declarator
  name: (identifier) @type.variable.name
  type: (type_annotation
    (type_identifier) @type.variable.type)) @type.annotated

(parameter
  pattern: (identifier) @type.parameter.name
  type: (type_annotation
    (_) @type.parameter.type)) @type.parameter

(function_declaration
  name: (identifier) @type.function.name
  return_type: (type_annotation
    (_) @type.function.return)) @type.function

;; Type assertions
(as_expression
  expression: (_) @type.assertion.value
  type: (_) @type.assertion.type) @type.assertion

;; Python type hints
(function_definition
  name: (identifier) @type.function.name
  return_type: (type) @type.function.return) @type.function.python

(typed_parameter
  (identifier) @type.parameter.name
  type: (type) @type.parameter.type) @type.parameter.python

;; Python variable annotations
(annotated_assignment
  target: (identifier) @type.variable.name
  annotation: (type) @type.variable.type) @type.annotated.python

;; Rust type annotations
(let_declaration
  pattern: (identifier) @type.variable.name
  type: (type_identifier) @type.variable.type) @type.annotated.rust

(function_item
  name: (identifier) @type.function.name
  return_type: (_) @type.function.return) @type.function.rust

;; Generic type parameters
(type_parameters
  (type_parameter
    (type_identifier) @type.generic.param)) @type.generic

;; Type aliases
(type_alias_declaration
  name: (type_identifier) @type.alias.name
  value: (_) @type.alias.value) @type.alias
```

### New Implementation
```typescript
export function track_types_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): Map<string, TypeInfo> {
  const query = loadTypeQuery(language);
  const captures = query.captures(tree.rootNode);
  
  const typeMap = new Map<string, TypeInfo>();
  
  // Process type annotations
  const annotations = captures.filter(c => 
    c.name.includes('.annotated'));
  
  for (const group of groupByDeclaration(annotations)) {
    const name = extractName(group);
    const type = extractType(group);
    
    typeMap.set(name, {
      type,
      source: 'annotation',
      location: group[0].node.startPosition
    });
  }
  
  // Process type inference
  const inferences = captures.filter(c => 
    c.name.includes('.inferred'));
  
  // ... process inferred types
  
  return typeMap;
}
```

## Transformation Steps

### 1. Document Type Patterns
- [ ] Type annotations (all forms)
- [ ] Type assertions/casts
- [ ] Generic type parameters
- [ ] Type aliases/typedefs
- [ ] Return types
- [ ] Parameter types

### 2. Create Type Queries
- [ ] TypeScript full type system
- [ ] Python type hints (PEP 484)
- [ ] Rust type annotations
- [ ] JavaScript JSDoc types

### 3. Build Type Tracker
- [ ] Extract explicit types
- [ ] Track type assertions
- [ ] Handle generics
- [ ] Build type map

## Expected Improvements

### Code Reduction
- **Before**: ~3,000 lines
- **After**: ~300 lines + queries
- **Reduction**: 90%

### Completeness
- Catches all type annotations
- Handles complex generic types

## Success Criteria
- [ ] All type annotations captured
- [ ] Generic parameters tracked
- [ ] Type aliases resolved
- [ ] 90% code reduction