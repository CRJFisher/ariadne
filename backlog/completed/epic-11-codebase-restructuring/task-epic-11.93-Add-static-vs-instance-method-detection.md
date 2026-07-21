# Task 11.93: Add Static vs Instance Method Detection

## Status: Completed

## Objective
Implement static vs instance method detection in the semantic indexer and apply it in symbol resolution to correctly resolve method calls based on whether they are static (class-level) or instance (object-level) invocations.

## Problem Statement
Currently, the system cannot distinguish between static and instance method calls, leading to incorrect method resolution. For example:
- `ClassName.method()` (static call) vs `instance.method()` (instance call)
- Both would resolve incorrectly without knowing the access type
- Classes with both static and instance methods of the same name would be ambiguous

## Implementation Requirements

### Phase 1: Enhance Semantic Index Infrastructure

#### 1.1 Update MemberAccessReference Interface
**File**: `/packages/core/src/semantic_index/references/member_access_references/member_access_references.ts`

Add static detection field:
```typescript
export interface MemberAccessReference {
  // ... existing fields ...

  /** Whether this is a static access (on a class/type) vs instance */
  readonly is_static?: boolean;

  /** Symbol ID of the object being accessed (if resolvable) */
  readonly object_symbol?: SymbolId;
}
```

#### 1.2 Enhance Query Patterns
**Files**:
- `/packages/core/src/semantic_index/queries/typescript.scm`
- `/packages/core/src/semantic_index/queries/javascript.scm`
- `/packages/core/src/semantic_index/queries/python.scm`
- `/packages/core/src/semantic_index/queries/rust.scm`

Add patterns to distinguish static access:

**TypeScript/JavaScript**:
```scheme
; Static method call - object is a class identifier
(call_expression
  function: (member_expression
    object: (identifier) @class.ref
    property: (property_identifier) @method.static)
  (#match? @class.ref "^[A-Z]"))  ; Heuristic: capitalized = likely class

; Instance method call - object is lowercase/instance
(call_expression
  function: (member_expression
    object: (identifier) @instance.ref
    property: (property_identifier) @method.instance)
  (#not-match? @instance.ref "^[A-Z]"))
```

**Python**:
```scheme
; Static/class method with decorator
(decorated_definition
  (decorator (identifier) @decorator.type)
  (function_definition
    name: (identifier) @method.static)
  (#match? @decorator.type "^(staticmethod|classmethod)$"))

; Instance method (first param is self)
(function_definition
  parameters: (parameters
    . (identifier) @param.self)
  name: (identifier) @method.instance
  (#eq? @param.self "self"))
```

**Rust**:
```scheme
; Associated function (static) - uses ::
(call_expression
  function: (scoped_identifier
    path: (identifier) @type.ref
    name: (identifier) @method.static))

; Method call (instance) - uses .
(call_expression
  function: (field_expression
    value: (_) @instance.ref
    field: (field_identifier) @method.instance))
```

#### 1.3 Update Capture Processing
**File**: `/packages/core/src/semantic_index/references/member_access_references/member_access_references.ts`

Modify `create_member_access_reference` function to:
```typescript
function create_member_access_reference(
  capture: NormalizedCapture,
  scope: LexicalScope,
  file_path: FilePath,
  symbols: Map<SymbolId, SymbolDefinition>  // Add symbols map
): MemberAccessReference {
  // ... existing code ...

  // Determine if static access
  const is_static = determine_static_access(capture, symbols);

  // Try to resolve object symbol
  const object_symbol = resolve_object_symbol(
    context?.receiver_node,
    scope,
    symbols
  );

  return {
    // ... existing fields ...
    is_static,
    object_symbol,
  };
}

function determine_static_access(
  capture: NormalizedCapture,
  symbols: Map<SymbolId, SymbolDefinition>
): boolean {
  // Check capture tags for static indicators
  if (capture.tag?.includes("static") ||
      capture.tag?.includes("class.ref")) {
    return true;
  }

  // Language-specific checks
  const context = capture.context;
  if (context?.decorator === "staticmethod" ||
      context?.decorator === "classmethod") {
    return true;  // Python static/class methods
  }

  if (context?.operator === "::" && !context?.operator?.includes(".")) {
    return true;  // Rust associated functions
  }

  // Check if object is a known class/type
  if (context?.receiver_text) {
    const symbol = find_symbol_by_name(context.receiver_text, symbols);
    if (symbol?.kind === "class" ||
        symbol?.kind === "interface" ||
        symbol?.kind === "type_alias") {
      return true;
    }
  }

  return false;
}
```

### Phase 2: Apply in Symbol Resolution

#### 2.1 Update Method Resolution
**File**: `/packages/core/src/symbol_resolution/method_resolution/static_resolution.ts`

Implement proper static detection:
```typescript
export function determine_if_static_call(
  member_access: MemberAccessReference,
  context: MethodLookupContext
): boolean {
  // 1. Use explicit static flag if available
  if (member_access.is_static !== undefined) {
    return member_access.is_static;
  }

  // 2. Check if object is a class/type symbol
  if (member_access.object_symbol) {
    const symbol_def = context.current_index.symbols.get(
      member_access.object_symbol
    );
    if (symbol_def && (
      symbol_def.kind === "class" ||
      symbol_def.kind === "type_alias" ||
      symbol_def.kind === "interface"
    )) {
      return true;
    }
  }

  // 3. Fall back to heuristics if needed
  if (member_access.object.location) {
    // Try to resolve symbol at location
    const symbol = find_symbol_at_location(
      member_access.object.location,
      context
    );
    if (symbol) {
      const def = context.current_index.symbols.get(symbol);
      return def?.kind === "class" ||
             def?.kind === "type_alias" ||
             def?.kind === "interface";
    }
  }

  return false;  // Default to instance
}
```

#### 2.2 Update Method Lookup
**File**: `/packages/core/src/symbol_resolution/method_resolution/method_lookup.ts`

Modify lookup to consider static vs instance:
```typescript
export function lookup_method(
  class_symbol: SymbolId,
  method_name: SymbolName,
  is_static: boolean,
  context: MethodLookupContext
): SymbolId | undefined {
  const class_def = context.current_index.symbols.get(class_symbol);
  if (!class_def || class_def.kind !== "class") {
    return undefined;
  }

  // Get appropriate method collection based on static/instance
  const methods = is_static
    ? class_def.static_methods
    : class_def.methods;

  // Look for method in appropriate collection
  const method = methods?.find(m => m.name === method_name);
  if (method) {
    return method.symbol_id;
  }

  // Check parent classes for inherited methods
  if (class_def.extends) {
    return lookup_method(
      class_def.extends,
      method_name,
      is_static,  // Maintain static/instance context
      context
    );
  }

  return undefined;
}
```

#### 2.3 Add Symbol Location Resolution
**File**: `/packages/core/src/symbol_resolution/utils/symbol_location_lookup.ts` (new)

Create utility for resolving symbols at locations:
```typescript
export function find_symbol_at_location(
  location: Location | undefined,
  context: MethodLookupContext
): SymbolId | undefined {
  if (!location) return undefined;

  // Check local scope symbols first
  const local_symbol = find_in_scope_tree(
    location,
    context.scope_tree
  );
  if (local_symbol) return local_symbol;

  // Check imported symbols
  const imported_symbol = find_in_imports(
    location,
    context.current_index.imports
  );
  if (imported_symbol) return imported_symbol;

  // Check global symbols
  return find_in_globals(
    location,
    context.current_index.symbols
  );
}
```

### Phase 3: Update Symbol Definitions

#### 3.1 Enhance Class Definition Structure
**File**: `/packages/core/src/semantic_index/symbols/class_symbols.ts`

Separate static and instance members:
```typescript
export interface ClassDefinition {
  // ... existing fields ...

  /** Instance methods */
  readonly methods: MethodDefinition[];

  /** Static methods */
  readonly static_methods: MethodDefinition[];

  /** Instance properties */
  readonly properties: PropertyDefinition[];

  /** Static properties */
  readonly static_properties: PropertyDefinition[];
}
```

#### 3.2 Update Class Symbol Processing
Modify class processing to categorize methods/properties:
```typescript
function process_class_methods(
  captures: NormalizedCapture[],
  class_name: SymbolName
): {
  instance_methods: MethodDefinition[],
  static_methods: MethodDefinition[]
} {
  const instance_methods: MethodDefinition[] = [];
  const static_methods: MethodDefinition[] = [];

  for (const capture of captures) {
    if (capture.entity === SemanticEntity.METHOD) {
      const method = create_method_definition(capture);

      // Check if static based on modifiers or decorators
      const is_static =
        capture.modifiers?.includes("static") ||
        capture.context?.decorator === "staticmethod" ||
        capture.context?.decorator === "classmethod" ||
        capture.tag?.includes("static");

      if (is_static) {
        static_methods.push(method);
      } else {
        instance_methods.push(method);
      }
    }
  }

  return { instance_methods, static_methods };
}
```

### Phase 4: Testing Requirements

#### 4.1 Create Test Cases
**File**: `/packages/core/src/symbol_resolution/method_resolution/static_resolution.test.ts`

Test scenarios:
1. Static method on class name
2. Instance method on object
3. Inherited static methods
4. Inherited instance methods
5. Same-named static and instance methods
6. Constructor calls (always instance)
7. Factory methods (static returning instance)

#### 4.2 Cross-Language Tests
Create fixtures for each language showing:
- Static method calls
- Instance method calls
- Mixed scenarios
- Edge cases (computed properties, dynamic dispatch)

### Phase 5: Language-Specific Considerations

#### TypeScript/JavaScript
- Handle prototype methods vs static methods
- Consider constructor functions vs classes
- Handle `this` context in static methods

#### Python
- `@staticmethod` - no implicit first argument
- `@classmethod` - first argument is class
- Regular methods - first argument is `self`
- Handle metaclass methods

#### Rust
- Associated functions (Type::function)
- Methods with self/&self/&mut self
- Trait implementations
- Handle impl blocks

## Success Criteria
1. ✅ MemberAccessReference includes is_static field
2. ✅ Query patterns distinguish static from instance access
3. ✅ Symbol resolution correctly uses static/instance context
4. ✅ Method lookup finds correct method based on access type
5. ✅ Tests pass for all supported languages
6. ✅ Same-named static and instance methods resolve correctly

## Dependencies
- Requires semantic index to be fully operational
- Requires scope tree for local symbol resolution
- Requires import resolution for cross-file lookups

## Notes
- Start with TypeScript/JavaScript as they have clearest static/instance distinction
- Python's @staticmethod/@classmethod decorators provide explicit signals
- Rust's :: vs . operators provide syntactic distinction
- Consider caching symbol lookups for performance

## Follow-up Tasks
- Add support for static property access
- Handle static initialization blocks
- Support static generic methods
- Add performance optimizations for symbol lookup