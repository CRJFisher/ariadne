# Task 105.8: Migrate Tests from local_types to index.classes

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1.5 hours
**Parent:** task-epic-11.105
**Dependencies:** task-epic-11.105.2, task-epic-11.105.6

## Objective

Update tests that use `index.local_types` to access class members to instead use the canonical `index.classes`. This completes the migration after `local_types` was removed.

## Problem

Tests currently check class methods/properties via `local_types`:

```typescript
const pointType = index.local_types.find(t => t.type_name === "Point");
expect(pointType.direct_members.has("new")).toBe(true);
```

Should use canonical source:

```typescript
const pointClass = Array.from(index.classes.values())
  .find(c => c.name === "Point");
expect(pointClass.methods.some(m => m.name === "new")).toBe(true);
```

## Files to Migrate

### Primary Target

**File:** `src/index_single_file/semantic_index.rust.test.ts`

This is the main user of `local_types`. Contains Rust generic/lifetime tests.

### Secondary Targets

Find all other usage:
```bash
grep -r "local_types" packages/core/src --include="*.test.ts" -l
grep -r "local_types" packages/core/src --include="*.spec.ts" -l
```

## Migration Patterns

### Pattern 1: Find Type by Name

**Before:**
```typescript
const userType = index.local_types.find(t => t.type_name === "User");
```

**After:**
```typescript
const userClass = Array.from(index.classes.values())
  .find(c => c.name === "User");

// Or for interfaces:
const userInterface = Array.from(index.interfaces.values())
  .find(i => i.name === "User");
```

### Pattern 2: Check Members

**Before:**
```typescript
expect(userType.direct_members.has("getName")).toBe(true);
expect(userType.direct_members.get("getName").kind).toBe("method");
```

**After:**
```typescript
expect(userClass.methods.some(m => m.name === "getName")).toBe(true);
const getNameMethod = userClass.methods.find(m => m.name === "getName");
expect(getNameMethod).toBeDefined();
```

### Pattern 3: Check Properties

**Before:**
```typescript
const member = userType.direct_members.get("name");
expect(member.kind).toBe("property");
```

**After:**
```typescript
const nameProperty = userClass.properties.find(p => p.name === "name");
expect(nameProperty).toBeDefined();
```

### Pattern 4: Check Methods

**Before:**
```typescript
const methods = Array.from(userType.direct_members.values())
  .filter(m => m.kind === "method");
expect(methods.length).toBe(3);
```

**After:**
```typescript
expect(userClass.methods.length).toBe(3);
```

### Pattern 5: Rust Generics/Lifetimes

**Before:**
```typescript
const genericType = index.local_types.find(t => t.type_name === "Container");
expect(genericType.is_generic).toBe(true);
expect(genericType.type_parameters).toHaveLength(1);
```

**After:**
```typescript
// Rust generics should be in ClassDefinition already
const containerClass = Array.from(index.classes.values())
  .find(c => c.name === "Container");

// Check if ClassDefinition has generic info
// If not, this test may need to be adapted or removed
expect(containerClass).toBeDefined();
// TODO: Verify how generics are stored in ClassDefinition
```

## Detailed Migration Steps

### 1. Audit Rust Tests (15 min)

**File:** `src/index_single_file/semantic_index.rust.test.ts`

List all tests using `local_types`:
```bash
grep -n "local_types" packages/core/src/index_single_file/semantic_index.rust.test.ts
```

For each usage, note:
- Line number
- What's being tested (members, generics, lifetimes)
- Migration strategy

### 2. Create Helper Functions (20 min)

Add test helpers to make migration easier:

```typescript
/**
 * Test helper: Find class by name
 */
function find_class(
  index: SemanticIndex,
  name: SymbolName
): ClassDefinition | undefined {
  return Array.from(index.classes.values()).find(c => c.name === name);
}

/**
 * Test helper: Find interface by name
 */
function find_interface(
  index: SemanticIndex,
  name: SymbolName
): InterfaceDefinition | undefined {
  return Array.from(index.interfaces.values()).find(i => i.name === name);
}

/**
 * Test helper: Check if class has method
 */
function has_method(
  cls: ClassDefinition,
  method_name: SymbolName
): boolean {
  return cls.methods.some(m => m.name === method_name);
}

/**
 * Test helper: Get method by name
 */
function get_method(
  cls: ClassDefinition,
  method_name: SymbolName
): MethodDefinition | undefined {
  return cls.methods.find(m => m.name === method_name);
}
```

### 3. Migrate Basic Member Tests (30 min)

Update tests that check methods/properties:

**Example:**
```typescript
// BEFORE
test('Point struct has methods', () => {
  const pointType = index.local_types.find(t => t.type_name === "Point");
  expect(pointType).toBeDefined();
  expect(pointType.direct_members.has("new")).toBe(true);
  expect(pointType.direct_members.has("distance")).toBe(true);
});

// AFTER
test('Point struct has methods', () => {
  const pointClass = find_class(index, "Point" as SymbolName);
  expect(pointClass).toBeDefined();
  expect(has_method(pointClass, "new" as SymbolName)).toBe(true);
  expect(has_method(pointClass, "distance" as SymbolName)).toBe(true);
});
```

### 4. Handle Rust-Specific Features (20 min)

**For Generics:**

Check if `ClassDefinition` already has generic info:
```typescript
// If ClassDefinition has generics field
const containerClass = find_class(index, "Container" as SymbolName);
expect(containerClass.generics).toBeDefined();

// If not, adapt or skip test
test.skip('Container has generic parameters', () => {
  // TODO: Generic info not in ClassDefinition yet
  // Consider adding or testing differently
});
```

**For Lifetimes:**

Similar approach - check if lifetime info is in `ClassDefinition`.

### 5. Update Remaining Tests (15 min)

Migrate any other tests in:
- `semantic_index.javascript.test.ts`
- `semantic_index.typescript.test.ts`
- `semantic_index.python.test.ts`

Most should already use `index.classes` directly.

### 6. Remove Obsolete Tests (10 min)

If any tests specifically tested `local_types` structure itself:

```typescript
// ❌ DELETE - testing deleted feature
test('local_types extracts class members', () => {
  expect(index.local_types).toBeDefined();
  expect(index.local_types.length).toBeGreaterThan(0);
});
```

## Validation

### 1. Run Each Test File
```bash
npm test -- semantic_index.rust.test.ts
npm test -- semantic_index.javascript.test.ts
npm test -- semantic_index.typescript.test.ts
npm test -- semantic_index.python.test.ts
```

All should pass.

### 2. Full Test Suite
```bash
npm test
# No references to local_types should remain
```

### 3. Verify No Local Types Usage
```bash
grep -r "local_types" packages/core/src --include="*.ts"
# Should find NO results
```

## Deliverables

- [ ] Test helper functions added
- [ ] All `local_types` usage in tests migrated
- [ ] Rust generic/lifetime tests updated or marked for future work
- [ ] Obsolete tests removed
- [ ] All semantic index tests pass
- [ ] No references to `local_types` remain

## Special Cases

### Rust Generics Not in ClassDefinition

If generic/lifetime info is not in `ClassDefinition`:

**Option 1:** Skip those tests for now
```typescript
test.skip('Rust generics', () => {
  // TODO: Re-implement when ClassDefinition includes generics
});
```

**Option 2:** Add generic info to ClassDefinition
- Update definition builders to extract generics
- Store in `ClassDefinition.generics` field
- Update tests to use new field

**Recommendation:** Option 1 (skip) for now, Option 2 as future enhancement.

## Next Steps

- Task 105.9: Remove tests for deleted structures
