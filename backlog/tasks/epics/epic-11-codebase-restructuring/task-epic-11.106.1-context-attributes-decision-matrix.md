# ReferenceContext Attributes Decision Matrix

**Task:** task-epic-11.106.1
**Date:** 2025-10-01
**Objective:** Evaluate which ReferenceContext attributes are essential for method call resolution

## Evaluation Criteria

Each attribute is evaluated on two dimensions:
1. **Tree-sitter Extractability**: Can this be reliably captured via tree-sitter queries?
2. **Method Resolution Utility**: Does this help resolve `obj.method()` to the correct method definition?

**Decision Rule:** Keep only if BOTH criteria are satisfied.

---

## Attribute Analysis

### 1. receiver_location

**Current Definition:**
```typescript
/** For method calls: the receiver object location */
readonly receiver_location?: Location;
```

#### Tree-sitter Extractability: ✅ YES

**Query Pattern (TypeScript/JavaScript):**
```scheme
; Method call: obj.method()
(call_expression
  function: (member_expression
    object: (_) @receiver      ; Capture the receiver node
    property: (property_identifier) @method_name
  )
) @method_call

; Optional chaining: obj?.method()
(call_expression
  function: (optional_chain
    (member_expression
      object: (_) @receiver    ; Capture the receiver node
      property: (property_identifier) @method_name
    )
  )
) @method_call
```

**Query Pattern (Python):**
```scheme
; Method call: obj.method()
(call
  function: (attribute
    object: (_) @receiver      ; Capture the receiver
    attribute: (identifier) @method_name
  )
) @method_call
```

**Query Pattern (Rust):**
```scheme
; Method call: obj.method()
(call_expression
  function: (field_expression
    value: (_) @receiver       ; Capture the receiver
    field: (field_identifier) @method_name
  )
) @method_call
```

**Implementation:**
The `extract_call_receiver()` metadata extractor (lines 44-47 in metadata_types.ts) already implements this pattern. Returns the Location of the receiver node.

#### Method Resolution Utility: ✅ ESSENTIAL

**Use Case: Determine receiver type to resolve method**

For method call resolution, we need to determine the type of the receiver to find the correct method definition:

**Scenario 1: Explicit type annotation**
```typescript
const user: User = getUser();
user.getName();  // Need location of 'user' to find its type annotation
                 // receiver_location → points to 'user' identifier
                 // Look up 'user' → find type annotation 'User'
                 // Resolve 'getName' method in 'User' class
```

**Scenario 2: Constructor assignment**
```typescript
const user = new User();
user.getName();  // Need location of 'user' to trace to constructor
                 // receiver_location → points to 'user' identifier
                 // Look up 'user' → find constructor call 'new User()'
                 // Resolve 'getName' method in 'User' class
```

**Scenario 3: Property chain**
```typescript
container.getUser().getName();
// receiver_location → points to 'container.getUser()' expression
// Must resolve getUser() return type first
// Then resolve getName() on that return type
```

**Why Essential:**
- **Primary identifier**: The receiver_location is the starting point for all method resolution
- **Type lookup**: Points to the symbol whose type we need to determine
- **No alternatives**: Without this, we cannot identify which object the method is being called on

#### Decision: ✅ **KEEP**

**Rationale:** Absolutely essential. This is the anchor point for method resolution - without knowing where the receiver is, we cannot determine its type, and therefore cannot resolve which method is being called.

---

### 2. property_chain

**Current Definition:**
```typescript
/** For member access: the property chain */
readonly property_chain?: readonly SymbolName[];
```

#### Tree-sitter Extractability: ✅ YES

**Query Pattern (TypeScript/JavaScript):**
```scheme
; Simple member access: obj.prop
(member_expression
  object: (identifier) @chain.start
  property: (property_identifier) @chain.property
)

; Chained member access: obj.prop1.prop2.prop3
(member_expression
  object: (member_expression      ; Recursive structure
    object: (member_expression
      object: (identifier) @chain.start
      property: (property_identifier) @chain.prop1
    )
    property: (property_identifier) @chain.prop2
  )
  property: (property_identifier) @chain.prop3
)
```

**Query Pattern (Python):**
```scheme
; Simple attribute access: obj.attr
(attribute
  object: (identifier) @chain.start
  attribute: (identifier) @chain.property
)

; Chained attribute access: obj.attr1.attr2
(attribute
  object: (attribute
    object: (identifier) @chain.start
    attribute: (identifier) @chain.attr1
  )
  attribute: (identifier) @chain.attr2
)
```

**Query Pattern (Rust):**
```scheme
; Field access: obj.field
(field_expression
  value: (identifier) @chain.start
  field: (field_identifier) @chain.field
)

; Chained field access: obj.field1.field2
(field_expression
  value: (field_expression
    value: (identifier) @chain.start
    field: (field_identifier) @chain.field1
  )
  field: (field_identifier) @chain.field2
)
```

**Implementation:**
The `extract_property_chain()` metadata extractor (lines 63-65 in metadata_types.ts) already implements this. Returns array of SymbolNames representing the chain.

**Algorithm:**
```typescript
function extract_property_chain(node: SyntaxNode): SymbolName[] | undefined {
  const chain: SymbolName[] = [];
  let current = node;

  // Traverse member_expression nodes recursively
  while (current.type === 'member_expression') {
    const property = current.childForFieldName('property');
    if (property) {
      chain.unshift(property.text as SymbolName); // Prepend to maintain order
    }
    current = current.childForFieldName('object');
  }

  // Add the root object
  if (current.type === 'identifier') {
    chain.unshift(current.text as SymbolName);
  }

  return chain.length > 0 ? chain : undefined;
}
```

#### Method Resolution Utility: ✅ ESSENTIAL

**Use Case: Resolve chained method calls**

Property chains are critical for resolving multi-step method calls where each step narrows the type:

**Scenario 1: Chained method calls**
```typescript
container.getDatabase().getConnection().query('SELECT * FROM users');

// property_chain: ['container', 'getDatabase', 'getConnection', 'query']
// Resolution steps:
// 1. Find 'container' type → Container
// 2. Resolve getDatabase() on Container → returns Database
// 3. Resolve getConnection() on Database → returns Connection
// 4. Resolve query() on Connection → final method
```

**Scenario 2: Nested property access**
```typescript
config.database.connection.host;

// property_chain: ['config', 'database', 'connection', 'host']
// Resolution steps:
// 1. Find 'config' type → Config
// 2. Find 'database' property on Config → type: DatabaseConfig
// 3. Find 'connection' property on DatabaseConfig → type: ConnectionConfig
// 4. Find 'host' property on ConnectionConfig → type: string
```

**Scenario 3: Mixed property and method access**
```typescript
user.profile.getName();

// property_chain: ['user', 'profile', 'getName']
// Resolution steps:
// 1. Find 'user' type → User
// 2. Find 'profile' property on User → type: Profile
// 3. Resolve getName() method on Profile → final method
```

**Why Essential:**
- **Type narrowing**: Each step in the chain narrows the type context
- **Cross-reference tracking**: Needed to resolve intermediate types
- **Fluent APIs**: Modern APIs heavily use method chaining
- **No alternatives**: Without the full chain, we only know the final property/method, not the path to get there

#### Decision: ✅ **KEEP**

**Rationale:** Essential for resolving chained calls. Modern JavaScript/TypeScript code heavily uses method chaining (e.g., `array.filter().map().reduce()`), and without the property chain, we cannot properly resolve intermediate types to determine the final method.

---

### 3. assignment_source & assignment_target

**Current Definition:**
```typescript
/** For assignments: the source value location */
readonly assignment_source?: Location;

/** For assignments: the target variable location */
readonly assignment_target?: Location;
```

#### Tree-sitter Extractability: ✅ YES

**Query Pattern (TypeScript/JavaScript):**
```scheme
; Variable declaration with assignment
(variable_declarator
  name: (identifier) @assignment.target        ; Left side
  value: (_) @assignment.source                ; Right side
)

; Assignment expression
(assignment_expression
  left: (_) @assignment.target                 ; Left side
  right: (_) @assignment.source                ; Right side
)

; Assignment with type annotation
(variable_declarator
  name: (identifier) @assignment.target
  type: (type_annotation (_) @type.annotation) ; Explicit type
  value: (_) @assignment.source
)
```

**Query Pattern (Python):**
```scheme
; Assignment statement
(assignment
  left: (_) @assignment.target
  right: (_) @assignment.source
)

; Typed assignment (Python 3.6+)
(assignment
  left: (identifier) @assignment.target
  type: (type) @type.annotation
  right: (_) @assignment.source
)
```

**Query Pattern (Rust):**
```scheme
; Let binding with assignment
(let_declaration
  pattern: (identifier) @assignment.target
  value: (_) @assignment.source
)

; Let binding with type annotation
(let_declaration
  pattern: (identifier) @assignment.target
  type: (_) @type.annotation
  value: (_) @assignment.source
)
```

**Implementation:**
The `extract_assignment_parts()` metadata extractor (lines 82-88 in metadata_types.ts) already implements this. Returns both source and target locations.

#### Method Resolution Utility: ⚠️ **QUESTIONABLE**

**Potential Use Case: Type flow through assignments**

The argument for keeping these attributes is that assignments create type flow:

```typescript
// Assignment transfers type from source to target
const result = compute();  // If compute() returns MyClass, result has type MyClass
result.method();           // Need to know result's type to resolve method()
```

**Analysis:**

**Case 1: Explicit type annotation (already handled)**
```typescript
const obj: MyClass = factory();
obj.method();

// Type of 'obj' is explicitly declared as MyClass
// Don't need assignment tracking - the type annotation is sufficient
// ✅ Covered by type_info field on SymbolReference
```

**Case 2: Constructor call (already handled)**
```typescript
const obj = new MyClass();
obj.method();

// Type of 'obj' is determined by constructor
// Don't need generic assignment tracking - constructor is sufficient
// ✅ Covered by construct_target field (see analysis below)
```

**Case 3: Function return type (requires assignment tracking?)**
```typescript
const obj = factory();
obj.method();

// Type of 'obj' depends on factory() return type
// Need to:
// 1. Find the definition of factory()
// 2. Check its return type annotation
//
// Do we need assignment_source for this?
//
// NO - We need:
// - receiver_location: points to 'obj'
// - Look up 'obj' definition in scope
// - Find it's initialized by 'factory()' call
// - Resolve factory() to its definition
// - Extract return_type annotation
//
// The assignment_source Location doesn't help here
// We need the call itself, which is part of the definition
```

**Case 4: Property access return (requires assignment tracking?)**
```typescript
const obj = container.factory();
obj.method();

// Similar to Case 3, but source is a method call
// Still don't need assignment_source Location
// Need to resolve the method call, which we do via property_chain
```

**Critical Insight:**

For method resolution, we care about the **type** of the receiver, not the **assignment structure**. The type comes from:
1. **Explicit annotations** → `type_info` field
2. **Constructor calls** → `construct_target` field (see below)
3. **Return type annotations** → Resolved via function definition lookup

The `assignment_source` and `assignment_target` locations don't directly contribute to determining the receiver type. They provide structural information about the assignment, but method resolution requires **semantic type information**, which comes from:
- Type annotations (extractable)
- Constructor patterns (extractable)
- Return type annotations (extractable)

**Counter-argument: Why might they be useful?**

These locations could be useful for:
- **Assignment graph construction**: Track data flow through assignments
- **Definition lookup**: When we see `obj.method()`, find where `obj` was defined
- **Type narrowing**: In languages with control flow type narrowing

However, the task requirements are clear: **only keep attributes that serve method resolution**. For definition lookup, we use scope resolution (scope_id + name lookup). For type narrowing, that's semantic analysis beyond tree-sitter capabilities.

#### Method Resolution Utility: ❌ **NOT ESSENTIAL**

**Why not essential:**
- **Type info covered elsewhere**: Explicit types → `type_info`, constructors → `construct_target`
- **Semantic analysis required**: Using assignment to infer types requires semantic understanding
- **Definition lookup alternative**: Scope resolution provides definition lookup without these fields

**When would they be useful (but out of scope for method resolution):**
- Building a complete data flow graph
- Tracking variable provenance
- Supporting IDE rename/refactoring
- Control flow analysis

#### Decision: ❌ **REMOVE**

**Rationale:** While these attributes are tree-sitter extractable, they don't directly serve method resolution. The type information needed for method resolution comes from explicit annotations and constructor patterns, not from tracking assignment structure. These locations might be valuable for other use cases (data flow analysis, IDE features), but they're not essential for the core goal of resolving `obj.method()` calls.

**If reconsidered:** If we expand the use case beyond pure method resolution to include "tracing types through assignments", these would become essential. But for the narrow goal stated in the task (method call resolution), they're unnecessary.

---

### 4. construct_target

**Current Definition:**
```typescript
/** For constructor calls: the variable being assigned to */
readonly construct_target?: Location;
```

#### Tree-sitter Extractability: ✅ YES

**Query Pattern (TypeScript/JavaScript):**
```scheme
; Constructor call assigned to variable
(variable_declarator
  name: (identifier) @construct.target
  value: (new_expression
    constructor: (identifier) @construct.class
  )
)

; Constructor call assigned to variable with type annotation
(variable_declarator
  name: (identifier) @construct.target
  type: (type_annotation (_) @type.annotation)
  value: (new_expression
    constructor: (identifier) @construct.class
  )
)
```

**Query Pattern (Python):**
```scheme
; Constructor call (class instantiation)
(assignment
  left: (identifier) @construct.target
  right: (call
    function: (identifier) @construct.class  ; Python uses call, not 'new'
  )
)
```

**Query Pattern (Rust):**
```scheme
; Struct instantiation
(let_declaration
  pattern: (identifier) @construct.target
  value: (call_expression
    function: (scoped_identifier
      name: (identifier) "new"               ; Rust convention: Type::new()
    )
  )
)

; Direct struct literal
(let_declaration
  pattern: (identifier) @construct.target
  value: (struct_expression
    name: (type_identifier) @construct.type
  )
)
```

**Implementation:**
The `extract_construct_target()` metadata extractor (lines 105-108 in metadata_types.ts) already implements this. Returns the Location of the target variable.

#### Method Resolution Utility: ✅ **ESSENTIAL**

**Use Case: Determine receiver type from constructor**

Constructors are one of the most reliable ways to determine an object's type:

**Scenario 1: Simple constructor**
```typescript
const user = new User();
user.getName();

// Without construct_target:
// 1. receiver_location points to 'user'
// 2. Look up 'user' in scope → find its definition
// 3. Definition has no explicit type annotation
// 4. HOW DO WE KNOW IT'S TYPE USER?
//
// With construct_target:
// 1. receiver_location points to 'user'
// 2. Look up 'user' in scope → find its definition
// 3. Definition has construct_target pointing to 'new User()'
// 4. Extract 'User' from constructor → receiver type is User
// 5. Resolve getName() on User class
```

**Scenario 2: Constructor with type annotation (redundant but still useful)**
```typescript
const user: User = new User();
user.getName();

// Two ways to determine type:
// A. From type annotation (type_info field)
// B. From constructor (construct_target field)
//
// construct_target provides verification and fallback
```

**Scenario 3: Constructor without annotation**
```typescript
const user = new User();
user.getName();

// ONLY way to determine type is via constructor
// Absolutely essential for this pattern
```

**Scenario 4: Factory method returning constructed object**
```typescript
function createUser() {
  return new User();
}

const user = createUser();
user.getName();

// More complex: requires function resolution + return type
// But the `new User()` pattern is still captured via construct_target
// when processing the function body
```

#### Critical Analysis: Is construct_target Essential for Method Resolution?

**The key question:** Can we resolve method calls on constructed objects without this field?

**Without construct_target:**
```typescript
const user = new User();
user.getName();

// Processing the definition:
// - We know 'user' is defined
// - We know it's initialized with 'new User()'
// - BUT: How do we extract the class name 'User'?
//
// Options:
// A. Store as type_info when processing the definition
//    → But type_info is meant for explicit annotations
// B. Store the constructor call as part of the definition
//    → But SymbolDefinition doesn't have a 'constructor' field
// C. Use construct_target to link back to the constructor
//    → This is what construct_target provides
```

**With construct_target:**
```typescript
// When processing: const user = new User();
// SymbolReference for the constructor call has:
// - type: "construct"
// - name: "User" (the class being constructed)
// - context.construct_target: Location of 'user' identifier
//
// When processing: user.getName()
// 1. receiver_location points to 'user'
// 2. Look up 'user' in scope
// 3. Find SymbolDefinition for 'user'
// 4. Search for SymbolReference where:
//    - type === "construct"
//    - context.construct_target === 'user' location
// 5. Extract class name from that reference
// 6. Resolve method on that class
```

**Alternative approach without construct_target:**

Store the type directly on the SymbolDefinition when processing constructor assignments:

```typescript
// When processing: const user = new User();
// Create SymbolDefinition with:
// - name: "user"
// - kind: "variable"
// - type_info: { type_name: "User", certainty: "declared" }
//   ↑ Extracted from constructor at definition time
```

This would eliminate the need for construct_target by extracting the type immediately and storing it on the definition.

**Decision point:**

Two architectures:
1. **Store links (construct_target)**: Keep references separate, link via locations
2. **Store types directly**: Extract type at definition time, store in SymbolDefinition

The task requirements suggest a **query-first, extractable approach**. Tree-sitter can extract:
- Variable name: ✅
- Constructor class: ✅
- Type annotation: ✅

We can extract the type from `new User()` at the same time we extract the variable name. We don't need a separate linking mechanism.

However, the current architecture uses SymbolReference to track all uses of symbols, including constructs. The construct_target creates a link from the constructor call back to the variable being initialized.

**Revised question:** Does construct_target serve method resolution, or is it an architectural choice about how we structure the data?

**Answer:** It serves method resolution in the current architecture. To resolve `user.getName()` when `user = new User()`, we need to know the constructor class. The construct_target provides the link to find this information.

**Could we do without it?** Yes, if we stored the constructor class name directly on the SymbolDefinition. But that would require changing the SymbolDefinition interface and the extraction logic.

**Given current architecture:** ✅ Essential

#### Decision: ✅ **KEEP**

**Rationale:** Essential for resolving method calls on constructed objects when no explicit type annotation exists. Constructors are one of the most reliable ways to determine an object's type, and construct_target provides the link between the constructor call and the variable being initialized. While an alternative architecture could avoid this field by storing the type directly on the definition, the current architecture relies on it for method resolution.

**Critical pattern:**
```typescript
const obj = new MyClass();
obj.method();  // Cannot resolve without knowing obj was constructed from MyClass
               // construct_target provides this link
```

---

### 5. containing_function

**Current Definition:**
```typescript
/** For returns: the containing function */
readonly containing_function?: SymbolId;
```

#### Tree-sitter Extractability: ⚠️ REQUIRES TRAVERSAL

**Query Pattern:**

Tree-sitter can capture return statements and their containing functions, but it requires AST traversal, not a simple query pattern:

```scheme
; Return statement
(return_statement
  (_) @return.value
) @return

; The containing function must be found by traversing up the tree
; Cannot be captured directly in a query
```

**Implementation Approach:**

To extract `containing_function`, we need to:
1. Capture the return statement node
2. Traverse up the AST to find the parent function/method node
3. Extract the function's SymbolId (requires scope tracking)

This is extractable but requires additional logic beyond simple query captures:

```typescript
function extract_containing_function(
  return_node: SyntaxNode,
  scope_stack: ScopeId[]
): SymbolId | undefined {
  let current = return_node.parent;

  while (current) {
    if (is_function_node(current)) {
      // Find the scope_id for this function
      // Look up the function's SymbolId
      return function_symbol_id;
    }
    current = current.parent;
  }

  return undefined;
}
```

**Tree-sitter Extractability: ✅ YES** (with scope traversal)

While not a direct query capture, this is extractable through AST traversal, which is a standard tree-sitter operation. We already do scope traversal for other features.

#### Method Resolution Utility: ❌ **NOT RELEVANT**

**Potential Use Case: Return type tracking?**

The field is documented as "For returns: the containing function". Let's analyze if this helps method resolution:

**Scenario 1: Method returning an object**
```typescript
class Factory {
  createUser(): User {
    return new User();
  }
}

const factory = new Factory();
const user = factory.createUser();
user.getName();  // Need to resolve getName() on user
```

**Analysis:**
To resolve `user.getName()`:
1. receiver_location points to 'user'
2. Look up 'user' → defined as result of `factory.createUser()`
3. Resolve `createUser()` method on Factory class
4. Find createUser() definition
5. Extract return type annotation: `User`
6. Resolve getName() on User class

**Question:** Does knowing the containing_function help?

**When processing the return statement:**
```typescript
return new User();
// If we store:
// - containing_function: SymbolId of 'createUser'
//
// This links the return to its function, but...
// For method resolution, we need the RETURN TYPE, not the containing function
```

**The return type comes from the function's type annotation, not from the containing_function field.**

**Scenario 2: Chained method calls**
```typescript
class Service {
  getData() {
    return { items: [...] };
  }
}

service.getData().items.forEach(...);
```

**Analysis:**
To resolve this chain:
1. Resolve getData() on Service
2. Find getData() definition
3. Extract return type (either annotated or inferred)
4. Resolve items property on return type

**Does containing_function help?** No. We need the return type annotation from the function definition, which is stored in `SymbolDefinition.return_type_hint`, not in a return statement's containing_function.

#### Critical Insight: Return Type vs. Containing Function

**Two different pieces of information:**

1. **Return type** (needed for method resolution):
   - "What type does this function return?"
   - Stored in: `SymbolDefinition.return_type_hint`
   - Extractable from: Function's return type annotation

2. **Containing function** (not needed for method resolution):
   - "Which function does this return statement belong to?"
   - Would be stored in: `ReferenceContext.containing_function`
   - Extractable from: AST traversal

**For method resolution, we need #1, not #2.**

**Example:**
```typescript
function factory(): User {
  return new User();
}

const user = factory();
user.getName();
```

To resolve `user.getName()`:
- ✅ Need: Return type annotation `User` from factory() definition
- ❌ Don't need: Knowledge that `new User()` is inside factory()

The return type is extracted when processing the function definition and stored in `SymbolDefinition.return_type_hint`. We don't need to track which function a return statement belongs to.

#### Method Resolution Utility: ❌ **NOT ESSENTIAL**

**Why not essential:**
- **Wrong granularity**: Method resolution needs return TYPES, not containing FUNCTIONS
- **Information is elsewhere**: Return types stored in SymbolDefinition.return_type_hint
- **No use case**: Cannot identify a scenario where containing_function helps resolve methods

**When would it be useful (but out of scope):**
- Control flow analysis
- Return statement validation
- Function complexity metrics
- IDE features (navigate from return to function)

#### Decision: ❌ **REMOVE**

**Rationale:** While extractable via tree-sitter, this field does not serve method resolution. Method resolution requires return TYPES (from function annotations), not links from return statements to containing functions. The return type information is already stored in `SymbolDefinition.return_type_hint` when processing function definitions. This field might be valuable for other analyses (control flow, validation), but it's not essential for the core goal of resolving method calls.

---

## Summary Matrix

| Attribute | Extractable | Method Resolution | Tree-sitter Pattern | Decision |
|-----------|-------------|-------------------|---------------------|----------|
| **receiver_location** | ✅ Yes | ✅ Essential | Direct node capture | ✅ **KEEP** |
| **property_chain** | ✅ Yes | ✅ Essential | Recursive traversal | ✅ **KEEP** |
| **assignment_source** | ✅ Yes | ❌ Not needed | Assignment node | ❌ **REMOVE** |
| **assignment_target** | ✅ Yes | ❌ Not needed | Assignment node | ❌ **REMOVE** |
| **construct_target** | ✅ Yes | ✅ Essential | Constructor pattern | ✅ **KEEP** |
| **containing_function** | ✅ Yes (traversal) | ❌ Not needed | Parent traversal | ❌ **REMOVE** |

---

## Refined ReferenceContext Interface

### Current (6 attributes):
```typescript
export interface ReferenceContext {
  readonly receiver_location?: Location;
  readonly assignment_source?: Location;
  readonly assignment_target?: Location;
  readonly construct_target?: Location;
  readonly containing_function?: SymbolId;
  readonly property_chain?: readonly SymbolName[];
}
```

### Proposed (3 attributes):
```typescript
export interface ReferenceContext {
  /** For method calls: the receiver object location (essential for method resolution) */
  readonly receiver_location?: Location;

  /** For member access: the property chain (essential for chained method resolution) */
  readonly property_chain?: readonly SymbolName[];

  /** For constructor calls: the variable being assigned to (essential for type determination) */
  readonly construct_target?: Location;
}
```

**Reduction:** 6 attributes → 3 attributes (50% reduction)

---

## Tree-sitter Query Patterns by Attribute

### receiver_location

**TypeScript/JavaScript:**
```scheme
(call_expression
  function: (member_expression
    object: (_) @receiver
    property: (property_identifier) @method
  )
)
```

**Python:**
```scheme
(call
  function: (attribute
    object: (_) @receiver
    attribute: (identifier) @method
  )
)
```

**Rust:**
```scheme
(call_expression
  function: (field_expression
    value: (_) @receiver
    field: (field_identifier) @method
  )
)
```

### property_chain

**TypeScript/JavaScript:**
```scheme
; Must be extracted via recursive traversal
(member_expression
  object: (member_expression
    object: (identifier) @chain.root
    property: (property_identifier) @chain.prop1
  )
  property: (property_identifier) @chain.prop2
)
```

**Python:**
```scheme
(attribute
  object: (attribute
    object: (identifier) @chain.root
    attribute: (identifier) @chain.attr1
  )
  attribute: (identifier) @chain.attr2
)
```

**Rust:**
```scheme
(field_expression
  value: (field_expression
    value: (identifier) @chain.root
    field: (field_identifier) @chain.field1
  )
  field: (field_identifier) @chain.field2
)
```

### construct_target

**TypeScript/JavaScript:**
```scheme
(variable_declarator
  name: (identifier) @construct.target
  value: (new_expression
    constructor: (identifier) @construct.class
  )
)
```

**Python:**
```scheme
; Python uses call, not 'new' keyword
(assignment
  left: (identifier) @construct.target
  right: (call
    function: (identifier) @construct.class
  )
)
```

**Rust:**
```scheme
(let_declaration
  pattern: (identifier) @construct.target
  value: (struct_expression
    name: (type_identifier) @construct.type
  )
)
```

---

## Method Resolution Scenarios by Attribute

### receiver_location

**Scenario:** Resolve method on explicitly typed receiver
```typescript
const user: User = getUser();
user.getName();
```

**Resolution Process:**
1. receiver_location → 'user' identifier at line X
2. Look up 'user' in scope → find SymbolDefinition
3. Extract type_info → User
4. Resolve getName() in User class

---

**Scenario:** Resolve method on constructed receiver
```typescript
const user = new User();
user.getName();
```

**Resolution Process:**
1. receiver_location → 'user' identifier at line X
2. Look up 'user' in scope → find SymbolDefinition
3. Find construct_target link → 'new User()'
4. Extract constructor class → User
5. Resolve getName() in User class

---

### property_chain

**Scenario:** Resolve chained method call
```typescript
container.getUser().getName();
```

**Resolution Process:**
1. property_chain → ['container', 'getUser', 'getName']
2. Resolve 'container' type → Container
3. Resolve getUser() on Container → returns User
4. Resolve getName() on User → final method

---

**Scenario:** Resolve nested property access
```typescript
config.database.connection.host;
```

**Resolution Process:**
1. property_chain → ['config', 'database', 'connection', 'host']
2. Resolve 'config' type → Config
3. Resolve database property → DatabaseConfig
4. Resolve connection property → ConnectionConfig
5. Resolve host property → string

---

### construct_target

**Scenario:** Resolve method on constructed object without type annotation
```typescript
const user = new User();
user.getName();
```

**Resolution Process:**
1. receiver_location → 'user'
2. Look up 'user' → find SymbolDefinition
3. Search for SymbolReference where:
   - type === "construct"
   - construct_target === 'user' location
4. Extract constructor class → User
5. Resolve getName() on User

---

**Scenario:** Track constructor for type verification
```typescript
const user: User = new User();
user.getName();
```

**Resolution Process:**
1. Primary: Use type annotation → User
2. Verification: Check construct_target matches → new User()
3. Confirm type consistency
4. Resolve getName() on User

---

## Implementation Notes

### Metadata Extractor Functions

The following extractors support the kept attributes:

1. **extract_call_receiver()** → receiver_location
   - Location: `metadata_types.ts:44-47`
   - Returns: `Location | undefined`

2. **extract_property_chain()** → property_chain
   - Location: `metadata_types.ts:63-65`
   - Returns: `SymbolName[] | undefined`

3. **extract_construct_target()** → construct_target
   - Location: `metadata_types.ts:105-108`
   - Returns: `Location | undefined`

### Removed Extractor Functions

These extractors are no longer needed:

1. **extract_assignment_parts()** → assignment_source/target
   - Location: `metadata_types.ts:82-88`
   - Status: ❌ Remove

2. **Containing function traversal** → containing_function
   - Status: ❌ Remove

---

## Cross-Language Verification

All kept attributes work across all supported languages:

| Attribute | JavaScript | TypeScript | Python | Rust |
|-----------|-----------|------------|--------|------|
| receiver_location | ✅ member_expression | ✅ member_expression | ✅ attribute | ✅ field_expression |
| property_chain | ✅ nested member_expression | ✅ nested member_expression | ✅ nested attribute | ✅ nested field_expression |
| construct_target | ✅ new_expression | ✅ new_expression | ✅ call (class instantiation) | ✅ struct_expression |

---

## Success Criteria

- ✅ Every kept attribute is extractable via tree-sitter
- ✅ Every kept attribute serves method call resolution
- ✅ Clear tree-sitter query pattern documented for each attribute
- ✅ Method resolution scenario documented for each attribute
- ✅ Justification provided for all keep/remove decisions
- ✅ Reduced from 6 attributes to 3 essential attributes
- ✅ Cross-language parity verified

---

## Next Steps

1. **Review this analysis** with team/stakeholders
2. **Proceed to task 11.106.2** - Remove non-extractable type attributes
3. **Proceed to task 11.106.4** - Implement ReferenceContext refinements
4. **Update tests** to cover only kept attributes

---

**Date:** 2025-10-01
**Status:** Analysis Complete
**Recommendation:** Proceed with removing `assignment_source`, `assignment_target`, and `containing_function`
