# Task 152.9: Test Migration Plan - Overview

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: In Progress
**Priority**: High
**Estimated Effort**: 12 hours (split across 6 sub-tasks)
**Phase**: 2 - Migration

## Executive Summary

After completing the discriminated union refactoring (tasks 152.1-152.8), we discovered **130 failing tests** that check the OLD reference format. These tests need migration to the NEW discriminated union format.

**Build Status**:
- ✅ Build: SUCCESS (0 type errors)
- ❌ Tests: 130 failing, 1292 passing (out of 1428 total)

## Failure Analysis

### Pattern 1: OLD field checks (90 occurrences across 8 files)

Tests checking OLD fields that no longer exist:
```typescript
// ❌ FAILING - checks OLD format
ref.type === "call"
ref.call_type === "constructor"
ref.context?.receiver_location
ref.context?.construct_target
```

Should be:
```typescript
// ✅ NEW discriminated union format
ref.kind === "function_call"
ref.kind === "constructor_call"
ref.receiver_location  // Direct field on MethodCallReference
ref.construct_target   // Direct field on ConstructorCallReference
```

### Pattern 2: Missing test coverage

The new resolvers need dedicated test files:
- ✅ `self_reference_resolver.ts` exists - **NO TESTS** (created in task-152.7)
- ✅ `method_resolver.ts` exists - **NO TESTS** (updated in task-152.6)
- ✅ `constructor_tracking.ts` exists - **NO TESTS** (updated in task-152.8)

### Affected Test Files (by priority)

#### Priority 1: Integration Tests (semantic_index.*.test.ts)
These test end-to-end semantic index building and verify reference capture:

1. **semantic_index.javascript.test.ts** - 35 OLD field occurrences
2. **semantic_index.python.test.ts** - 21 OLD field occurrences
3. **semantic_index.typescript.test.ts** - 14 OLD field occurrences
4. **semantic_index.rust.test.ts** - 3 OLD field occurrences

#### Priority 2: Resolution Tests
5. **test_nested_scope.test.ts** - 8 OLD field occurrences (tests scope resolution)

#### Priority 3: Project Integration Tests
6. **project.integration.test.ts** - 3 OLD field occurrences
7. **project.javascript.integration.test.ts** - 2 OLD field occurrences

#### Priority 4: Factory Tests
8. **reference_factories.test.ts** - 4 OLD field occurrences (mostly comments/documentation)

## Migration Strategy

### Phase 1: Migrate Existing Tests (4 sub-tasks)

Migrate tests to check NEW discriminated union format while maintaining test intent.

**Sub-tasks**:
- **task-152.9.1**: Migrate semantic_index.javascript.test.ts (35 occurrences)
- **task-152.9.2**: Migrate semantic_index.python.test.ts (21 occurrences)
- **task-152.9.3**: Migrate semantic_index.typescript.test.ts + semantic_index.rust.test.ts (17 occurrences)
- **task-152.9.4**: Migrate test_nested_scope.test.ts + project integration tests (13 occurrences)

### Phase 2: Create New Resolver Tests (2 sub-tasks)

Add comprehensive test coverage for NEW resolvers:

**Sub-tasks**:
- **task-152.9.5**: Create self_reference_resolver.test.ts (THE BUG FIX verification)
- **task-152.9.6**: Create method_resolver.test.ts and constructor_tracking.test.ts

### Phase 3: Verification (included in sub-tasks)

Each sub-task includes:
- Run tests before migration (capture failure count)
- Apply migration
- Run tests after migration (verify fixes)
- Update task with metrics

## Success Criteria

- [ ] All 130 failing tests now pass
- [ ] Zero tests check OLD fields (`.type`, `.call_type`, `.context`)
- [ ] New resolver tests exist with 100% coverage:
  - [ ] `self_reference_resolver.test.ts` (this.method(), super.method())
  - [ ] `method_resolver.test.ts` (obj.method())
  - [ ] `constructor_tracking.test.ts` (new MyClass())
- [ ] Build succeeds: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] No TypeScript errors in test files

## Migration Patterns

### Pattern 1: Function Call References

**OLD**:
```typescript
const funcCall = refs.find(ref => ref.type === "call" && ref.call_type === "function");
expect(funcCall?.context?.receiver_location).toBeUndefined();
```

**NEW**:
```typescript
const funcCall = refs.find(ref => ref.kind === "function_call");
// receiver_location doesn't exist on FunctionCallReference
```

### Pattern 2: Method Call References

**OLD**:
```typescript
const methodCall = refs.find(ref => ref.type === "call" && ref.name === "log");
expect(methodCall?.context?.receiver_location).toBeDefined();
```

**NEW**:
```typescript
const methodCall = refs.find((ref): ref is MethodCallReference =>
  ref.kind === "method_call" && ref.name === "log"
);
expect(methodCall?.receiver_location).toBeDefined();  // Direct field
```

### Pattern 3: Constructor Call References

**OLD**:
```typescript
const constructorCall = refs.find(ref =>
  ref.type === "construct" || ref.call_type === "constructor"
);
expect(constructorCall?.context?.construct_target).toBeDefined();
```

**NEW**:
```typescript
const constructorCall = refs.find((ref): ref is ConstructorCallReference =>
  ref.kind === "constructor_call"
);
expect(constructorCall?.construct_target).toBeDefined();  // Direct field
```

### Pattern 4: Self-Reference Call

**OLD**:
```typescript
const thisCall = refs.find(ref =>
  ref.type === "call" && ref.context?.receiver_location?.keyword === "this"
);
```

**NEW**:
```typescript
const thisCall = refs.find((ref): ref is SelfReferenceCall =>
  ref.kind === "self_reference_call" && ref.keyword === "this"
);
expect(thisCall?.property_chain).toEqual(["this", "method"]);
```

## Test Coverage Goals

### Existing Coverage (after migration)
- ✅ Reference building and capture (semantic_index tests)
- ✅ Scope resolution (test_nested_scope.test.ts)
- ✅ Project-level integration (project.*.test.ts)
- ✅ Factory functions (reference_factories.test.ts)

### New Coverage (to be created)
- 🆕 Self-reference call resolution (this.method(), super.method())
- 🆕 Method call resolution (obj.method())
- 🆕 Constructor tracking (new MyClass(), type inference)
- 🆕 Super call resolution (parent class method lookup)

## Estimated Effort Breakdown

| Sub-task | File(s) | Occurrences | Effort | Priority |
|----------|---------|-------------|--------|----------|
| 152.9.1 | semantic_index.javascript.test.ts | 35 | 2.5h | P1 |
| 152.9.2 | semantic_index.python.test.ts | 21 | 2h | P1 |
| 152.9.3 | semantic_index.{typescript,rust}.test.ts | 17 | 1.5h | P1 |
| 152.9.4 | test_nested_scope + project tests | 13 | 1.5h | P2 |
| 152.9.5 | self_reference_resolver.test.ts (NEW) | - | 3h | P1 |
| 152.9.6 | method_resolver.test.ts (NEW) | - | 1.5h | P2 |
| **Total** | | **90** | **12h** | |

## Dependencies

### Completed (prerequisites)
- ✅ task-152.4: reference_factories.ts created
- ✅ task-152.5: resolution_registry.ts updated
- ✅ task-152.6: method_resolver.ts refactored
- ✅ task-152.7: self_reference_resolver.ts created (THE BUG FIX)
- ✅ task-152.8: constructor_tracking.ts updated

### Blocks
- task-152.10: Write self-reference tests (REPLACED BY 152.9.5)
- task-152.11: Integration testing

## Next Steps

1. **Create sub-task files** (152.9.1 through 152.9.6)
2. **Execute in priority order** (P1 tasks first)
3. **Verify after each sub-task** that tests pass
4. **Track metrics** in completion notes

## Files to Create

New task files:
- [task-152.9.1-migrate-javascript-tests.md](task-152.9.1-migrate-javascript-tests.md)
- [task-152.9.2-migrate-python-tests.md](task-152.9.2-migrate-python-tests.md)
- [task-152.9.3-migrate-typescript-rust-tests.md](task-152.9.3-migrate-typescript-rust-tests.md)
- [task-152.9.4-migrate-nested-scope-project-tests.md](task-152.9.4-migrate-nested-scope-project-tests.md)
- [task-152.9.5-create-self-reference-resolver-tests.md](task-152.9.5-create-self-reference-resolver-tests.md)
- [task-152.9.6-create-method-constructor-resolver-tests.md](task-152.9.6-create-method-constructor-resolver-tests.md)

## Notes

### Why This Approach?

**Incremental Migration**: Each sub-task is independently testable and mergeable.

**Test-Driven Verification**: After each migration, we run tests to verify fixes before moving to next file.

**Complete Coverage**: We both migrate existing tests AND create new tests for NEW code.

**Prioritization**: Start with integration tests (highest value) before unit tests.

### Common Pitfalls to Avoid

1. **Don't just delete failing assertions** - Migrate them to check NEW fields
2. **Use type guards** for type narrowing: `(ref): ref is MethodCallReference => ref.kind === "method_call"`
3. **Remove optional chaining** - NEW fields are guaranteed present
4. **Update imports** - May need to import specific reference types

## Tracking Progress

Use this checklist to track overall progress:

- [ ] task-152.9.1: Migrate semantic_index.javascript.test.ts
- [ ] task-152.9.2: Migrate semantic_index.python.test.ts
- [ ] task-152.9.3: Migrate semantic_index.typescript.test.ts + rust
- [ ] task-152.9.4: Migrate test_nested_scope + project tests
- [ ] task-152.9.5: Create self_reference_resolver.test.ts
- [ ] task-152.9.6: Create method_resolver.test.ts
- [ ] All tests pass (0 failures)
- [ ] Zero OLD field occurrences in tests
- [ ] Build succeeds
