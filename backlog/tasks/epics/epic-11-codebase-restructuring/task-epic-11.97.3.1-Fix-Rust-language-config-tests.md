# Task Epic-11.97.3.1: Fix Rust Language Configuration Tests

## Status
Pending

## Description
Fix all failing tests in `language_configs/rust.test.ts` by ensuring the RUST_CAPTURE_CONFIG map correctly covers all captures defined in `rust.scm` and removing any tests for unsupported captures. Currently 54 out of 90 tests are failing.

## Context
This sub-task focuses specifically on the language configuration test file `src/semantic_index/language_configs/rust.test.ts`. The configuration tests verify that:
1. All capture patterns from `rust.scm` have proper mappings in `RUST_CAPTURE_CONFIG`
2. Each mapping has correct semantic categories and entities
3. Rust-specific context functions work properly

The high failure rate (54/90 tests failing) indicates significant misalignment between the .scm file and the configuration mappings.

## Requirements

### Primary Objectives
1. **Audit rust.scm**: Extract complete list of capture patterns
2. **Review RUST_CAPTURE_CONFIG**: Ensure complete coverage
3. **Fix Configuration Gaps**: Add missing capture mappings
4. **Remove Invalid Tests**: Remove tests for captures not in .scm file
5. **Validate Context Functions**: Ensure Rust-specific functions work

### Rust Capture Categories to Validate

#### Scopes
- `scope.module`, `scope.function`, `scope.closure`, `scope.struct`, `scope.enum`, `scope.trait`, `scope.impl`
- `scope.block`, `scope.block.unsafe`, `scope.block.async`
- `scope.if`, `scope.match`, `scope.for`, `scope.while`, `scope.loop`, `scope.match_arm`

#### Definitions - Basic Types
- `def.struct`, `def.struct.generic`, `def.enum`, `def.enum_variant`
- `def.trait`, `def.type_alias`, `def.const`, `def.static`, `def.module`

#### Definitions - Functions and Methods
- `def.function`, `def.function.async`, `def.function.generic`, `def.function.closure`
- `def.method`, `def.method.associated`, `def.constructor`, `def.trait_method`

#### Definitions - Variables and Parameters
- `def.variable`, `def.variable.mut`, `def.param`, `def.param.self`, `def.param.closure`
- `def.loop_var`

#### Generics and Lifetimes
- `def.type_param`, `def.type_param.constrained`, `def.const_param`
- `lifetime.param`, `lifetime.ref`

#### Imports and Visibility
- `import.name`, `import.source`, `import.alias`, `import.wildcard`, `import.list.item`, `import.extern_crate`
- `visibility.pub`

#### Exports
- `export.struct`, `export.enum`, `export.function`, `export.trait`, `export.module`
- `export.pub_use` with various patterns

#### Macros
- `def.macro`, `ref.macro`, `ref.macro.scoped`

#### References and Calls
- `ref.call`, method calls, associated function calls
- `ref.field`, `ref.constructor.struct`
- `ref.self`, `ref.super`, `ref.type`
- References, dereferences, try operator, await

## Known Problem Areas
Based on test failure patterns:

### Context Function Issues
- **Module Context**: Crate root vs non-root module detection
- **Closure Context**: Closure scope identification
- **Impl Block Context**: Implementation block handling
- **Generic Context**: Type parameter handling

### Missing Configurations
Tests expecting configurations that may not exist for:
- Async blocks and functions
- Pattern matching constructs
- Lifetime annotations
- Unsafe blocks
- Macro definitions and invocations

### Invalid Test Cases
Tests for captures that may not be defined in `rust.scm`:
- Some advanced Rust features
- Edge cases not covered by queries
- Language constructs not yet implemented

## Implementation Steps

### Step 1: Complete .scm Audit
```bash
# Extract all capture patterns from rust.scm
grep -o '@[a-zA-Z0-9_.]*' rust.scm | sort | uniq
```

### Step 2: Configuration Coverage Analysis
1. Compare .scm captures with `RUST_CAPTURE_CONFIG` keys
2. Create detailed mapping of missing vs extra configurations
3. Prioritize by test failure frequency

### Step 3: Fix Configuration Mappings
1. Add missing capture configurations:
   - Determine appropriate `SemanticCategory`
   - Assign correct `SemanticEntity`
   - Implement `context_function` where needed
2. Remove configurations for captures not in .scm

### Step 4: Implement Missing Context Functions
1. **Crate Detection**: Implement proper crate root vs module detection
2. **Closure Handling**: Add closure scope context function
3. **Impl Block Detection**: Create impl block context function
4. **Generic Parameter Handling**: Add type parameter context support

### Step 5: Update Test Cases
1. Identify and remove invalid test cases (54 failures to analyze)
2. Add test cases for missing but valid captures
3. Correct expected values to match actual configurations
4. Ensure test descriptions accurately reflect functionality

## Rust-Specific Considerations

### Ownership and Borrowing
- Reference and dereference operators
- Mutable vs immutable bindings
- Lifetime annotations

### Trait System
- Trait definitions vs implementations
- Associated functions vs methods
- Generic constraints

### Module System
- Crate vs module distinction
- Visibility modifiers
- Use declarations vs pub use

### Pattern Matching
- Match expressions and arms
- Pattern bindings
- Guard expressions

## Acceptance Criteria
- [ ] All captures in `rust.scm` have configuration mappings
- [ ] No configuration exists for captures not in .scm file
- [ ] All test cases in `rust.test.ts` pass (currently 54 failing)
- [ ] Rust-specific context functions work correctly
- [ ] Configuration mappings use correct semantic categories/entities
- [ ] Test coverage includes all major Rust constructs

## Deliverables
1. Updated `RUST_CAPTURE_CONFIG` map
2. Implemented missing context functions
3. Fixed test cases in `rust.test.ts`
4. Documentation of Rust-specific capture patterns
5. 100% test pass rate for language configuration

## Dependencies
- `rust.scm` query file
- `RUST_CAPTURE_CONFIG` in `language_configs/rust.ts`
- Tree-sitter Rust parser
- Test utilities and fixtures

## Estimated Effort
- .scm audit: 2 hours
- Configuration fixes: 4 hours
- Context function implementation: 3 hours
- Test updates: 4 hours
- Validation: 2 hours

Total: ~15 hours

## Parent Task
Task Epic-11.97.3: Rust Language Support Validation