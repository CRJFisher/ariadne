---
id: TASK-199.23
title: "Fix: namespace-qualified constructor binding resolution (new X.Class())"
status: Done
assignee: []
created_date: "2026-04-01 13:25"
updated_date: "2026-04-15 11:46"
labels:
  - enhancement
  - call-resolution
  - typescript
  - python
  - rust
dependencies:
  - TASK-199.18
references:
  - packages/types/src/symbol_references.ts
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
  - packages/core/src/index_single_file/query_code_tree/queries/javascript.scm
  - packages/core/src/index_single_file/query_code_tree/queries/python.scm
  - packages/core/src/index_single_file/query_code_tree/queries/rust.scm
  - >-
    packages/core/src/index_single_file/query_code_tree/queries/CAPTURE-SCHEMA.md
  - packages/core/src/index_single_file/references/references.ts
  - packages/core/src/index_single_file/references/factories.ts
  - packages/core/src/index_single_file/type_preprocessing/constructor.ts
  - >-
    packages/core/src/index_single_file/query_code_tree/metadata_extractors/metadata_extractors.rust.ts
  - >-
    packages/core/src/index_single_file/query_code_tree/metadata_extractors/metadata_extractors.python.ts
  - packages/core/src/resolve_references/registries/type.ts
  - packages/core/src/resolve_references/call_resolution/constructor.ts
  - packages/core/src/resolve_references/call_resolution/method_lookup.ts
  - packages/core/src/resolve_references/call_resolution/method.ts
  - packages/core/src/resolve_references/call_resolution/call_resolver.ts
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

When a constructor call uses a namespace-qualified name, the variable assigned from that call receives no type binding, so subsequent method calls on it cannot resolve. This affects TypeScript, Python, and Rust, but the failure mechanism differs per language.

### TypeScript/JavaScript: `const user = new models.User(name)`

Two compounding failures:

**Failure A — Query never fires**: `typescript.scm` lines 314–320 and 600–608 both require `constructor: (identifier)`. For `new models.User(name)` the constructor field is a `member_expression`, so zero `constructor_call` references are generated.

**Failure B — Resolution can't handle qualified names**: Even if captured, `TypeRegistry.resolve_type_metadata` (type.ts:204) calls `resolutions.resolve(scope_id, "User")`, which fails because only `"models"` is in scope. The same failure occurs in `resolve_constructor_call` (call_resolution/constructor.ts:46–48).

The existing integration test at `resolve_references.typescript.test.ts:165–175` documents this: `greet()` remains an entry point because `user`'s type is never bound to `User`.

### Python: `user = models.User(name)`

Python's failure is at the reference-kind level. `is_method_call()` in `metadata_extractors.python.ts` returns `true` for any `attribute`-access call, so `models.User(name)` becomes a `MethodCallReference` (not a `FunctionCallReference`). This means:

- `extract_construct_target` is never called (only called for `FUNCTION_CALL`/`CONSTRUCTOR_CALL`)
- `preprocess_python_references` skips it (only converts `function_call`)
- `extract_constructor_bindings` ignores it (only processes `constructor_call`)

Crucially, the call resolution already works correctly: `resolve_method_call` → `resolve_method_on_type` correctly follows the namespace import to find `User` and `include_constructors_for_class_symbols` adds `__init__`. The call graph edge is correct. The only gap is that `user`'s type is never registered in `TypeRegistry`.

### Rust: `let x = models::Struct { field: val }`

Rust has two constructor patterns in `rust.scm`. The `::new()` pattern (lines 662–669) already works for all path depths because it uses `path: (_)`. The struct literal pattern (lines 684–687) uses `name: (_)` which captures the full path text `"models::Struct"` — but `extract_call_name` in `metadata_extractors.rust.ts` has no branch for `scoped_type_identifier`, so `reference_name` falls back to the full path. Resolution then fails because no symbol is named `"models::Struct"`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

### TypeScript/JavaScript

- [x] #1 `const user = new models.User(name); user.greet()` resolves `greet()` to the User class method, where `models` is a namespace import (`import * as models from "./models"`)
- [x] #2 Existing non-namespace constructor bindings (`const user = new User(name)`) continue to work unchanged
- [x] #3 The integration test `import * as X; new X.Class() should resolve cross-file constructor` is updated to expect `greet_entry` to be `undefined`

### Python

- [x] #4 `user = models.User(name); user.greet()` resolves `greet()` to the User class method, where `models` is an import
- [x] #5 Existing Python class instantiation (`user = User(name)`) continues to work unchanged
- [x] #6 Integration test added for Python namespace-qualified instantiation

### Rust

- [x] #7 `let x = models::Struct { field: val }; x.method()` resolves `method()` to the struct's method
- [x] #8 `let x = models::Struct::new()` continues to work (regression guard only — already works)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

The implementation is organised in four passes: (A) clean up the types package, (B) extend the indexing layer, (C) wire the resolution layer, (D) fix Rust name extraction.

---

### Pass A — Type cleanup (packages/types/src/symbol_references.ts)

All changes to `symbol_references.ts` are made in one edit.

**A1. Remove dead fields**

- Remove `constructed_type?: TypeInfo` from `ConstructorCallReference` — never written or read anywhere in the codebase.
- Remove `argument_types?: readonly TypeInfo[]` from `FunctionCallReference` — never written or read anywhere in the codebase.

**A2. Normalise boolean naming on `MethodCallReference`**

`MethodCallReference` uses `optional_chaining?: boolean` while `PropertyAccessReference` uses `is_optional_chain: boolean` for the same concept. Rename the field on `MethodCallReference` to `is_optional_chain` (required, non-nullable, matching `PropertyAccessReference`). Update all read/write sites.

**A3. Add `property_chain` to `ConstructorCallReference`**

```typescript
export interface ConstructorCallReference extends BaseReference {
  readonly kind: "constructor_call";
  readonly construct_target?: Location;
  /** Namespace-qualified constructors: ["models", "User"] for new models.User() */
  readonly property_chain?: readonly SymbolName[];
}
```

**A4. Add `potential_construct_target` to `MethodCallReference`**

```typescript
export interface MethodCallReference extends BaseReference {
  readonly kind: "method_call";
  readonly receiver_location: Location;
  readonly property_chain: readonly SymbolName[];
  readonly is_optional_chain: boolean;
  /** Python: location of assigned variable when this call is class instantiation */
  readonly potential_construct_target?: Location;
}
```

---

### Pass B — Indexing layer (index_single_file)

**B1. typescript.scm and javascript.scm — add namespace-qualified constructor captures**

Both files need two new patterns. The qualifier `.qualified` is consistent with the CAPTURE-SCHEMA.md semantic-qualifier convention.

```scheme
; Variable declarations with namespace-qualified constructor calls
(variable_declarator
  name: (identifier) @assignment.variable
  value: (new_expression
    constructor: (member_expression) @assignment.constructor.qualified
  )
) @assignment.constructor.qualified

; Standalone namespace-qualified constructor calls
(new_expression
  constructor: (member_expression) @reference.constructor.qualified
) @reference.call.qualified
```

The `"constructor"` substring in the capture name routes to `ReferenceKind.CONSTRUCTOR_CALL` via the existing `determine_reference_kind` logic (references.ts:91).

**B2. CAPTURE-SCHEMA.md — add missing entries and qualifier taxonomy**

While editing the query files, also update CAPTURE-SCHEMA.md:

- Add `@reference.constructor.qualified` / `@assignment.constructor.qualified` to the TypeScript/JavaScript optional captures section.
- Add the currently undocumented Rust captures: `@reference.constructor.associated`, `@reference.constructor.struct`.
- Add `@reference.constructor` to the Python section.
- Add a constructor qualifier taxonomy note:
  - `.generic` — involves type parameters (`new Foo<T>()`)
  - `.qualified` — accessed via namespace/member path (`new ns.Foo()`, `ns.Foo()`)
  - `.associated` — Rust `::new()` associated function
  - `.struct` — Rust struct literal `Foo { field: val }`

**B3. references/factories.ts — update two factory functions**

- `create_constructor_call_reference`: add optional `property_chain?: readonly SymbolName[]` parameter.
- `create_method_call_reference`: add optional `potential_construct_target?: Location` parameter; rename `optional_chaining` parameter to `is_optional_chain`.

**B4. references/references.ts — handle member_expression constructor captures**

In the name extraction fallback block (around line 348), add a branch for `member_expression` capture nodes:

```typescript
} else if (reference_name === (capture.text as SymbolName) && capture.node.type === "member_expression") {
  // Namespace-qualified constructor: extract class name from property
  const property_node = capture.node.childForFieldName("property");
  if (property_node) {
    reference_name = property_node.text as SymbolName;
  }
}
```

In the `CONSTRUCTOR_CALL` switch case, extract the property chain when the capture node is a `member_expression`:

```typescript
case ReferenceKind.CONSTRUCTOR_CALL: {
  const construct_target = this.extractors
    ? this.extractors.extract_construct_target(capture.node, this.file_path)
    : undefined;

  let property_chain: readonly SymbolName[] | undefined;
  if (capture.node.type === "member_expression") {
    const obj = capture.node.childForFieldName("object");
    const prop = capture.node.childForFieldName("property");
    if (obj && prop) {
      property_chain = [obj.text as SymbolName, prop.text as SymbolName];
    }
  }

  reference = create_constructor_call_reference(
    reference_name, location, scope_id, construct_target, property_chain
  );
  break;
}
```

`extract_construct_target` already navigates parent nodes correctly from a `member_expression` node (walks up to `variable_declarator`).

In the `METHOD_CALL` creation path (`process_method_reference`), call `extract_construct_target` and pass the result to the factory:

```typescript
const potential_construct_target = this.extractors
  ? this.extractors.extract_construct_target(capture.node, this.file_path)
  : undefined;
// pass to create_method_call_reference
```

**B5. type_preprocessing/constructor.ts — surface namespace info**

Change `extract_constructor_bindings` to return two maps rather than one:

```typescript
export function extract_constructor_bindings(
  references: readonly SymbolReference[]
): {
  simple: ReadonlyMap<LocationKey, SymbolName>;
  qualified: ReadonlyMap<LocationKey, readonly SymbolName[]>;
};
```

- `simple`: existing behaviour — `construct_target → "User"` for `new User()`
- `qualified`: new — `construct_target → ["models", "User"]` for references with `property_chain.length > 1`

Update the single call site in `registries/type.ts` to destructure the result.

**B6. metadata_extractors.rust.ts — handle scoped_type_identifier in extract_call_name**

Add a branch in `extract_call_name` mirroring the existing `scoped_identifier` branch:

```typescript
if (node.type === "scoped_type_identifier") {
  return node.childForFieldName("name")?.text as SymbolName | undefined;
}
```

This extracts just `"Struct"` from `models::Struct`, matching the symbol name for the struct definition.

---

### Pass C — Resolution layer (resolve_references)

**C1. method_lookup.ts — export shared namespace lookup primitive**

Rename the private `resolve_namespace_method` to `resolve_namespace_export` and export it. The current name says "method" but the function finds any exported symbol (class, function, variable). Also export `resolve_named_import` for symmetry.

```typescript
export function resolve_namespace_export(
  source_file: FilePath,
  export_name: SymbolName,
  definitions: DefinitionRegistry
): SymbolId | null; // single result, not array — it's a name lookup, not polymorphic dispatch
```

Change the return type from `SymbolId[]` to `SymbolId | null` since namespace export lookup is a direct name match, not polymorphic. Update the internal call site in `resolve_method_on_type`.

**C2. method.ts → method_call.ts — rename for consistency**

Rename `call_resolution/method.ts` to `call_resolution/method_call.ts` to match `function_call.ts` and `constructor.ts`. Update the single import in `call_resolver.ts`.

**C3. registries/type.ts — namespace resolution for qualified type bindings**

- Remove the stale `// TODO: move these to a folder with this module` comment on line 15.
- Add `import_path_resolver: (import_id: SymbolId) => FilePath | undefined` parameter to `update_file`. Update the call site in `project.ts` to pass `(id) => this.imports.get_resolved_import_path(id)`.
- Add `qualified_type_bindings: Map<LocationKey, readonly SymbolName[]>` to `ExtractedTypeData`. Populate from `extract_constructor_bindings().qualified`.
- In `resolve_type_metadata`, after step 1, add a step for qualified bindings:

```typescript
// STEP 1b: Resolve namespace-qualified constructor type bindings
for (const [loc_key, chain] of extracted.qualified_type_bindings) {
  const symbol_id = definitions.get_symbol_at_location(loc_key);
  if (!symbol_id || this.symbol_types.has(symbol_id)) continue;

  const scope_id = definitions.get_symbol_scope(symbol_id);
  if (!scope_id) continue;

  const namespace_id = resolutions.resolve(scope_id, chain[0]);
  if (!namespace_id) continue;

  const namespace_def = definitions.get(namespace_id);
  if (
    namespace_def?.kind !== "import" ||
    namespace_def.import_kind !== "namespace"
  )
    continue;

  const source_file = import_path_resolver(namespace_id);
  if (!source_file) continue;

  const class_id = resolve_namespace_export(source_file, chain[1], definitions);
  if (class_id) {
    this.symbol_types.set(symbol_id, class_id);
    resolved_symbols.add(symbol_id);
  }
}
```

**C4. registries/type.ts — add register_symbol_type for Python post-resolution binding**

Add a public method:

```typescript
register_symbol_type(symbol_id: SymbolId, type_id: SymbolId, file_path: FilePath): void {
  this.symbol_types.set(symbol_id, type_id);
  let contributions = this.resolved_by_file.get(file_path);
  if (!contributions) {
    contributions = { resolved_symbols: new Set() };
    this.resolved_by_file.set(file_path, contributions);
  }
  contributions.resolved_symbols.add(symbol_id);
}
```

**C5. call_resolution/constructor.ts — resolve through namespace when property_chain is set**

Add `import_path_resolver: ((import_id: SymbolId) => FilePath | undefined) | undefined` parameter to `resolve_constructor_call`. When `call_ref.kind === "constructor_call"` and `call_ref.property_chain` is set:

1. `resolutions.resolve(scope_id, property_chain[0])` → namespace import symbol
2. Verify `import_kind === "namespace"`, get source file via `import_path_resolver`
3. `resolve_namespace_export(source_file, property_chain[1], definitions)` → class symbol
4. Proceed with existing `find_constructor_in_class_hierarchy` logic

**C6. call_resolution/call_resolver.ts — wire import resolver and Python type binding**

Pass the import resolver to `resolve_constructor_call`:

```typescript
case "constructor_call":
  resolved_symbols = resolve_constructor_call(
    ref,
    context.definitions,
    resolver,
    (import_id) => context.imports.get_resolved_import_path(import_id)
  );
  break;
```

For Python: after `include_constructors_for_class_symbols`, register the type binding when a method call with `potential_construct_target` resolved to a class:

```typescript
if (ref.kind === "method_call" && ref.potential_construct_target) {
  const class_sym = resolved_symbols.find(
    (s) => context.definitions.get(s)?.kind === "class"
  );
  if (class_sym) {
    const target_sym = context.definitions.get_symbol_at_location(
      location_key(ref.potential_construct_target)
    );
    if (target_sym) {
      context.types.register_symbol_type(
        target_sym,
        class_sym,
        ref.location.file_path
      );
    }
  }
}
```

Update the module docstring to note that `resolve_calls` has a type-registry side effect for Python namespace constructors (it is no longer purely functional).

---

### Pass D — Tests

**D1. Update the TypeScript integration test** (`resolve_references.typescript.test.ts:175`)

- Flip `expect(greet_entry).toBeDefined()` → `toBeUndefined()`
- Remove the "known limitation" comment (lines 165–167)

**D2. Add a Python integration test** (`resolve_references.python.test.ts` or equivalent)

- Mirror the TypeScript test: `import models; user = models.User(name); user.greet()` — assert `greet` is not an entry point

**D3. Add unit tests for `extract_constructor_bindings`** (`type_preprocessing/constructor.test.ts`)

- Add TypeScript case: `new models.User(name)` → qualified map has `["models", "User"]`

**D4. Add Rust regression test**

- `let x = models::Struct { field: val }` — assert struct's method resolves and is not an entry point

---

## IA improvements deferred to separate tasks

The following were identified during review but are out of scope for this task:

| Item                                                                                     | Rationale for deferral                                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Move `index_single_file/type_preprocessing/` to `resolve_references/type_preprocessing/` | Broad rename touching both major module trees; existing TODO already tracks it |
| Rename `index_single_file/file_utils.ts` → `parsed_file.ts`                              | Trivial rename, unrelated to this work                                         |
| Rename `index_single_file/node_utils.ts` → `node_location.ts`                            | Trivial rename, unrelated to this work                                         |
| Fix `@assignment.constructor` asymmetry between `typescript.scm` and `javascript.scm`    | Pre-existing inconsistency; no impact on correctness                           |
| Rename `ResolutionContext` → `ReceiverResolutionContext` in `receiver_resolution.ts`     | Cosmetic disambiguation; not blocking                                          |
| Clean up duplicate re-exports in `packages/types/src/index.ts`                           | Trivial, unrelated to this work                                                |

<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Implemented full namespace-qualified constructor binding resolution across TypeScript/JavaScript, Python, and Rust.

**Pass A** — Cleaned up `symbol_references.ts`: removed dead fields (`constructed_type`, `argument_types`), renamed `optional_chaining` → `is_optional_chain` (required) on `MethodCallReference`, added `property_chain` to `ConstructorCallReference`, added `potential_construct_target` to `MethodCallReference`.

**Pass B** — Extended indexing layer: added `@assignment.constructor.qualified` / `@reference.constructor.qualified` / `@reference.call.qualified` patterns to `typescript.scm` and `javascript.scm`; updated `CAPTURE-SCHEMA.md` with new captures and constructor qualifier taxonomy; updated `factories.ts` for new parameters; added `member_expression` branch in `references.ts` to extract property_chain and potential_construct_target; changed `extract_constructor_bindings` to return `{ simple, qualified }` (`ConstructorBindings`); fixed Rust `extract_call_name` for `scoped_type_identifier` (extracts `"Struct"` from `"models::Struct"`).

**Pass C** — Wired resolution layer: exported `resolve_namespace_export` from `method_lookup.ts`; renamed `method.ts` → `method_call.ts`; added `qualified_type_bindings` to `ExtractedTypeData` in `type.ts` with STEP 1b namespace resolution; added `register_symbol_type` to `TypeRegistry` for Python post-resolution binding; added namespace resolution path to `resolve_constructor_call` in `constructor.ts`; wired `import_path_resolver` and Python type binding registration in `call_resolver.ts`; updated `project.ts` to pass import resolver.

**Pass D** — Tests: flipped TypeScript integration test (D1) to assert `greet_entry` is undefined; added Python integration test (D2) verifying `import models; user = models.User(name); user.greet()` resolves; added D3 unit test verifying qualified constructor bindings `["models", "User"]`; added D4 Rust regression test for `models::User { ... }` struct literal.

All 8 acceptance criteria met. TypeScript compiles clean. All source tests pass.

<!-- SECTION:FINAL_SUMMARY:END -->
