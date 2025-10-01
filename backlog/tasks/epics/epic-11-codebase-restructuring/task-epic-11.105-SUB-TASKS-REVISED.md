# Task Epic 11.105 Sub-Tasks (Revised)

## Overview

Extract type data during semantic indexing for use by task 11.109's resolution system. This is a DATA EXTRACTION task, not a resolution task.

**Total Time:** 7-10 hours

## Sub-Task List

### 11.105.1: Extract Type Annotations (1-2 hours)

**Objective:** Extract type names from explicit annotations

**File:** `type_preprocessing/type_bindings.ts`

**Extract From:**
- `VariableDefinition.type` → variable type annotations
- `ParameterDefinition.type` → parameter type annotations
- `FunctionDefinition.return_type` → return type annotations

**Function:**
```typescript
export function extract_type_annotations(
  definitions: BuilderResult
): Map<LocationKey, SymbolName> {
  const bindings = new Map();

  // Variables
  for (const [var_id, var_def] of definitions.variables) {
    if (var_def.type) {
      bindings.set(location_key(var_def.location), var_def.type);
    }
  }

  // Parameters (from functions, methods)
  // ... extract from function.signature.parameters
  // ... extract from class.methods[].parameters

  // Return types tracked separately for function call resolution

  return bindings;
}
```

**Test Cases:**
- Variable with type: `const x: User = ...`
- Parameter with type: `function f(x: User)`
- Optional types: `x?: User`
- All 4 languages

---

### 11.105.2: Extract Constructor Bindings (1-2 hours)

**Objective:** Track constructor → variable assignments

**File:** `type_preprocessing/constructor_tracking.ts`

**Extract From:**
- `SymbolReference` with `call_type === "constructor"`
- `ref.context.construct_target` → location of assigned variable
- `ref.name` → class name being constructed

**Function:**
```typescript
export function extract_constructor_bindings(
  references: readonly SymbolReference[]
): Map<LocationKey, SymbolName> {
  const bindings = new Map();

  for (const ref of references) {
    if (ref.call_type === "constructor" && ref.context?.construct_target) {
      const target_key = location_key(ref.context.construct_target);
      bindings.set(target_key, ref.name);
    }
  }

  return bindings;
}
```

**Test Cases:**
- Direct construction: `const x = new User()`
- Property construction: `this.user = new User()`
- Python construction: `user = User()`
- Rust construction: `let user = User::new()`

---

### 11.105.3: Build Type Member Index (2 hours)

**Objective:** Create type → members maps from definitions

**File:** `type_preprocessing/member_extraction.ts`

**Extract From:**
- `ClassDefinition.methods` → method list
- `ClassDefinition.properties` → property list
- `ClassDefinition.constructor` → constructor
- `ClassDefinition.extends` → inheritance
- `InterfaceDefinition.methods` → method signatures
- `InterfaceDefinition.properties` → property signatures

**Function:**
```typescript
export function extract_type_members(
  definitions: BuilderResult
): Map<SymbolId, TypeMemberInfo> {
  const members = new Map();

  // Classes
  for (const [class_id, class_def] of definitions.classes) {
    const methods = new Map();
    const properties = new Map();

    for (const method of class_def.methods) {
      methods.set(method.name, method.symbol_id);
    }

    for (const prop of class_def.properties) {
      properties.set(prop.name, prop.symbol_id);
    }

    members.set(class_id, {
      methods,
      properties,
      constructor: class_def.constructor?.[0]?.symbol_id,
      extends: class_def.extends,
    });
  }

  // Interfaces
  // ... similar for interfaces

  return members;
}
```

**Test Cases:**
- Class with methods and properties
- Interface with method signatures
- Inheritance tracking
- Static vs instance members
- All 4 languages

---

### 11.105.4: Extract Type Alias Metadata (30 minutes)

**Objective:** Extract raw type alias data (NOT resolved)

**File:** `type_preprocessing/alias_extraction.ts`

**Extract From:**
- `TypeAliasDefinition.name` → alias name
- `TypeAliasDefinition.type_expression` → type name string (not resolved!)

**Function:**
```typescript
export function extract_type_alias_metadata(
  type_defs: ReadonlyMap<SymbolId, TypeAliasDefinition>
): Map<SymbolId, string> {
  const metadata = new Map();

  for (const [alias_id, type_alias] of type_defs) {
    if (type_alias.type_expression) {
      // Store the raw string, don't resolve it!
      metadata.set(alias_id, type_alias.type_expression);
    }
  }

  return metadata;
}
```

**Output:** `Map<SymbolId, string>` (alias → type_expression string)

**Test Cases:**
- Simple alias: `type UserId = string` → `{UserId id → "string"}`
- Class alias: `type MyUser = User` → `{MyUser id → "User"}`
- Imported alias: `import {User}; type MyUser = User` → `{MyUser id → "User"}` (NOT resolved to User SymbolId!)

**Important:** This task does NOT resolve type names. Resolution (string → SymbolId) requires scope-aware lookup and happens in 11.109.3 using ScopeResolver.

---

### 11.105.5: Integrate into SemanticIndex (1 hour)

**Objective:** Add extraction to indexing pipeline

**Files:**
- `semantic_index.ts` - Add interface fields
- `semantic_index.ts` - Update build function

**Changes to Interface:**
```typescript
export interface SemanticIndex {
  // ... existing fields ...

  /** Type bindings: location → type name */
  readonly type_bindings: ReadonlyMap<LocationKey, SymbolName>;

  /** Type members: type → methods/properties */
  readonly type_members: ReadonlyMap<SymbolId, TypeMemberInfo>;

  /** Type alias metadata: alias → type_expression string (NOT resolved) */
  readonly type_alias_metadata: ReadonlyMap<SymbolId, string>;
}
```

**Changes to Build Function:**
```typescript
export function build_semantic_index(
  file: ParsedFile,
  tree: Tree,
  language: Language
): SemanticIndex {
  // ... existing passes 1-5 ...

  // PASS 6: Extract type data
  const type_annotations = extract_type_annotations(builder_result);
  const constructor_bindings = extract_constructor_bindings(all_references);
  const type_members = extract_type_members(builder_result);
  const type_alias_metadata = extract_type_alias_metadata(builder_result.types);

  // Merge annotation and constructor bindings
  const type_bindings = new Map([
    ...type_annotations,
    ...constructor_bindings,
  ]);

  return {
    // ... existing fields ...
    type_bindings,
    type_members,
    type_alias_metadata,
  };
}
```

**Test Cases:**
- Verify fields present in index
- Verify data correct
- Performance benchmarks

---

### 11.105.6: Testing (2-3 hours)

**Objective:** Comprehensive test coverage

**Test Files:**
- `type_bindings.test.ts`
- `constructor_tracking.test.ts`
- `member_extraction.test.ts`
- `alias_extraction.test.ts`
- `integration.test.ts`

**Test Categories:**

**Type Annotation Extraction:**
- Variable annotations
- Parameter annotations
- Optional types
- Union types (basic)

**Constructor Tracking:**
- Direct construction
- Property construction
- Language-specific patterns

**Member Indexing:**
- Class methods and properties
- Interface methods and properties
- Inheritance chains
- Static members

**Type Alias Extraction:**
- Simple aliases
- Class/interface aliases
- Chained aliases

**Integration:**
- End-to-end semantic indexing
- All languages
- Complex realistic examples

**Coverage Goals:**
- Line coverage: >90%
- Branch coverage: >85%
- Function coverage: 100%

---

## Execution Order

**Sequential (can't parallelize):**
1. 105.1 (Type annotations)
2. 105.2 (Constructor bindings)
3. 105.3 (Member indexing)
4. 105.4 (Type aliases)
5. 105.5 (Integration)
6. 105.6 (Testing - can start during implementation)

**Total:** 7-10 hours

---

## Key Principles

### 1. Extract Names, Not Symbols
Store `SymbolName` (strings), not `SymbolId`:
- Type name resolution is scope-aware
- Must be done by 11.109's ScopeResolver
- Don't have scope context during extraction

### 2. Leverage Existing Data
- SymbolReference has `construct_target`, `type_info`, `return_type`
- Definitions have `type`, `return_type`, `members`
- Just organize this data efficiently

### 3. No Resolution
This task does NOT:
- Resolve type names to SymbolIds
- Resolve receivers
- Resolve method calls
- Do scope walking

### 4. Prepare for 11.109
Data format matches what 11.109.3 (TypeContext) expects:
- `type_bindings` for variable type tracking
- `type_members` for method lookup
- `type_alias_metadata` for alias resolution (11.109.3 resolves these to SymbolIds)

---

## Success Criteria

- ✅ All extractors implemented
- ✅ Data added to SemanticIndex
- ✅ All 4 languages supported
- ✅ Comprehensive tests
- ✅ >90% coverage
- ✅ Ready for 11.109.3 to consume
- ✅ No performance regression

---

## Integration Points

**Provides Data To:**
- task-epic-11.109.3 (TypeContext)
  - Uses `type_bindings` for variable types
  - Uses `type_members` for method lookup
  - Uses `type_aliases` for alias resolution

**No Dependencies:**
- Uses existing SemanticIndex structure
- Uses existing SymbolReference data
- Uses existing definitions
