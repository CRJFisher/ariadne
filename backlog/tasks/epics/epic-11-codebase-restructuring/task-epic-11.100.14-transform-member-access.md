# Task 11.100.14: Transform member_access to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.14.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.14.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/ast/member_access/`
**Files**: 5+ files (~1,500 lines)

- `member_access.ts` - Core member access detection
- `member_access.javascript.ts` - JS property access
- `member_access.typescript.ts` - TS member access
- `member_access.python.ts` - Python attribute access
- `member_access.rust.ts` - Rust field access

## Current Implementation

### Manual Member Access Detection

```typescript
function find_member_access(node: SyntaxNode) {
  if (node.type === "member_expression") {
    const object = node.childForFieldName("object");
    const property = node.childForFieldName("property");
    const optional = node.childForFieldName("optional_chain");

    return {
      object: extractObjectName(object),
      property: property.text,
      isOptional: !!optional,
      isComputed: node.type === "subscript_expression",
      type: inferMemberType(object, property),
    };
  }

  // Python attribute access
  else if (node.type === "attribute") {
    const object = node.childForFieldName("object");
    const attribute = node.childForFieldName("attribute");

    return {
      object: object.text,
      property: attribute.text,
      isPrivate: attribute.text.startsWith("_"),
    };
  }

  // Rust field access
  else if (node.type === "field_expression") {
    const value = node.childForFieldName("value");
    const field = node.childForFieldName("field");

    return {
      object: value.text,
      property: field.text,
      requiresDeref: checkDerefNeeded(value),
    };
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; member_access_queries.scm

;; JavaScript/TypeScript dot notation
(member_expression
  object: (_) @access.object
  property: (property_identifier) @access.property) @access.dot

;; Optional chaining ?.
(member_expression
  object: (_) @access.object
  optional_chain: (optional_chain) @access.optional
  property: (property_identifier) @access.property) @access.optional_chain

;; Computed/bracket notation
(subscript_expression
  object: (_) @access.object
  index: (_) @access.computed) @access.bracket

;; Nested member access (chained)
(member_expression
  object: (member_expression) @access.nested.inner
  property: (property_identifier) @access.property) @access.nested

;; Private field access
(member_expression
  object: (_) @access.object
  property: (private_property_identifier) @access.private) @access.private_field

;; Python attribute access
(attribute
  object: (_) @access.object
  attribute: (identifier) @access.attribute) @access.python

;; Python private/protected attributes
(attribute
  object: (_) @access.object
  attribute: (identifier) @access.private
  (#match? @access.private "^_")) @access.python.private

;; Python dunder attributes
(attribute
  object: (_) @access.object
  attribute: (identifier) @access.dunder
  (#match? @access.dunder "^__.*__$")) @access.python.dunder

;; Rust field access
(field_expression
  value: (_) @access.object
  field: (field_identifier) @access.field) @access.rust

;; Rust tuple field access
(field_expression
  value: (_) @access.object
  field: (integer_literal) @access.tuple_index) @access.rust.tuple

;; Rust method call (for comparison)
(call_expression
  function: (field_expression
    value: (_) @access.receiver
    field: (field_identifier) @access.method)) @access.rust.method

;; Static member access
(member_expression
  object: (identifier) @access.class
  (#match? @access.class "^[A-Z]")
  property: (property_identifier) @access.static) @access.static_member

;; Prototype access
(member_expression
  object: (_) @access.object
  property: (property_identifier) @access.prototype
  (#eq? @access.prototype "prototype")) @access.prototype

;; Constructor property access
(member_expression
  object: (_) @access.object
  property: (property_identifier) @access.constructor
  (#eq? @access.constructor "constructor")) @access.constructor

;; This/self member access
(member_expression
  object: (this) @access.this
  property: (property_identifier) @access.property) @access.this_member

(attribute
  object: (identifier) @access.self
  (#eq? @access.self "self")
  attribute: (identifier) @access.property) @access.self_member
```

### New Implementation

```typescript
export function find_member_access_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): MemberAccessInfo[] {
  const query = loadMemberAccessQuery(language);
  const captures = query.captures(tree.rootNode);

  // Group by access expression
  const accessGroups = groupByAccess(captures);

  return accessGroups.map((group) => {
    const accessType = detectAccessType(group);

    return {
      object: extractObject(group),
      member: extractMember(group),
      accessType: accessType,
      isOptional: hasOptionalChaining(group),
      isComputed: isComputedAccess(group),
      isPrivate: isPrivateAccess(group),
      isStatic: isStaticAccess(group),
      chainDepth: calculateChainDepth(group),
      location: group[0].node.startPosition,
    };
  });
}

function extractObject(group: QueryCapture[]): string {
  const objectCapture = group.find(
    (c) => c.name.includes(".object") || c.name.includes(".receiver")
  );

  if (!objectCapture) return "unknown";

  // Handle nested access
  if (
    objectCapture.node.type === "member_expression" ||
    objectCapture.node.type === "attribute"
  ) {
    return buildAccessChain(objectCapture.node);
  }

  return objectCapture.node.text;
}

function extractMember(group: QueryCapture[]): string {
  const memberCapture = group.find(
    (c) =>
      c.name.includes(".property") ||
      c.name.includes(".attribute") ||
      c.name.includes(".field") ||
      c.name.includes(".computed")
  );

  return memberCapture?.node.text || "unknown";
}

function calculateChainDepth(group: QueryCapture[]): number {
  const nestedCaptures = group.filter((c) => c.name.includes(".nested"));

  if (nestedCaptures.length === 0) return 1;

  // Recursively count chain depth
  let depth = 1;
  let current = nestedCaptures[0].node;

  while (current.type === "member_expression" || current.type === "attribute") {
    depth++;
    current = current.childForFieldName("object");
  }

  return depth;
}

function isPrivateAccess(group: QueryCapture[]): boolean {
  return group.some(
    (c) =>
      c.name.includes(".private") ||
      (c.name.includes(".property") && c.node.text.startsWith("_"))
  );
}
```

## Transformation Steps

### 1. Document Access Patterns

- [ ] Dot notation (obj.prop)
- [ ] Bracket notation (obj[prop])
- [ ] Optional chaining (obj?.prop)
- [ ] Private fields
- [ ] Static members
- [ ] Chained access

### 2. Create Access Queries

- [ ] **Create language-specific .scm files**:
  - `queries/member_access.javascript.scm` - JS dot/bracket notation, optional chaining
  - `queries/member_access.typescript.scm` - TS private fields, static members, decorators
  - `queries/member_access.python.scm` - Python attribute access, dunder methods
  - `queries/member_access.rust.scm` - Rust field access, deref coercion, tuple access
- [ ] All access forms
- [ ] Optional chaining
- [ ] Computed properties
- [ ] Private/protected members
- [ ] Language-specific patterns

### 3. Build Access Extractor

- [ ] Extract object and member
- [ ] Track access chains
- [ ] Detect access types
- [ ] Handle nested access

### 4. Special Cases

- [ ] This/self access
- [ ] Prototype access
- [ ] Constructor access
- [ ] Super member access
- [ ] Dynamic property names

## Expected Improvements

### Code Reduction

- **Before**: ~1,500 lines
- **After**: ~150 lines + queries
- **Reduction**: 90%

### Accuracy

- All access patterns captured
- Proper chain tracking
- Private member detection

### Performance

- Single-pass extraction
- No recursive traversal
- Efficient grouping

## Success Criteria

### Functional Requirements
- [ ] All member access captured
- [ ] Chains properly tracked
- [ ] Optional chaining detected
- [ ] Private members identified
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

- Used by type_tracking for member types
- Required by method_calls for receiver resolution
- Integrates with symbol_resolution

## Notes

- Member access is fundamental to OOP analysis
- Optional chaining is ES2020 feature
- Python uses attribute access terminology
- Rust has field access with deref coercion
- Must handle deeply nested access chains
