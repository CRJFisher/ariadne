# Task 11.108: Complete Definition Builder Coverage

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 3-4 days
**Parent:** epic-11
**Dependencies:** task-epic-11.107 (test fixes)

## Objective

Complete the definition builder implementation to ensure all nested objects (methods, constructors, parameters, properties, enum members, etc.) are properly tracked across all supported languages (JavaScript, TypeScript, Python, Rust).

## Background

An audit of [definition_builder.ts](../../../packages/core/src/index_single_file/definitions/definition_builder.ts) and language builders revealed critical gaps:

1. **No constructor support** - Constructors are workarounds using methods, not using the dedicated `ConstructorBuilderState`
2. **Rust missing parameters** - All function/method parameters are ignored
3. **Rust missing imports** - No `use` statement tracking
4. **Python decorators discarded** - Extracted but never applied
5. **TypeScript interface methods incomplete** - Parameters not tracked
6. **Rust trait methods incomplete** - Not added to interface definitions
7. **Python enum support missing** - No tracking of Enum classes and members (CRITICAL)
8. **Python Protocol properties incomplete** - Property signatures not tracked in Protocol classes

See [BUILDER_AUDIT.md](../../../BUILDER_AUDIT.md) and [EXTENDED_BUILDER_AUDIT.md](../../../EXTENDED_BUILDER_AUDIT.md) for full analysis.

## Sub-Tasks

### Part A: Builder Enhancements
- [x] **11.108.1** - Enhance definition_builder.ts with missing methods

### Part B: Language Processing (Including .scm Query Updates)
- [x] **11.108.2** - JavaScript: Complete definition processing
- [x] **11.108.3** - TypeScript: Complete definition processing
- [x] **11.108.4** - Python: Complete definition processing
- [x] **11.108.5** - Rust: Complete definition processing

### Part C: Test Coverage (Literal Object Assertions)
- [x] **11.108.6** - JavaScript: Update semantic_index tests
- [x] **11.108.7** - TypeScript: Update semantic_index tests
- [x] **11.108.8** - Python: Update semantic_index tests
- [x] **11.108.9** - Rust: Update semantic_index tests

### Part D: Type System Completeness
- [x] **11.108.10** - Verify complete type alias coverage across all languages

## Success Criteria

### Functional Completeness
- ✅ All definitions have dedicated builder methods (not workarounds)
- ✅ All nested objects tracked (parameters in functions/methods/constructors)
- ✅ All language builders use all applicable methods
- ✅ Query files capture all necessary information

### Test Coverage
- ✅ Tests verify all data with literal object equality
- ✅ Tests cover all definition types per language
- ✅ Tests verify nested objects are present
- ✅ Tests use expect().toEqual() with full object structures

### Documentation
- ✅ Builder methods have JSDoc
- ✅ Language builders document which methods they use
- ✅ Audit document updated with fixes

## Technical Scope

### Builder Methods to Add
1. `add_constructor_to_class` - Dedicated constructor API
2. Update `add_parameter_to_callable` - Support constructors & interface methods

### Language Processing Fixes

#### JavaScript
- Ensure all definitions use builder methods
- Verify constructor handling
- Check parameter tracking completeness

#### TypeScript
- Add interface method parameter tracking
- Verify decorator application
- Ensure parameter properties handled

#### Python
- Add decorator tracking (`add_decorator_to_target` calls)
- Verify all decorators (@property, @staticmethod, @classmethod) tracked
- Ensure __init__ properly handled
- **Critical**: Add Enum support (detect classes inheriting from Enum)
- Add enum member tracking with values
- Add Protocol property signature support

#### Rust
- **Critical**: Add parameter tracking (currently empty!)
- Add import/use statement tracking
- Add trait method signatures to interfaces
- Verify enum variant handling

### Test Updates Required

Each language test file must:
1. Use `expect(result).toEqual({ ... })` with complete literal objects
2. Check presence of nested objects (parameters, properties, methods)
3. Verify all fields are populated correctly
4. Cover all definition types supported by that language

Example assertion pattern:
```typescript
expect(result.definitions.get(class_id)).toEqual({
  kind: 'class',
  symbol_id: class_id,
  name: 'MyClass',
  location: { /* ... */ },
  scope_id: expect.any(String),
  availability: { scope: 'public' },
  methods: new Map([
    [method_id, {
      symbol_id: method_id,
      name: 'myMethod',
      location: { /* ... */ },
      scope_id: expect.any(String),
      availability: { scope: 'public' },
      parameters: [ /* verify params present */ ],
      return_type: 'string'
    }]
  ]),
  properties: new Map([ /* ... */ ]),
  constructor: { /* verify constructor present */ }
});
```

## Implementation Order

1. **11.108.1** - Add builder methods (foundation)
2. **11.108.2-5** - Fix language processing in parallel
3. **11.108.6-9** - Update tests in parallel

## Risk Mitigation

### Breaking Changes
- Adding constructor support may require updating existing code
- Changing method signatures could affect downstream consumers
- Mitigation: Add new methods alongside old, deprecate later

### Test Complexity
- Full object assertions are verbose but necessary
- Mitigation: Create test utilities for common patterns

### Query File Changes
- .scm file changes require tree-sitter expertise
- Mitigation: Test incrementally, verify captures work

## Verification Steps

### After Part A (Builder)
```bash
# Verify builder compiles
npx tsc --noEmit packages/core/src/index_single_file/definitions/definition_builder.ts

# Check for new methods
grep "add_constructor_to_class" packages/core/src/index_single_file/definitions/definition_builder.ts
```

### After Part B (Languages)
```bash
# Verify all builders compile
npx tsc --noEmit packages/core/src/index_single_file/query_code_tree/language_configs/*.ts

# Check parameter tracking in Rust
grep "add_parameter_to_callable" packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts
```

### After Part C (Tests)
```bash
# Run all semantic index tests
npm test -- semantic_index

# Verify tests use toEqual
grep "toEqual" packages/core/src/index_single_file/semantic_index.*.test.ts
```

## Related Documents

- [BUILDER_AUDIT.md](../../../BUILDER_AUDIT.md) - Full audit report
- [definition_builder.ts](../../../packages/core/src/index_single_file/definitions/definition_builder.ts)
- Language builders: `packages/core/src/index_single_file/query_code_tree/language_configs/*_builder.ts`
- Query files: `packages/core/src/index_single_file/query_code_tree/language_configs/queries/*.scm`

## Notes

This task addresses fundamental gaps in the semantic indexing infrastructure. Without complete definition tracking:
- Symbol resolution is incomplete
- Cross-file analysis fails
- Type information is missing
- Call graphs are inaccurate

The audit revealed that while the infrastructure exists (ConstructorBuilderState, parameter tracking), it's not fully utilized. This task completes that implementation.
