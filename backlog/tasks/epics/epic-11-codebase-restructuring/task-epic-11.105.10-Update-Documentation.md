# Task 105.10: Update Documentation and Examples

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 1 hour
**Parent:** task-epic-11.105
**Dependencies:** task-epic-11.105.6, task-epic-11.105.7

## Objective

Update documentation to reflect the simplified type hint extraction. Ensure developers understand the new, cleaner API.

## Documentation Files to Update

### 1. Architecture Documentation (15 min)

**File:** `docs/Architecture.md`

**Section to update:** Semantic Index

**Before:**
```markdown
The semantic index extracts four type-related structures:
- `local_types` - Type member information
- `local_type_annotations` - Type annotation syntax
- `local_type_tracking` - Variable type tracking
- `local_type_flow` - Type flow patterns
```

**After:**
```markdown
The semantic index extracts focused type hints for method resolution:
- `type_annotations` - Explicit type annotations from source code
- `constructor_calls` - Instance creation tracking for type inference

All other type information (methods, properties, fields) is available
directly in the definition structures (`ClassDefinition.methods`, etc.).
```

### 2. Project Guidelines (15 min)

**File:** `CLAUDE.md`

Add section on type processing:

```markdown
## Type Hint Extraction

When working with types for method resolution:

### Use Definition Structures for Type Members

Class/interface members are in their definitions:
```typescript
// ✅ CORRECT - Use definitions
const userClass = index.classes.get(user_id);
userClass.methods.forEach(method => ...);
userClass.properties.forEach(prop => ...);

// ❌ WRONG - Don't create separate type member structures
const type_info = { members: [...] };  // Duplicates definition data
```

### Use Type Hints for Inference

Type hints are for resolving method receivers:
```typescript
// Type annotations: explicit types in code
index.type_annotations  // let x: User

// Constructor calls: track instance creation
index.constructor_calls  // new User()
```

### Don't Mix Single-File and Cross-File

Semantic index is single-file only:
- ✅ Extract syntax (annotations, constructor calls)
- ❌ Don't resolve cross-file (handled in symbol_resolution.ts)
- ❌ Don't duplicate definition data
```

### 3. Core Package README (10 min)

**File:** `packages/core/README.md`

Update API examples:

```markdown
## Semantic Index API

```typescript
import { build_semantic_index } from '@ariadnejs/core';

const index = build_semantic_index(file, tree, 'typescript');

// Access definitions (classes, functions, etc.)
index.classes.forEach(cls => {
  console.log(`Class ${cls.name}`);
  console.log(`  Methods: ${cls.methods.map(m => m.name).join(', ')}`);
  console.log(`  Properties: ${cls.properties.map(p => p.name).join(', ')}`);
});

// Access type hints for method resolution
index.type_annotations.forEach(ann => {
  console.log(`Type annotation: ${ann.annotation_text}`);
});

index.constructor_calls.forEach(ctor => {
  console.log(`Constructor: new ${ctor.class_name}()`);
  if (ctor.assigned_to) {
    console.log(`  Assigned to: ${ctor.assigned_to}`);
  }
});
```
```

### 4. Inline Code Documentation (15 min)

**File:** `src/index_single_file/semantic_index.ts`

Update interface JSDoc:

```typescript
/**
 * Semantic Index - Single-file analysis results
 *
 * Provides:
 * - Symbol definitions (classes, functions, variables, etc.)
 * - Symbol references (where symbols are used)
 * - Type hints for method resolution (annotations, constructor calls)
 *
 * Type members (methods, properties) are in definition structures,
 * not separate type info objects.
 */
export interface SemanticIndex {
  // ... fields ...

  /**
   * Type annotations extracted from source code
   *
   * Includes:
   * - Variable annotations: `let x: User`
   * - Parameter annotations: `function foo(x: User)`
   * - Return annotations: `function foo(): User`
   * - Type casts: `x as User`
   *
   * Used by symbol_resolution to infer types for method resolution.
   */
  readonly type_annotations: TypeAnnotation[];

  /**
   * Constructor calls for instance creation tracking
   *
   * Tracks `new ClassName()` expressions to enable type inference:
   * ```typescript
   * const user = new User();  // user has type User
   * user.getName();           // Resolve getName on User class
   * ```
   *
   * Used by symbol_resolution for constructor-based type hints.
   */
  readonly constructor_calls: ConstructorCall[];
}
```

### 5. Migration Guide (Optional, 5 min)

If this is a public API, create migration guide:

**File:** `docs/MIGRATION-v2.md`

```markdown
# Migration Guide: Type Hint Simplification

## API Changes

### Removed Fields

The following fields have been removed from `SemanticIndex`:

- `local_types` → Use `index.classes[id].methods` instead
- `local_type_tracking` → Use `index.type_annotations`
- `local_type_flow` → Use `index.constructor_calls`

### Renamed Fields

- `local_type_annotations` → `type_annotations`

### Migration Examples

**Accessing Class Methods:**
```typescript
// Before
const pointType = index.local_types.find(t => t.type_name === "Point");
const methods = pointType.direct_members;

// After
const pointClass = Array.from(index.classes.values())
  .find(c => c.name === "Point");
const methods = pointClass.methods;
```

**Accessing Type Annotations:**
```typescript
// Before
index.local_type_annotations.forEach(ann => ...);

// After
index.type_annotations.forEach(ann => ...);
```

**Accessing Constructor Calls:**
```typescript
// Before
index.local_type_flow.constructor_calls.forEach(ctor => ...);

// After
index.constructor_calls.forEach(ctor => ...);
```
```

## Code Examples

### Update Examples in Tests (10 min)

Create or update example tests that demonstrate API usage:

**File:** `packages/core/src/index_single_file/semantic_index.examples.test.ts`

```typescript
describe('Semantic Index Examples', () => {
  it('demonstrates class method access', () => {
    const code = `
      class User {
        getName() { return this.name; }
        getAge() { return this.age; }
      }
    `;

    const index = build_semantic_index_from_code(code, 'typescript');

    // Find class by name
    const userClass = Array.from(index.classes.values())
      .find(c => c.name === 'User');

    // Access methods
    expect(userClass.methods).toHaveLength(2);
    expect(userClass.methods.map(m => m.name)).toEqual(['getName', 'getAge']);
  });

  it('demonstrates type annotation usage', () => {
    const code = `
      let user: User = getUser();
      const admin: Admin = getAdmin();
    `;

    const index = build_semantic_index_from_code(code, 'typescript');

    // Type annotations are extracted
    expect(index.type_annotations).toHaveLength(2);
    expect(index.type_annotations[0].annotation_text).toBe('User');
    expect(index.type_annotations[1].annotation_text).toBe('Admin');
  });

  it('demonstrates constructor call tracking', () => {
    const code = `
      const user = new User();
      const admin = new Admin('root');
    `;

    const index = build_semantic_index_from_code(code, 'typescript');

    // Constructor calls are tracked
    expect(index.constructor_calls).toHaveLength(2);
    expect(index.constructor_calls[0].class_name).toBe('User');
    expect(index.constructor_calls[0].assigned_to).toBe('user');
    expect(index.constructor_calls[1].argument_count).toBe(1);
  });
});
```

## Validation

### 1. Documentation Accuracy
- [ ] All code examples compile and run
- [ ] All references to deleted fields removed
- [ ] Migration guide complete (if needed)

### 2. Example Tests Pass
```bash
npm test -- semantic_index.examples.test.ts
```

### 3. No Stale Documentation
```bash
# Search for references to deleted fields
grep -r "local_types\|local_type_tracking\|local_type_flow" docs/
# Should find ONLY in migration guide (if present)
```

### 4. Markdown Lint
```bash
npx markdownlint docs/
# Fix any formatting issues
```

## Deliverables

- [ ] `docs/Architecture.md` updated
- [ ] `CLAUDE.md` updated with type processing guidelines
- [ ] `packages/core/README.md` updated with examples
- [ ] Interface JSDoc comments updated
- [ ] Example tests created or updated
- [ ] Migration guide created (if public API)
- [ ] All documentation accurate and current
- [ ] All code examples working

## Style Guidelines

**Documentation should:**
- Explain WHY, not just WHAT
- Show examples of correct usage
- Show examples of incorrect usage (with ❌)
- Be concise but complete
- Use actual code, not pseudocode

**Good Example:**
```markdown
## Type Hints

Type hints enable method resolution without full type inference:
```typescript
// Explicit annotation provides type hint
let user: User = ...;
user.getName();  // Resolves to User.getName()

// Constructor call provides type hint
const admin = new Admin();
admin.hasPermission();  // Resolves to Admin.hasPermission()
```
```

## Next Steps

- Task 105.11: Final validation and cleanup
