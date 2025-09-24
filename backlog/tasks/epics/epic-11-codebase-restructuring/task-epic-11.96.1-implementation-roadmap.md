# Task Epic 11.96.1: Implementation Roadmap

**Task ID**: task-epic-11.96.1
**Component**: Phased Implementation Plan
**Status**: In Planning
**Created**: 2025-01-24
**Total Estimated Duration**: 5-6 days

## Executive Summary

This roadmap provides a detailed, phase-by-phase implementation plan for consolidating the duplicate type resolution implementations. Each phase includes specific tasks, acceptance criteria, and validation steps to ensure successful implementation.

## Implementation Phases Overview

```
Phase 1: Type Flow Extraction (Day 1)
Phase 2: Testing Infrastructure (Day 2)
Phase 3: Dead Code Removal (Day 3 Morning)
Phase 4: Module Restructuring (Day 3-4)
Phase 5: Integration & Validation (Day 5)
Phase 6: Documentation & Cleanup (Day 6)
```

---

## Phase 1: Type Flow Extraction
**Duration**: 1 day
**Risk Level**: Low
**Dependencies**: None

### 1.1 Objectives
- Extract working type flow analysis from `type_resolution.ts`
- Integrate type flow into `symbol_resolution.ts::phase3_resolve_types`
- Maintain backward compatibility

### 1.2 Tasks

#### Task 1.2.1: Analyze Type Flow Implementation
```bash
# Files to analyze
packages/core/src/symbol_resolution/type_resolution/type_resolution.ts
packages/core/src/symbol_resolution/type_resolution/type_flow.ts
```

**Actions**:
1. Review lines 89-97 in type_resolution.ts
2. Identify all type flow helper functions
3. Document data structures used
4. Map dependencies

#### Task 1.2.2: Extract Type Flow Functions
**Source Functions to Extract**:
```typescript
// From type_resolution.ts
- prepare_imports_for_flow (lines 244-270)
- prepare_functions_for_flow (lines 272-290)
- convert_flows_for_analysis (lines 294-375)
```

**Target Location**:
```
packages/core/src/symbol_resolution/
  type_flow_integration.ts (new file)
```

#### Task 1.2.3: Integration into symbol_resolution.ts
**Replace placeholder at lines 235-240**:
```typescript
// Current placeholder
const type_flow = {
  assignment_types: new Map<Location, TypeId>(),
  flow_edges: [],
};

// New implementation
const type_flow = analyze_integrated_type_flow(
  local_extraction,
  imports,
  functions,
  type_registry
);
```

#### Task 1.2.4: Update Result Merging
**Update lines 262-266**:
```typescript
// Ensure proper merging of type flow results
if (type_flow?.assignment_types) {
  for (const [loc, type_id] of type_flow.assignment_types) {
    reference_types.set(location_key(loc), type_id);
  }
}
// Add flow edge handling
if (type_flow?.flow_edges) {
  // Process flow edges
}
// Add inferred types
if (type_flow?.inferred_types) {
  for (const [symbol_id, type_id] of type_flow.inferred_types) {
    symbol_types.set(symbol_id, type_id);
  }
}
```

### 1.3 Validation Checklist
- [ ] Type flow functions extracted successfully
- [ ] Integration compiles without errors
- [ ] Existing tests pass
- [ ] Type flow produces non-empty results
- [ ] No performance regression

### 1.4 Rollback Plan
If integration fails:
1. Revert changes to symbol_resolution.ts
2. Keep extracted functions for debugging
3. Analyze failure points
4. Adjust integration approach

---

## Phase 2: Testing Infrastructure
**Duration**: 1 day
**Risk Level**: Low
**Dependencies**: Phase 1 completion

### 2.1 Objectives
- Create comprehensive test suite for consolidated functionality
- Validate all 8 type resolution features
- Establish performance benchmarks

### 2.2 Tasks

#### Task 2.2.1: Create Test Utilities
**File**: `packages/core/src/symbol_resolution/type_resolution/test_utils.ts`

```typescript
export class TypeResolutionTestBuilder {
  // Build test fixtures
  with_type_definition(def: LocalTypeDefinition): this;
  with_import(file: FilePath, imports: Map): this;
  with_function(sig: FunctionSignature): this;
  with_type_flow(flow: LocalTypeFlowPattern): this;
  build(): TypeResolutionInput;
}

export class TypeResolutionAssertions {
  assert_registry_contains(name: SymbolName): void;
  assert_inheritance(child: TypeId, parent: TypeId): void;
  assert_member_exists(type: TypeId, member: SymbolName): void;
  assert_flow_edge(from: Location, to: Location): void;
}
```

#### Task 2.2.2: Integration Test Suite
**File**: `packages/core/src/symbol_resolution/type_resolution_integrated.test.ts`

```typescript
describe("Integrated Type Resolution", () => {
  describe("Feature Coverage", () => {
    test("1. Data Collection from SemanticIndex");
    test("2. Type Registry Building");
    test("3. Inheritance Resolution");
    test("4. Type Member Resolution");
    test("5. Type Annotation Processing");
    test("6. Type Tracking");
    test("7. Type Flow Analysis");
    test("8. Constructor Discovery");
  });

  describe("Cross-Module Integration", () => {
    test("Registry feeds into all modules");
    test("Inheritance affects member resolution");
    test("Type flow uses function signatures");
    test("Annotations integrate with tracking");
  });

  describe("Edge Cases", () => {
    test("Circular inheritance detection");
    test("Missing type references");
    test("Empty input handling");
    test("Large file processing");
  });
});
```

#### Task 2.2.3: Performance Benchmarks
**File**: `packages/core/src/symbol_resolution/benchmarks/type_resolution.bench.ts`

```typescript
import { bench, describe } from "vitest";

describe("Type Resolution Performance", () => {
  bench("Small project (10 files)", () => {
    // Benchmark small project
  });

  bench("Medium project (100 files)", () => {
    // Benchmark medium project
  });

  bench("Large project (1000 files)", () => {
    // Benchmark large project
  });

  bench("Type flow analysis", () => {
    // Benchmark type flow specifically
  });
});
```

#### Task 2.2.4: Regression Test Suite
**File**: `packages/core/src/symbol_resolution/regression_tests.ts`

```typescript
// Capture current behavior before changes
const baseline_results = {
  test_case_1: capture_current_output(input_1),
  test_case_2: capture_current_output(input_2),
  // ... more cases
};

// Verify no regression after changes
describe("Regression Tests", () => {
  for (const [name, expected] of Object.entries(baseline_results)) {
    test(`No regression: ${name}`, () => {
      const actual = resolve_types(test_inputs[name]);
      expect(actual).toEqual(expected);
    });
  }
});
```

### 2.3 Test Coverage Requirements
- **Unit Tests**: 100% coverage of new code
- **Integration Tests**: All 8 features validated
- **Performance Tests**: No regression (< 5% variation)
- **Edge Cases**: 20+ edge cases covered

### 2.4 Validation Checklist
- [ ] Test utilities created and documented
- [ ] Integration tests cover all features
- [ ] Performance benchmarks established
- [ ] Regression tests capture current behavior
- [ ] All tests pass

---

## Phase 3: Dead Code Removal
**Duration**: 0.5 day
**Risk Level**: Medium
**Dependencies**: Phase 2 completion

### 3.1 Objectives
- Remove unused `resolve_all_types` function
- Delete stub functions and TODOs
- Clean up unused imports and types
- Reduce codebase by ~200+ lines

### 3.2 Tasks

#### Task 3.2.1: Remove Main Function
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts`

**Delete lines 58-120**:
```typescript
// DELETE: Entire resolve_all_types function
export function resolve_all_types(...) {
  // 120 lines of unused code
}
```

#### Task 3.2.2: Remove Stub Functions
**Delete lines 199-222**:
```typescript
// DELETE: Empty stub functions
function find_constructors(...): Map<TypeId, SymbolId> {
  // TODO: Implement constructor finding logic
  return constructors;
}

function find_local_type(...): TypeId | undefined {
  // TODO: Implement local type lookup
  return undefined;
}
```

#### Task 3.2.3: Remove Helper Functions
**Delete lines 244-375** (if not used after Phase 1):
```typescript
// DELETE: Helper functions only used by resolve_all_types
- prepare_imports_for_flow
- prepare_functions_for_flow
- convert_flows_for_analysis
```

#### Task 3.2.4: Update Exports
**File**: `packages/core/src/symbol_resolution/type_resolution/index.ts`

**Remove lines 50-55**:
```typescript
// DELETE: Exports of removed functions
export {
  resolve_all_types,
  build_file_type_registry,
  build_file_type_registry_with_annotations,
  type TypeRegistryResult
} from "./type_resolution";
```

#### Task 3.2.5: Clean Imports
**Audit and remove unused imports**:
```bash
# Find unused imports
npm run lint -- --fix

# Verify no broken imports
npm run typecheck
```

### 3.3 Validation Checklist
- [ ] All identified functions removed
- [ ] Exports updated
- [ ] No compilation errors
- [ ] No test failures
- [ ] Code coverage maintained
- [ ] ~200+ lines removed

### 3.4 Safety Checks
```bash
# Verify no remaining references
rg "resolve_all_types" --type ts
rg "find_constructors" --type ts
rg "find_local_type" --type ts
rg "build_file_type_registry" --type ts

# All should return no results
```

---

## Phase 4: Module Restructuring
**Duration**: 1.5-2 days
**Risk Level**: Medium-High
**Dependencies**: Phase 3 completion

### 4.1 Objectives
- Create new module folder structure
- Extract code to specialized modules
- Implement clean interfaces
- Maintain backward compatibility

### 4.2 Tasks

#### Task 4.2.1: Create Folder Structure
```bash
# Create new module directories
mkdir -p packages/core/src/symbol_resolution/type_resolution/{type_registry,inheritance,type_annotations,type_tracking,type_flow,type_members,rust_types}

# Create index files
for dir in type_registry inheritance type_annotations type_tracking type_flow type_members rust_types; do
  touch packages/core/src/symbol_resolution/type_resolution/$dir/index.ts
  touch packages/core/src/symbol_resolution/type_resolution/$dir/${dir}.ts
  touch packages/core/src/symbol_resolution/type_resolution/$dir/${dir}.test.ts
done
```

#### Task 4.2.2: Extract Type Registry Module
**Source**: Current `type_registry.ts`
**Target**: `type_registry/type_registry.ts`

```typescript
// type_registry/index.ts
export { build_global_type_registry } from "./type_registry";
export type { GlobalTypeRegistry, TypeRegistryInput } from "./types";

// type_registry/type_registry.ts
import type { TypeRegistryInput } from "./types";

export function build_global_type_registry(
  input: TypeRegistryInput
): GlobalTypeRegistry {
  // Existing implementation
}
```

#### Task 4.2.3: Extract Inheritance Module
**Source**: Current `inheritance.ts`
**Target**: `inheritance/inheritance.ts`

```typescript
// inheritance/index.ts
export { resolve_inheritance } from "./inheritance";
export type { TypeHierarchyGraph, InheritanceInput } from "./types";

// inheritance/inheritance.ts
export function resolve_inheritance(
  input: InheritanceInput
): TypeHierarchyGraph {
  // Existing implementation
}
```

#### Task 4.2.4: Extract Other Modules
Repeat pattern for:
- `type_annotations/` - Extract from `resolve_annotations.ts`
- `type_tracking/` - Extract from `track_types.ts`
- `type_flow/` - Extract from `type_flow.ts`
- `type_members/` - Extract from `resolve_members.ts`

#### Task 4.2.5: Consolidate Rust Types
**Source Files**:
```
rust_type_utils.ts
rust_async_types.ts
rust_function_types.ts
rust_advanced_types.ts
rust_ownership_ops.ts
rust_pattern_matching.ts
rust_reference_types.ts
rust_type_resolver.ts
```

**Target**: `rust_types/` directory with organized submodules

#### Task 4.2.6: Update Main Orchestrator
**File**: `packages/core/src/symbol_resolution/type_resolution/index.ts`

```typescript
// New clean orchestrator
import { build_global_type_registry } from "./type_registry";
import { resolve_inheritance } from "./inheritance";
import { resolve_type_annotations } from "./type_annotations";
import { resolve_type_tracking } from "./type_tracking";
import { analyze_type_flow } from "./type_flow";
import { resolve_type_members } from "./type_members";

export function resolve_all_types(
  input: TypeResolutionInput
): TypeResolutionOutput {
  // Extract local types
  const local_types = extract_local_types(input.indices);

  // Build type registry
  const type_registry = build_global_type_registry({
    type_definitions: local_types.type_definitions,
    imports: input.imports
  });

  // Resolve inheritance
  const type_hierarchy = resolve_inheritance({
    type_definitions: local_types.type_definitions,
    imports: input.imports,
    type_registry
  });

  // Process annotations
  const annotation_types = resolve_type_annotations({
    annotations: flatten_annotations(local_types.type_annotations),
    type_registry,
    imports: input.imports
  });

  // Track types
  const tracked_types = resolve_type_tracking({
    type_tracking: local_types.type_tracking,
    type_registry,
    imports: input.imports
  });

  // Analyze type flow
  const type_flow = analyze_type_flow({
    type_flows: local_types.type_flows,
    functions: input.functions,
    type_registry,
    imports: input.imports
  });

  // Resolve members
  const type_members = resolve_type_members({
    type_definitions: local_types.type_definitions,
    type_hierarchy,
    type_registry
  });

  // Consolidate and return
  return consolidate_results({
    type_registry,
    type_hierarchy,
    annotation_types,
    tracked_types,
    type_flow,
    type_members
  });
}
```

### 4.3 Migration Strategy

#### Step 1: Create New Structure (Non-Breaking)
1. Create new folders
2. Copy (don't move) existing code
3. Adapt to new interfaces
4. Test new modules

#### Step 2: Parallel Testing
1. Run old and new implementations
2. Compare outputs
3. Verify identical results
4. Fix discrepancies

#### Step 3: Switch Over
1. Update imports to use new modules
2. Mark old files as deprecated
3. Run full test suite
4. Monitor for issues

#### Step 4: Cleanup
1. Remove old files
2. Update documentation
3. Clean up imports

### 4.4 Validation Checklist
- [ ] All modules extracted successfully
- [ ] New folder structure complete
- [ ] Module interfaces implemented
- [ ] Tests pass for each module
- [ ] Integration tests pass
- [ ] No circular dependencies

---

## Phase 5: Integration & Validation
**Duration**: 1 day
**Risk Level**: Low
**Dependencies**: Phase 4 completion

### 5.1 Objectives
- End-to-end validation
- Performance verification
- Production readiness check
- Documentation updates

### 5.2 Tasks

#### Task 5.2.1: End-to-End Testing
```bash
# Run full test suite
npm test packages/core/src/symbol_resolution/

# Run specific integration tests
npm test -- type_resolution_integrated

# Check coverage
npm run test:coverage
```

#### Task 5.2.2: Performance Validation
```bash
# Run benchmarks
npm run bench packages/core/src/symbol_resolution/

# Compare with baseline
npm run bench:compare baseline.json current.json

# Memory profiling
npm run profile:memory
```

#### Task 5.2.3: Cross-Language Validation
Test with real-world examples:

```typescript
// Test TypeScript
const ts_result = resolve_all_types(ts_project_input);
validate_typescript_output(ts_result);

// Test JavaScript
const js_result = resolve_all_types(js_project_input);
validate_javascript_output(js_result);

// Test Python
const py_result = resolve_all_types(py_project_input);
validate_python_output(py_result);

// Test Rust
const rs_result = resolve_all_types(rs_project_input);
validate_rust_output(rs_result);
```

#### Task 5.2.4: API Compatibility Check
```typescript
// Verify backward compatibility
const old_api_result = phase3_resolve_types(indices, imports, functions);
const new_api_result = resolve_all_types({ indices, imports, functions });

// Results should be equivalent
expect(convert_to_legacy(new_api_result)).toEqual(old_api_result);
```

#### Task 5.2.5: Production Readiness Checklist
- [ ] All tests pass
- [ ] Performance meets requirements
- [ ] Memory usage optimized
- [ ] Error handling comprehensive
- [ ] Logging appropriate
- [ ] Documentation complete

### 5.3 Deployment Validation
```bash
# Build production bundle
npm run build

# Test production build
npm run test:prod

# Verify bundle size
npm run analyze:bundle

# Check for security issues
npm audit
```

---

## Phase 6: Documentation & Cleanup
**Duration**: 0.5 day
**Risk Level**: Low
**Dependencies**: Phase 5 completion

### 6.1 Objectives
- Update all documentation
- Clean up temporary code
- Create migration guide
- Archive old implementations

### 6.2 Tasks

#### Task 6.2.1: Update Architecture Documentation
**Files to Update**:
- `docs/architecture/type-resolution.md`
- `docs/api/symbol-resolution.md`
- `README.md`

#### Task 6.2.2: Create Migration Guide
**File**: `docs/migration/type-resolution-consolidation.md`

```markdown
# Type Resolution Consolidation Migration Guide

## Overview
This guide helps migrate from the old dual implementation
to the new consolidated type resolution system.

## Breaking Changes
- `resolve_all_types` moved to type_resolution/index.ts
- Helper functions no longer exported
- New module structure

## Migration Steps
1. Update imports
2. Adapt to new interfaces
3. Handle new error types

## Examples
[Before/After code examples]
```

#### Task 6.2.3: Update Code Comments
```typescript
// Remove outdated comments
// Update module documentation
// Add interface documentation
// Document design decisions
```

#### Task 6.2.4: Clean Up Temporary Code
```bash
# Remove temporary files
rm -f *_backup.ts
rm -f *_old.ts

# Remove debug code
rg "console.log" --type ts
rg "debugger" --type ts

# Remove TODOs that are complete
rg "TODO.*complete" --type ts
```

#### Task 6.2.5: Create Archive
```bash
# Archive old implementation for reference
mkdir -p archives/type-resolution-old
git mv old_files archives/type-resolution-old/

# Document archive
echo "Archived on $(date) during consolidation" > archives/type-resolution-old/README.md
```

### 6.3 Final Checklist
- [ ] All documentation updated
- [ ] Migration guide complete
- [ ] Code comments current
- [ ] Temporary code removed
- [ ] Old code archived
- [ ] Git history clean

---

## Risk Management

### High-Risk Areas
1. **Type Flow Integration** - Different data structures
2. **Module Extraction** - Potential circular dependencies
3. **Rust Type Consolidation** - Complex interdependencies

### Mitigation Strategies
1. **Feature Flags** - Enable gradual rollout
2. **Parallel Implementation** - Keep old code during transition
3. **Comprehensive Testing** - Test at each phase
4. **Incremental Migration** - Small, reversible changes

### Rollback Procedures
Each phase has a specific rollback plan:
- **Phase 1**: Revert integration, keep extraction
- **Phase 2**: Tests are additive, no rollback needed
- **Phase 3**: Git revert dead code removal
- **Phase 4**: Switch back to old module imports
- **Phase 5**: Use previous version if validation fails

---

## Success Metrics

### Quantitative Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Code Reduction | 200+ lines | `git diff --stat` |
| Test Coverage | 100% | `npm run test:coverage` |
| Performance | No regression | Benchmark comparison |
| Memory Usage | -10% | Memory profiler |
| Bundle Size | No increase | Bundle analyzer |

### Qualitative Metrics
- Code clarity improved
- Module boundaries clear
- Documentation complete
- Developer feedback positive
- No production issues

---

## Timeline Summary

```
Day 1: Phase 1 - Type Flow Extraction
  Morning: Analysis and extraction
  Afternoon: Integration and testing

Day 2: Phase 2 - Testing Infrastructure
  Morning: Test utilities and integration tests
  Afternoon: Performance benchmarks and regression tests

Day 3: Phase 3 & Start Phase 4
  Morning: Dead code removal
  Afternoon: Begin module restructuring

Day 4: Phase 4 - Module Restructuring (continued)
  All day: Complete extraction and restructuring

Day 5: Phase 5 - Integration & Validation
  Morning: End-to-end testing
  Afternoon: Performance validation

Day 6: Phase 6 - Documentation & Cleanup
  Morning: Documentation updates
  Afternoon: Final cleanup and review
```

---

## Post-Implementation Tasks

After successful completion:

1. **Monitor Production** - Watch for any issues
2. **Gather Feedback** - From development team
3. **Performance Tuning** - Optimize based on real usage
4. **Plan Next Phase** - Further improvements

---

## Appendix: Command Reference

### Testing Commands
```bash
# Run all tests
npm test

# Run specific test file
npm test packages/core/src/symbol_resolution/type_resolution.test.ts

# Run with coverage
npm run test:coverage

# Run benchmarks
npm run bench

# Watch mode
npm test -- --watch
```

### Build Commands
```bash
# Type check
npm run typecheck

# Build project
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

### Analysis Commands
```bash
# Bundle analysis
npm run analyze:bundle

# Dependency check
npm run deps:check

# Security audit
npm audit

# Find dead code
npm run analyze:dead-code
```

---

This roadmap provides a comprehensive, actionable plan for consolidating the type resolution implementations. Each phase is designed to be completed independently with clear validation criteria and rollback options.