# Task 11.116 Architecture Review & Updated Plan

**Date:** 2025-10-14 (Revised)
**Status:** Analysis Complete → Plan Finalized
**Reviewer:** AI Assistant

## Executive Summary

Task 11.116 was written before the registry refactoring. While the architecture has changed, **the core problem remains valid and the JSON fixture approach is sound** when properly scoped.

**Core Problem:** Test files suffer from massive inline data bloat (hundreds of lines of manual semantic index construction per test).

**Solution:** Generate semantic index JSON fixtures once, use them as reusable test inputs.

**Scope:** JSON fixtures for semantic index outputs only (not for registry or call graph outputs).

## Key Architectural Changes Since Task Creation

### 1. Symbol Resolution → Registry Architecture

**OLD Architecture (when task was written):**
```
Code → SemanticIndex → SymbolResolution → CallGraph
```

**NEW Architecture (current):**
```
Code → SemanticIndex → Registries → CallGraph
                         ├─ DefinitionRegistry
                         ├─ ReferenceRegistry
                         ├─ ScopeRegistry
                         ├─ TypeRegistry
                         ├─ ExportRegistry
                         └─ ResolutionRegistry (coordinator)
```

**Impact on Testing:**
- "SymbolResolution" module is deprecated, but registry tests still need inputs
- SemanticIndex structure is stable and well-suited for JSON serialization
- Registry/CallGraph outputs are complex and better verified in code

### 2. The Test Bloat Problem (Real Issue)

**Current test pattern (causes bloat):**

```typescript
it("should resolve imported function calls", () => {
  // 50+ lines of manual construction for utils.ts
  const utils_index = create_test_index(utils_file, {
    root_scope_id: utils_scope,
    scopes_raw: new Map([
      [utils_scope, {
        id: utils_scope,
        type: "module",
        parent_id: null,
        name: null,
        location: {
          file_path: utils_file,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 0,
        },
        child_ids: [],
      }],
    ]),
    functions_raw: new Map([
      [helper_id, {
        kind: "function",
        symbol_id: helper_id,
        name: "helper" as SymbolName,
        is_exported: true,
        signature: { parameters: [] },
        defining_scope_id: utils_scope,
        scope_id: utils_scope,
        location: { /* ... */ },
        parameters: [],
      }],
    ]),
  });

  // Another 50+ lines for main.ts
  const main_index = create_test_index(main_file, {
    // ... even more manual construction
  });

  // Finally, the actual test (5 lines)
  const result = resolve_symbols_with_registries([utils_index, main_index]);
  expect(result.resolved_references.get(call_key)).toBe(helper_id);
});
```

**Problem:** Each test has 100+ lines of setup, 5 lines of actual testing.

**With JSON fixtures:**

```typescript
it("should resolve imported function calls", () => {
  // Load pre-generated semantic index JSON (2 lines)
  const utils_index = load_semantic_index_fixture("typescript/imports/utils.json");
  const main_index = load_semantic_index_fixture("typescript/imports/main.json");

  // Build registries and test (5 lines)
  const { definitions, resolutions } = build_registries([utils_index, main_index]);
  expect(resolutions.resolve(main_scope, "helper")).toBe(helper_id);
});
```

**Benefit:** 100+ lines of setup → 2 lines of fixture loading.

## Revised JSON Fixture Strategy

### Scope: Semantic Index Only

**Create JSON for:** SemanticIndex outputs (Stage 1)
- Well-defined, stable structure
- Moderate serialization complexity
- Reusable across all higher-level tests

**Don't create JSON for:** Registry/CallGraph outputs (Stages 2-3)
- Complex internal state (6 registries with multiple indexes)
- Better verified with code assertions
- Would require constant maintenance

### Three-Stage Testing Pipeline

```
Stage 1: Code → SemanticIndex → JSON fixtures ✅
         │                       └─ Generated once, version controlled
         │                       └─ Regenerated when schema changes
         └─ Optionally verify against expected JSON

Stage 2: Load JSON → Registries → Verify in CODE ✅
         └─ Input: JSON fixtures (from Stage 1)
         └─ Output: Code assertions (expect(...))

Stage 3: Load JSON → Registries → CallGraph → Verify in CODE ✅
         └─ Input: Same JSON fixtures (reused)
         └─ Output: Code assertions (expect(...))
```

### Benefits of This Approach

1. **Solves Test Bloat:** Massive inline data → simple fixture loading
2. **Reusable Fixtures:** Same JSON used across registry AND call graph tests
3. **Maintainable:** Only one stage requires JSON generation/loading
4. **Readable:** Tests focus on behavior, not setup
5. **Realistic:** Fixtures represent actual parsed code, not minimal synthetic data

## Fixture Structure

### JSON File Organization

```
packages/core/tests/fixtures/
├── typescript/
│   ├── code/                          # Source code (for reference)
│   │   ├── classes/
│   │   │   ├── basic_class.ts
│   │   │   ├── inheritance.ts
│   │   │   └── methods.ts
│   │   ├── functions/
│   │   │   ├── call_chains.ts
│   │   │   ├── recursive.ts
│   │   │   └── async.ts
│   │   └── modules/
│   │       ├── exports.ts
│   │       ├── imports.ts
│   │       └── re_exports.ts
│   └── semantic_index/                # JSON fixtures (generated)
│       ├── classes/
│       │   ├── basic_class.json       ← SemanticIndex JSON
│       │   ├── inheritance.json
│       │   └── methods.json
│       ├── functions/
│       │   ├── call_chains.json
│       │   ├── recursive.json
│       │   └── async.json
│       └── modules/
│           ├── exports.json
│           ├── imports.json
│           └── re_exports.json
├── python/
│   ├── code/
│   └── semantic_index/
├── rust/
│   ├── code/
│   └── semantic_index/
└── javascript/
    ├── code/
    └── semantic_index/
```

### JSON Format (SemanticIndex)

```json
{
  "file_path": "test.ts",
  "language": "typescript",
  "root_scope_id": "scope:test.ts:module",
  "scopes": {
    "scope:test.ts:module": {
      "id": "scope:test.ts:module",
      "type": "module",
      "parent_id": null,
      "name": null,
      "location": { "file_path": "test.ts", "start_line": 1, "start_column": 0, "end_line": 10, "end_column": 0 },
      "child_ids": ["scope:test.ts:function:foo"]
    }
  },
  "functions": {
    "function:test.ts:foo:1:0": {
      "kind": "function",
      "symbol_id": "function:test.ts:foo:1:0",
      "name": "foo",
      "scope_id": "scope:test.ts:module",
      "location": { "file_path": "test.ts", "start_line": 1, "start_column": 0, "end_line": 3, "end_column": 1 },
      "parameters": [],
      "is_exported": true,
      "signature": { "parameters": [] },
      "defining_scope_id": "scope:test.ts:module",
      "body_scope_id": "scope:test.ts:function:foo"
    }
  },
  "classes": {},
  "variables": {},
  "interfaces": {},
  "enums": {},
  "namespaces": {},
  "types": {},
  "imported_symbols": {},
  "references": [
    {
      "type": "call",
      "call_type": "function",
      "name": "bar",
      "location": { "file_path": "test.ts", "start_line": 2, "start_column": 2, "end_line": 2, "end_column": 7 },
      "scope_id": "scope:test.ts:function:foo"
    }
  ]
}
```

## Test Patterns

### Pattern 1: Semantic Index Tests (Stage 1)

**Option A: Generate and compare JSON**
```typescript
it("should parse TypeScript classes correctly", () => {
  const code = load_code_fixture("typescript/classes/basic_class.ts");
  const actual = index_single_file(code, "typescript");
  const expected = load_semantic_index_fixture("typescript/classes/basic_class.json");

  expect(normalize(actual)).toEqual(expected);
});
```

**Option B: Load JSON and verify properties**
```typescript
it("should have correct class structure", () => {
  const index = load_semantic_index_fixture("typescript/classes/basic_class.json");

  expect(index.classes.size).toBe(1);
  const user_class = Array.from(index.classes.values())[0];
  expect(user_class.methods).toHaveLength(2);
  expect(user_class.properties).toHaveLength(1);
});
```

### Pattern 2: Registry Integration Tests (Stage 2)

```typescript
it("should resolve method calls through type bindings", () => {
  // Load semantic index JSON as INPUT
  const types_index = load_semantic_index_fixture("typescript/classes/user.json");
  const main_index = load_semantic_index_fixture("typescript/classes/main.json");

  // Build registries from JSON
  const { definitions, resolutions, types, scopes } = build_registries([
    types_index,
    main_index
  ]);

  // Verify behavior in CODE (not JSON)
  const method_call_ref = main_index.references.find(r =>
    r.type === "call" && r.name === "getName"
  );

  const resolved = resolutions.resolve(
    method_call_ref.scope_id,
    method_call_ref.name
  );

  expect(resolved).toBe("method:User:getName:2:2");

  // Can also verify registry state
  const user_members = types.get_type_members("class:User:1:0");
  expect(user_members?.methods.get("getName")).toBe("method:User:getName:2:2");
});
```

### Pattern 3: Call Graph Integration Tests (Stage 3)

```typescript
it("should detect call chains in TypeScript classes", () => {
  // Load semantic index JSON as INPUT (same fixtures as registry tests!)
  const index = load_semantic_index_fixture("typescript/classes/call_chains.json");

  // Build full pipeline
  const { definitions, resolutions } = build_registries([index]);
  const graph = detect_call_graph(definitions, resolutions);

  // Verify call graph in CODE
  const constructor_node = find_node_by_name(graph, "constructor");
  expect(constructor_node?.enclosed_calls).toHaveLength(2);
  expect(constructor_node?.enclosed_calls).toContainEqual(
    expect.objectContaining({
      name: "initialize",
      call_type: "method"
    })
  );

  // Verify entry points
  expect(graph.entry_points).toEqual([
    expect.stringMatching(/function:main/)
  ]);
});
```

## Implementation Complexity Analysis

### Serialization (Moderate, One-Time Effort)

**Challenge:** Convert SemanticIndex Maps to JSON objects

```typescript
function serialize_semantic_index(index: SemanticIndex): SemanticIndexJSON {
  return {
    file_path: index.file_path,
    language: index.language,
    root_scope_id: index.root_scope_id,
    scopes: Object.fromEntries(index.scopes),
    functions: Object.fromEntries(index.functions),
    classes: Object.fromEntries(index.classes),
    variables: Object.fromEntries(index.variables),
    interfaces: Object.fromEntries(index.interfaces),
    enums: Object.fromEntries(index.enums),
    namespaces: Object.fromEntries(index.namespaces),
    types: Object.fromEntries(index.types),
    imported_symbols: Object.fromEntries(index.imported_symbols),
    references: [...index.references],
  };
}
```

**Assessment:** Straightforward. No complex recursion, all types are serializable.

### Deserialization (Simple)

```typescript
function deserialize_semantic_index(json: SemanticIndexJSON): SemanticIndex {
  return {
    file_path: json.file_path as FilePath,
    language: json.language as Language,
    root_scope_id: json.root_scope_id as ScopeId,
    scopes: new Map(Object.entries(json.scopes)) as ReadonlyMap<ScopeId, LexicalScope>,
    functions: new Map(Object.entries(json.functions)) as ReadonlyMap<SymbolId, FunctionDefinition>,
    classes: new Map(Object.entries(json.classes)) as ReadonlyMap<SymbolId, ClassDefinition>,
    variables: new Map(Object.entries(json.variables)) as ReadonlyMap<SymbolId, VariableDefinition>,
    interfaces: new Map(Object.entries(json.interfaces)) as ReadonlyMap<SymbolId, InterfaceDefinition>,
    enums: new Map(Object.entries(json.enums)) as ReadonlyMap<SymbolId, EnumDefinition>,
    namespaces: new Map(Object.entries(json.namespaces)) as ReadonlyMap<SymbolId, NamespaceDefinition>,
    types: new Map(Object.entries(json.types)) as ReadonlyMap<SymbolId, TypeAliasDefinition>,
    imported_symbols: new Map(Object.entries(json.imported_symbols)) as ReadonlyMap<SymbolId, ImportDefinition>,
    references: json.references as readonly SymbolReference[],
  };
}
```

**Assessment:** Mechanical conversion, easily testable.

## Updated Task Structure

### ✅ KEEP Original Sub-tasks (Revised Scope)

**116.1: Design Fixture Structure**
- Status: Not Started → Ready to implement
- Scope: **Semantic index JSON only**
- Focus: File organization, JSON schema design
- Effort: 2-3 hours

**116.2: Implement Fixture Generation Tooling**
- Status: Not Started → Ready to implement
- Scope: Code → SemanticIndex JSON serialization
- Deliverables:
  - `serialize_semantic_index()` / `deserialize_semantic_index()`
  - CLI tool to generate fixtures
  - Regeneration script for CI
- Effort: 4-6 hours

**116.3: Create/Expand Code Fixtures**
- Status: Partially complete (fixtures exist but need organization)
- Scope: Ensure comprehensive code coverage
- Note: Some fixtures already exist in `packages/core/tests/fixtures/`
- Effort: 2-3 hours

**116.4: Generate Initial JSON Fixtures**
- Status: Not Started (blocked by 116.2)
- Scope: Run generation tool on all code fixtures
- Deliverables: Comprehensive semantic index JSON library
- Effort: 2-3 hours

**116.5: Update Semantic Index Integration Tests**
- Status: Tests exist but need refactoring
- Scope: Use JSON fixtures (as input OR for comparison)
- Approach: Can verify JSON output OR load JSON and verify properties
- Effort: 3-4 hours

**116.6: Update Registry Integration Tests**
- Status: Tests exist but suffer from inline data bloat
- Scope: **Load semantic index JSON as INPUT**, verify in code
- Key change: Replace manual `create_test_index()` with `load_semantic_index_fixture()`
- Effort: 4-5 hours

**116.7: Create Call Graph Integration Tests**
- Status: Unit tests exist, need language-specific integration tests
- Scope: **Load semantic index JSON as INPUT**, verify in code
- Deliverables: Language-specific integration test files
- Effort: 6-8 hours

**116.8: Documentation and Tooling**
- Status: Not Started
- Scope: Document fixture workflow, regeneration process
- Deliverables:
  - How to add new fixtures
  - How to regenerate when schema changes
  - How to use fixtures in tests
- Effort: 2-3 hours

### ❌ DROP Output-Stage JSON Fixtures

**What we're NOT doing:**
- ❌ JSON fixtures for `resolved_symbols` (registry outputs)
- ❌ JSON fixtures for `call_graph` (call graph outputs)
- ❌ Multi-stage JSON pipeline validation
- ❌ Complex JSON comparison for registry/call graph state

**Why:** These outputs are complex, stateful, and better verified with code assertions.

## Implementation Priority

### Phase 1: Fixture Infrastructure (Critical Foundation)
1. **116.1:** Design JSON structure (2-3 hours)
2. **116.2:** Implement generation tooling (4-6 hours)
3. **116.3:** Organize/expand code fixtures (2-3 hours)
4. **116.4:** Generate initial JSON fixtures (2-3 hours)

**Sub-total: 10-15 hours**
**Blocker for:** All subsequent tasks

### Phase 2: High-Value Testing (Addresses Core Problem)
5. **116.6:** Registry integration tests with JSON input (4-5 hours)
   - Immediately reduces test bloat
   - Validates registry architecture
6. **116.7:** Call graph integration tests with JSON input (6-8 hours)
   - Fills biggest testing gap
   - Reuses same JSON fixtures

**Sub-total: 10-13 hours**
**Depends on:** Phase 1 complete

### Phase 3: Polish (Optional but Valuable)
7. **116.5:** Semantic index tests with JSON (3-4 hours)
   - Can verify JSON generation is correct
8. **116.8:** Documentation (2-3 hours)
   - Ensures future maintainability

**Sub-total: 5-7 hours**

## Success Criteria (Revised)

### Must Have
- ✅ Semantic index JSON fixtures exist for all 4 languages
- ✅ Fixtures cover major language features (classes, functions, modules, etc.)
- ✅ Generation tooling works and is documented
- ✅ Registry tests load JSON fixtures (massive reduction in test bloat)
- ✅ Call graph tests load JSON fixtures
- ✅ All tests passing with new fixtures

### Nice to Have
- ✅ Semantic index tests verify JSON output
- ✅ CI automatically validates fixtures are up-to-date
- ✅ Documentation includes regeneration workflow

### Success Metrics
- **Test file size:** Expect 50-70% reduction in registry/call graph test file sizes
- **Fixture reuse:** Same JSON fixtures used in both registry AND call graph tests
- **Maintenance:** Single point of regeneration when SemanticIndex schema changes

## Estimated Effort (Final)

**Original estimate:** 17-24 hours
**Revised estimate:** 25-35 hours

**Breakdown:**
- Phase 1 (Infrastructure): 10-15 hours
- Phase 2 (High-value testing): 10-13 hours
- Phase 3 (Polish): 5-7 hours

**Why higher?** Original estimate didn't account for:
- Serialization/deserialization implementation
- Fixture generation tooling
- Test helper updates for JSON loading
- Documentation of fixture workflow

**Why worth it?**
- Solves real problem (test bloat)
- One-time infrastructure investment
- Ongoing benefits for all future tests
- Fixtures reused across test levels

## Risk Assessment

### Low Risk
- ✅ SemanticIndex structure is stable
- ✅ JSON serialization is straightforward
- ✅ Existing code fixtures already present

### Medium Risk
- ⚠️ Schema changes require fixture regeneration
  - **Mitigation:** Automated regeneration tooling (116.2)
  - **Mitigation:** CI validation to catch drift

### Mitigated Risk (from initial analysis)
- ~~Complex registry state serialization~~
  - **Mitigated:** Not serializing registry outputs, only inputs

## Conclusion

**Initial concern was correct:** The architecture had changed since task creation.

**Initial recommendation was wrong:** I dismissed JSON fixtures entirely, missing the core problem.

**Revised understanding:** JSON fixtures for semantic index outputs solve a REAL problem (test bloat) and are appropriately scoped.

**Final plan:**
1. ✅ Create semantic index JSON fixtures (one-time infrastructure)
2. ✅ Use JSON as INPUT for registry/call graph tests (solves bloat)
3. ✅ Verify outputs in CODE (not JSON comparison)

**Next steps:**
1. Start with Phase 1 (fixture infrastructure)
2. Implement in order: 116.1 → 116.2 → 116.3 → 116.4
3. Move to Phase 2 for immediate test bloat reduction
4. Polish with Phase 3 if time permits

**Key insight:** The original task identified the right problem and proposed a good solution. The only refinement needed is **scoping JSON to inputs only**, not outputs.
