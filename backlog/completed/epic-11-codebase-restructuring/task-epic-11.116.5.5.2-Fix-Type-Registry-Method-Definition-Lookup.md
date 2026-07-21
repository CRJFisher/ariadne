# Task epic-11.116.5.5.2: Fix Type Registry Method Definition Lookup

**Status:** Completed
**Parent:** task-epic-11.116.5.5
**Priority:** Medium
**Created:** 2025-10-16

## Overview

Type registry stores method symbol IDs, but those symbol IDs are not always found in the DefinitionRegistry. This breaks the link between type information and actual method definitions.

**Discovered in:** TypeScript Project Integration Tests (see test: "should resolve imported class method calls")

## Problem Description

### Current Behavior

When querying type information for a class:

```typescript
const type_info = project.get_type_info(user_class.symbol_id);
// type_info.methods = Map<SymbolName, SymbolId>

const get_name_method_id = type_info.methods.get("getName");
// get_name_method_id exists ✓

const method_def = project.definitions.get(get_name_method_id);
// method_def is undefined ❌
```

The method symbol ID exists in the type registry, but looking it up in the definition registry returns `undefined`.

### Root Cause

There's a mismatch between:
1. **Symbol IDs stored in TypeRegistry**: Created during type processing
2. **Symbol IDs in DefinitionRegistry**: Created during semantic indexing

These may be:
- Different symbol IDs for the same method
- Method definitions not being registered in DefinitionRegistry
- Symbol ID generation inconsistency

**Likely location:** Type registry update in `TypeRegistry.update_file()` or method definition processing.

## Expected Behavior

When a method is tracked in the type registry:
1. Its symbol ID should match the MethodDefinition's symbol ID
2. Looking up that symbol ID in DefinitionRegistry should return the MethodDefinition
3. The chain: TypeRegistry → SymbolId → DefinitionRegistry → MethodDefinition should work seamlessly

## Technical Details

### Type Registry Structure

```typescript
class TypeRegistry {
  // Stores: ClassSymbolId → { methods: Map<MethodName, MethodSymbolId> }
  private type_members: Map<SymbolId, TypeMembers>;
}

interface TypeMembers {
  methods: Map<SymbolName, SymbolId>;  // ← These SymbolIds should be in DefinitionRegistry
  properties: Map<SymbolName, SymbolId>;
  // ...
}
```

### Definition Registry Structure

```typescript
class DefinitionRegistry {
  private definitions: Map<SymbolId, AnyDefinition>;  // ← Should contain method SymbolIds
}
```

## Investigation Steps

### 1. Verify Symbol ID Consistency

Check if method symbol IDs are being generated consistently:

```typescript
// In semantic_index.ts - method definition creation
const method_id = method_symbol(name, class_name, file_path, location);

// In type_registry.ts - type member tracking
const method_id = ???  // How is this created?
```

**Files to check:**
- `packages/core/src/index_single_file/definitions/method_processor.ts`
- `packages/core/src/resolve_references/registries/type_registry.ts`

### 2. Verify Definition Registration

Check if method definitions are added to DefinitionRegistry:

```typescript
// In project.ts update_file():
const all_definitions: AnyDefinition[] = [
  ...Array.from(semantic_index.functions.values()),
  ...Array.from(semantic_index.classes.values()),
  // Are methods included here? ← Check this
];

this.definitions.update_file(file_id, all_definitions);
```

**Files to check:**
- `packages/core/src/project/project.ts` (lines 164-173)
- How are methods stored in SemanticIndex?

### 3. Check TypeRegistry Update Timing

Type registry is updated AFTER resolution:

```typescript
// Phase 4: Update type registry for all affected files
for (const affected_file of affected_files) {
  this.types.update_file(
    affected_file,
    affected_index,
    this.definitions,  // ← Are method definitions already here?
    this.resolutions
  );
}
```

## Possible Solutions

### Option 1: Ensure Methods Are Registered (Most Likely)

Methods might not be included in the `all_definitions` array.

**Fix:**
```typescript
const all_definitions: AnyDefinition[] = [
  ...Array.from(semantic_index.functions.values()),
  ...Array.from(semantic_index.classes.values()),
  ...Array.from(semantic_index.variables.values()),
  ...Array.from(semantic_index.interfaces.values()),
  ...Array.from(semantic_index.enums.values()),
  ...Array.from(semantic_index.namespaces.values()),
  ...Array.from(semantic_index.types.values()),
  ...Array.from(semantic_index.imported_symbols.values()),
  // ADD: Method definitions if they exist separately
];
```

### Option 2: Fix Symbol ID Generation

If methods use different symbol IDs in different contexts:

**Fix:**
- Ensure `method_symbol()` is called consistently
- Use the same file_path, class_name, location everywhere
- Check if TypeRegistry is creating its own symbol IDs

### Option 3: Store Method Definitions with Classes

If methods are nested within class definitions:

**Fix:**
- Extract method definitions from class definitions
- Flatten them into top-level definitions array
- Or change lookup to search within class definitions

## Implementation Steps

1. **Trace method symbol ID creation**:
   - Add logging to see where method symbol IDs are created
   - Compare IDs from TypeRegistry vs SemanticIndex

2. **Verify method definition registration**:
   - Check if methods are in SemanticIndex at all
   - Check if they're being added to DefinitionRegistry
   - Add debug logging to DefinitionRegistry.update_file()

3. **Fix the root cause**:
   - Based on investigation, apply appropriate solution
   - Most likely: add methods to definitions array

4. **Update tests**:
   - Uncomment assertions in `project.typescript.integration.test.ts`
   - Verify method definitions can be looked up

## Files to Modify

Primary candidates:
- `packages/core/src/project/project.ts` - Definition registration
- `packages/core/src/resolve_references/registries/type_registry.ts` - Type member tracking
- `packages/core/src/index_single_file/semantic_index.ts` - Method storage in SemanticIndex

## Test Cases to Fix

In `project.typescript.integration.test.ts`:

**"should resolve imported class method calls"** (line 153)
```typescript
// TODO: Fix type registry to store method definitions properly
// Uncomment these lines:
const get_name_def = project.definitions.get(get_name_method_id!);
expect(get_name_def).toBeDefined();
expect(get_name_def!.location.file_path).toContain("types.ts");
```

## Success Criteria

- [ ] Method symbol IDs in TypeRegistry can be looked up in DefinitionRegistry
- [ ] Method definitions are properly registered during indexing
- [ ] Type-based method resolution returns valid MethodDefinitions
- [ ] Integration test assertions pass with comments removed

## Estimated Effort

**2-3 hours**
- 1 hour: Trace symbol ID creation and definition registration
- 1 hour: Implement fix (likely adding methods to definitions array)
- 30 min: Verify tests and check for regressions

## Related Issues

- Blocked by: None
- Blocks: Full type-based method resolution
- Related to: Method call resolution accuracy

---

## Implementation Notes

### Root Cause Identified

Methods are stored **inside** ClassDefinition, InterfaceDefinition, and EnumDefinition objects in the SemanticIndex, but were **not being extracted** and registered in the DefinitionRegistry.

From [symbol_definitions.ts](/Users/chuck/workspace/ariadne/packages/types/src/symbol_definitions.ts):
```typescript
interface ClassDefinition extends Definition {
  readonly methods: readonly MethodDefinition[];  // ← Nested methods!
  readonly constructor?: readonly ConstructorDefinition[];
  // ...
}

interface InterfaceDefinition extends Definition {
  readonly methods: readonly MethodDefinition[];  // ← Nested methods!
  // ...
}

interface EnumDefinition extends Definition {
  readonly methods?: readonly MethodDefinition[];  // ← Optional nested methods!
  // ...
}
```

### Solution Applied

Modified [project.ts:175-190](/Users/chuck/workspace/ariadne/packages/core/src/project/project.ts#L175-L190) to extract and flatten nested method definitions:

```typescript
// Extract methods from classes, interfaces, and enums
// Methods have their own symbol IDs and need to be registered separately
for (const class_def of semantic_index.classes.values()) {
  all_definitions.push(...class_def.methods);
  if (class_def.constructor) {
    all_definitions.push(...class_def.constructor);
  }
}
for (const interface_def of semantic_index.interfaces.values()) {
  all_definitions.push(...interface_def.methods);
}
for (const enum_def of semantic_index.enums.values()) {
  if (enum_def.methods) {
    all_definitions.push(...enum_def.methods);
  }
}
```

### Test Fix

Uncommented assertions in [project.typescript.integration.test.ts:195-198](/Users/chuck/workspace/ariadne/packages/core/src/project/project.typescript.integration.test.ts#L195-L198):

```typescript
// Verify method definition can be looked up in definition registry
const get_name_def = project.definitions.get(get_name_method_id!);
expect(get_name_def).toBeDefined();
expect(get_name_def!.location.file_path).toContain("types.ts");
```

### Results

All 13 integration tests pass:

- ✅ Method symbol IDs from TypeRegistry can now be looked up in DefinitionRegistry
- ✅ The complete chain works: TypeRegistry → SymbolId → DefinitionRegistry → MethodDefinition
- ✅ Type-based method resolution is fully functional

**Completion Time:** ~45 minutes (including investigation and testing)
