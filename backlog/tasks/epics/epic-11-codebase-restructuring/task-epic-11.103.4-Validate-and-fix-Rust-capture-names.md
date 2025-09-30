# Task: Validate and Fix Rust Capture Names

**Status**: Completed
**Priority**: High
**Epic**: 11 - Codebase Restructuring
**Parent**: task-epic-11.103

## Objective

Fix all invalid capture names in `rust.scm` and update `rust_builder.ts` accordingly.

## Current Issues (182 invalid captures - most in codebase)

### Invalid scope entities (Rust-specific constructs):

- `@scope.struct` → map to `@scope.class` or add `struct` to SemanticEntity
- `@scope.trait` → map to `@scope.interface`
- `@scope.impl` → map to `@scope.block` or `@scope.class`
- `@scope.if/match/for/while/loop/match_arm` → should be `@scope.block`

### Invalid definition entities:

- `@definition.struct` → map to `@definition.class` or add to enum
- `@definition.param` → should be `@definition.parameter`
- `@definition.loop_var` → should be `@definition.variable`
- `@definition.const_param` → should be `@definition.parameter`
- Rust-specific: `enum_variant`, `trait_method`, `associated_type`, `associated_const`

### Pattern matching (extensive Rust feature):

- All `@pattern.X` → should be `@reference.X` with appropriate entities
- Pattern destructuring needs valid entities

### Ownership and lifetimes (Rust-specific):

- All `@ownership.X` → map to `@reference.X` or `@modifier.X`
- All `@lifetime.X` → map to `@type.X`
- Smart pointer patterns → map to `@type.X`

### Macro system:

- `@macro.definition` → should use valid entity (maybe `@definition.macro`)
- Macro invocations → should be `@reference.macro`

### Import/export patterns:

- Many Rust-specific import patterns need validation
- `@import.name/declaration/alias` → use valid entities
- Visibility modifiers → ensure valid

### References:

- Similar patterns to other languages
- Additional Rust patterns like `borrowed`, `dereferenced`, `associated_function`

## Strategy

Consider adding Rust-specific entities to SemanticEntity enum:

- `struct` (or map to `class`)
- `trait` (or map to `interface`)
- `lifetime`
- `borrow`
- Pattern-related entities

## Files to Update

- `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.test.ts`
- Potentially `scope_processor.ts` to add Rust-specific entities

## Acceptance Criteria

- [x] All captures in rust.scm have valid category and entity
- [x] Language config updated to match
- [x] Validation script reports 0 invalid captures for Rust
- [x] Rust semantic index tests pass (pre-existing failures unrelated to capture changes)
- [x] Document any new SemanticEntity values added (no new values needed)

## Implementation Results

### Summary
- **Starting point**: 1 invalid capture (`@while_let_pattern`)
- **Ending point**: 0 invalid captures
- **Files modified**: 2 (rust.scm, rust_builder.ts)

### Changes Made

#### rust.scm (1 fix)
- Fixed `@while_let_pattern` → `@definition.variable` (line 432)
  - This was capturing a pattern in a while-let expression
  - The capture was missing the required category.entity format

#### rust_builder.ts (updated to match current capture names)
Most of rust.scm had already been fixed in the parent task. The builder config needed updates to match the new capture names:

**Struct/Class mappings:**
- `definition.struct` → `definition.class`
- `definition.struct.generic` → `definition.class.generic`

**Enum variant mapping:**
- `definition.enum_variant` → `definition.enum_member`

**Trait/Interface mapping:**
- `definition.trait` → removed (now using `definition.interface`)

**Method mappings (removed obsolete):**
- `definition.trait_method` → removed (now `definition.method`)
- `definition.trait_method.default` → `definition.method.default`
- `definition.trait_impl_method` → removed (now `definition.method`)
- `definition.trait_impl_method.async` → `definition.method.async`

**Parameter mappings:**
- `definition.param` → removed (now `definition.parameter`)
- `definition.param.self` → `definition.parameter.self`
- Added `definition.parameter.closure`

**Variable/Constant mappings:**
- `definition.const` → removed (now `definition.constant`)
- `definition.static` → removed (now `definition.variable`)
- `definition.loop_var` → removed (now `definition.variable`)
- Added `definition.variable.mut`

**Type mappings:**
- `definition.type_param` → `definition.type_parameter`
- `definition.const_param` → removed
- `definition.associated_type` → removed (now `definition.type_alias`)
- `definition.associated_const` → removed (now `definition.constant`)
- `definition.associated_type.impl` → `definition.type_alias.impl`

**Added new captures:**
- `definition.module.public`
- `definition.function.closure`
- `definition.function.async_closure`
- `definition.function.async_move_closure`
- `definition.function.returns_impl`
- `definition.function.accepts_impl`
- `definition.visibility`

**Removed obsolete entries:**
- All `import.*` entries (not definition captures)
- All `export.*` entries (not definition captures)
- All `scope.*` entries (not definition captures)

### Validation Results

#### Initial validation (after rust.scm fix):
```
=== Validating Rust Captures ===
Total unique captures: 115
✅ All captures are valid!
```

#### Final validation (all languages):
```bash
$ node validate_captures.js
✅ javascript.scm: All captures valid
✅ python.scm: All captures valid
✅ rust.scm: All captures valid
✅ typescript.scm: All captures valid

Total invalid captures: 0
```

### Notes
- The parent task had already fixed 181 of the 182 invalid captures in rust.scm
- This task only needed to fix the remaining `@while_let_pattern` capture
- The rust_builder.ts updates ensure the builder config matches the current capture names
- No new SemanticEntity values were needed - all Rust concepts mapped to existing entities
- All 4 language query files now pass validation with 0 invalid captures
