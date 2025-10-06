# Task epic-11.112.5.3: Update TypeScript Import Resolver Tests

**Parent:** task-epic-11.112.5
**Status:** Completed
**Estimated Time:** 30 minutes
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.5.2

## Objective

Run TypeScript import resolver tests and fix any failures caused by body-based scope changes. Update test assertions to expect class/interface/enum names in parent scope.

## Files

### MODIFIED
- `packages/core/src/resolve_references/import_resolution/import_resolver.typescript.test.ts`

---

## Context

**What Changed:**
- Class/interface/enum **bodies** are now captured as scopes
- Class/interface/enum **names** are in parent scope (module scope)
- Tests expecting names in their own scopes will fail

**Common Test Failures:**
- Scope location assertions (expecting old boundaries)
- Scope containment checks (name not in body scope)
- Scope_id assertions (expecting class scope, now parent scope)

---

## Implementation Steps

### 1. Run Tests to Establish Baseline (5 min)

```bash
npm test -- import_resolver.typescript.test.ts
```

**Document results:**
- Total tests: X
- Passing: Y
- Failing: Z
- Failures list: [...]

### 2. Analyze Failing Tests (10 min)

For each failing test, categorize:

**Category A: Scope Location Assertions**
```typescript
// BEFORE: Expects scope to include class name
expect(class_scope.location.start_column).toBe(0);

// AFTER: Scope starts after class name
expect(class_scope.location.start_column).toBe(14); // at '{'
```

**Category B: Scope Containment Checks**
```typescript
// BEFORE: Expects class name in class scope
expect(location_contains(class_scope.location, class_name_location)).toBe(true);

// AFTER: Class name in parent scope
expect(location_contains(class_scope.location, class_name_location)).toBe(false);
expect(location_contains(module_scope.location, class_name_location)).toBe(true);
```

**Category C: Scope ID Assertions**
```typescript
// BEFORE: Expects class.scope_id to be class_scope.id
expect(class_def.scope_id).toBe(class_scope.id);

// AFTER: Class.scope_id is parent scope
expect(class_def.scope_id).toBe(module_scope.id);
```

### 3. Fix Failing Tests (10 min)

**For each test:**

1. **Identify what the test verifies**
   - Import resolution correctness
   - Scope relationships
   - Symbol lookups

2. **Determine if expectations need updating**
   - Yes: Update assertions to match body-based scopes
   - No: Test may have found a real bug in resolver

3. **Update test code**
   ```typescript
   // Example fix
   it('resolves imported class', () => {
     const result = resolve_import('MyClass', 'file2.ts');

     // OLD: expect(result.scope_id).toBe(class_scope.id);
     // NEW: expect(result.scope_id).toBe(module_scope.id);
     expect(result.scope_id).toBe(module_scope.id);
   });
   ```

### 4. Add Tests for Body-Based Scope Behavior (5 min)

**New test cases:**

```typescript
describe('Body-based scopes', () => {
  it('class name is in module scope, not class scope', () => {
    const index = build_index(`
      export class MyClass {
        method() {}
      }
    `, 'test.ts');

    const class_def = get_class(index, 'MyClass');
    const module_scope = get_module_scope(index);
    const class_scope = get_class_scope(index, 'MyClass');

    // Name in parent scope
    expect(class_def.scope_id).toBe(module_scope.id);
    expect(class_def.scope_id).not.toBe(class_scope.id);

    // Body scope location doesn't include name
    expect(location_contains(class_scope.location, class_def.location)).toBe(false);
  });

  it('interface name is in module scope', () => {
    const index = build_index(`
      export interface IFoo {
        bar(): void;
      }
    `, 'test.ts');

    const interface_def = get_interface(index, 'IFoo');
    const module_scope = get_module_scope(index);

    expect(interface_def.scope_id).toBe(module_scope.id);
  });

  it('enum name is in module scope', () => {
    const index = build_index(`
      export enum Status {
        Ok, Error
      }
    `, 'test.ts');

    const enum_def = get_enum(index, 'Status');
    const module_scope = get_module_scope(index);

    expect(enum_def.scope_id).toBe(module_scope.id);
  });
});
```

---

## Common Test Patterns to Update

### Pattern 1: Scope Boundary Checks

```typescript
// BEFORE
expect(scope.location).toEqual({
  start_line: 1, start_column: 0,  // class keyword
  end_line: 3, end_column: 1
});

// AFTER
expect(scope.location).toEqual({
  start_line: 1, start_column: 14, // '{' after class name
  end_line: 3, end_column: 1
});
```

### Pattern 2: Scope Membership

```typescript
// BEFORE
const class_members = get_symbols_in_scope(class_scope);
expect(class_members).toContain('MyClass'); // name in class scope

// AFTER
const module_members = get_symbols_in_scope(module_scope);
expect(module_members).toContain('MyClass'); // name in module scope

const class_members = get_symbols_in_scope(class_scope);
expect(class_members).not.toContain('MyClass'); // name NOT in class scope
expect(class_members).toContain('method'); // but methods are
```

### Pattern 3: Import Resolution

```typescript
// Usually no changes needed - these typically pass
it('resolves imported class', () => {
  const result = resolve_import('MyClass', 'file2.ts');
  expect(result).toBeDefined();
  expect(result.name).toBe('MyClass');
  // Import resolution works at module level - already correct!
});
```

---

## Verification

### Run Updated Tests

```bash
npm test -- import_resolver.typescript.test.ts
```

**Expected:**
- All tests passing
- New tests for body-based scope behavior included
- No regressions in import resolution functionality

### Manual Spot Check

Verify a few key scenarios:
- Export class → import class: Works ✅
- Export interface → import interface: Works ✅
- Export enum → import enum: Works ✅
- Re-exports: Work ✅
- Type-only imports: Work ✅

---

## Success Criteria

- ✅ All import resolver tests passing
- ✅ Test assertions updated for body-based scopes
- ✅ New tests added to verify body-based scope behavior
- ✅ Import resolution functionality verified
- ✅ No regressions introduced

---

---

## Implementation Notes

### Baseline Test Results
- **Total tests:** 15
- **Passing:** 15 (100%)
- **Failing:** 0

All existing import resolver tests passed without modification. Import resolution works at module level, so body-based scope changes didn't affect functionality.

### New Tests Added

Added 6 new tests in `describe("Body-based scopes - TypeScript")` block:

#### 1. **class name is in module scope, not class scope** (line 235)
**Verifies:**
- Class definition `scope_id` points to module scope, not class scope
- Class definition `scope_id` does NOT equal class scope ID
- Class body scope starts after class name (column > 10)

**Assertions:**
```typescript
expect(class_def.scope_id).toBe(module_scope.id);
expect(class_def.scope_id).not.toBe(class_scope.id);
expect(class_scope.location.start_column).toBeGreaterThan(10);
```

#### 2. **interface name is in module scope** (line 266)
**Verifies:**
- Interface definition `scope_id` points to module scope

**Assertions:**
```typescript
expect(interface_def.scope_id).toBe(module_scope.id);
```

#### 3. **enum name is in module scope** (line 288)
**Verifies:**
- Enum definition `scope_id` points to module scope

**Assertions:**
```typescript
expect(enum_def.scope_id).toBe(module_scope.id);
```

#### 4. **class members are in class body scope** (line 311)
**Verifies:**
- Method `scope_id` points to class body scope
- Property `scope_id` points to class body scope

**Assertions:**
```typescript
expect(method_def.scope_id).toBe(class_scope.id);
expect(property_def.scope_id).toBe(class_scope.id);
```

#### 5. **interface methods are in interface body scope** (line 345)
**Verifies:**
- Interface method `scope_id` points to interface body scope
- Interface scopes are stored as `type: "class"`

**Assertions:**
```typescript
expect(method_def.scope_id).toBe(interface_scope.id);
```

**Note:** Interface scope found using `s.type === "class" && s.location.start_column > 10`

#### 6. **enum body creates a scope** (line 375)
**Verifies:**
- Enum definition `scope_id` points to module scope
- Enum body scope starts after enum name (column > 10)
- Enum scopes are stored as `type: "class"`

**Assertions:**
```typescript
expect(enum_def.scope_id).toBe(module_scope.id);
expect(enum_scope.location.start_column).toBeGreaterThan(10);
```

**Note:** Enum scope found using `s.type === "class" && s.location.start_column > 10`

### Test Assertions Updated

**None required** - All 15 original import resolution tests passed without modification because:
- Import resolution operates at module/file level
- Body-based scope changes affect internal scope structure, not module imports
- No scope location, containment, or scope_id assertions existed in original tests

### Key Findings

1. **Scope Type Mapping**
   - Class scopes: `type === "class"` ✅
   - Interface scopes: `type === "class"` (not "interface") ✅
   - Enum scopes: `type === "class"` (not "enum") ✅
   - Module scope: `type === "module"` ✅

2. **Scope ID Fields**
   - `MethodDefinition`: Has `scope_id` ✅
   - `PropertyDefinition`: Has `scope_id` ✅
   - `PropertySignature`: No `scope_id` field (interface properties)
   - `EnumMember`: No `scope_id` field

3. **Test Helper Added**
   ```typescript
   function create_parsed_file(code, file_path, tree, language): ParsedFile
   ```
   - Creates properly formatted `ParsedFile` objects for tests
   - Handles line splitting and column calculation

### TypeScript Compilation

Verified with multiple configurations:
```bash
# With project config
npx tsc --noEmit --project tsconfig.json
✅ PASS - No errors

# With explicit flags
npx tsc --noEmit --esModuleInterop --downlevelIteration --skipLibCheck
✅ PASS - No errors

# Strict mode
npx tsc --noEmit --strict --esModuleInterop --skipLibCheck
✅ PASS - No errors
```

**Imports verified:**
- `import Parser from "tree-sitter"` ✅ (default import with esModuleInterop)
- `import TypeScript from "tree-sitter-typescript"` ✅ (default import with esModuleInterop)

### Final Test Results
- **Total tests:** 21 (15 original + 6 new)
- **Passing:** 21 (100%)
- **Failing:** 0
- **TypeScript compilation:** ✅ PASS
- **No regressions**

---

## Next Task

**task-epic-11.112.6** - Update JavaScript .scm and import resolver
