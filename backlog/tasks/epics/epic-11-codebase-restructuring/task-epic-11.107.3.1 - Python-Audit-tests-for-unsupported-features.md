---
id: task-epic-11.107.3.1
title: 'Python: Audit tests for unsupported features'
status: Completed
assignee: []
created_date: '2025-10-01 10:27'
completed_date: '2025-10-01 13:46'
labels: []
dependencies: []
parent_task_id: task-epic-11.107.3
priority: high
---

## Description

Review semantic_index.python.test.ts to identify and remove:
- Tests for advanced Python features we don't need (metaclasses, descriptors, etc.)
- Tests requiring deep type inference
- Overly specific edge cases

Focus on essential Python features for call graph analysis.

## Implementation Notes

Audited and removed the following tests from semantic_index.python.test.ts:

### Tests Removed

1. **Complex nested generic types test** - Removed overly complex type inference with `Dict[str, List[Tuple[int, str]]]` and complex `Callable` types
2. **super() method calls test** - Removed advanced Python feature (inheritance patterns)
3. **Subscript notation test** - Removed less critical dict/list subscript access patterns
4. **Walrus operator test** - Removed Python 3.8+ edge case (`:=` operator)
5. **@property decorator test** - Removed advanced feature (property getters/setters)
6. **Deeply nested chains test** - Removed overly specific edge case with 6+ level deep attribute chains
7. **Documentation test** - Removed non-functional test that only contained comments

### Result

Reduced from 30 tests to 23 tests, focusing on essential Python features:
- Basic type hints (str, int, float, etc.)
- Generic types (List, Dict, Tuple, Optional, Union)
- Method calls with receivers
- Chained method calls
- Attribute access chains
- Class/method definitions
- Constructor calls
- Assignment tracking
- Edge cases for missing type hints and empty chains

All 23 remaining tests pass successfully.

## Testing Results

### Test Execution
- **Python semantic_index tests**: 23/23 passed (100%)
- **TypeScript compilation**: ✅ Passes with no errors
- **Full test suite**: No regressions introduced in Python tests
- **Duration**: 1.89s for Python test suite

### Test Coverage Maintained
All essential Python features for call graph analysis remain tested:
- ✅ Type metadata extraction (7 tests)
- ✅ Method call metadata (2 tests)
- ✅ Attribute access chains (2 tests)
- ✅ Class and method handling (2 tests)
- ✅ Class instantiation metadata (2 tests)
- ✅ Assignment tracking (2 tests)
- ✅ Function definitions (1 test)
- ✅ Python-specific patterns (1 test)
- ✅ Edge cases (3 tests)
- ✅ Regression tests (1 test)

## Tree-sitter Query Pattern Observations

### Working Patterns (No Issues Found)
The current Python query patterns (`packages/core/src/index_single_file/query_code_tree/queries/python.scm`) correctly capture:

1. **Type annotations**: Function parameters, variables, return types via `type:` field
2. **Method calls**: Using `call_expression` with `attribute` node for method detection
3. **Attribute access**: Using `attribute` nodes for property chains
4. **Class definitions**: Standard `class_definition` node capture
5. **Constructor calls**: Identifying class instantiation via `call` nodes
6. **Generic types**: Capturing `subscript` nodes in type annotations for generics

### Features Removed from Testing (May Need Future Query Work)

1. **Subscript notation** (`obj['key']`):
   - Removed from tests but may be important for tracking dict/list property access
   - Current queries might not capture subscript as member_access
   - **Potential follow-on**: Verify if subscript access should create member_access references

2. **super() method calls**:
   - Important for inheritance call chains
   - Current queries handle this, but removed from testing scope
   - **Potential follow-on**: Add back if inheritance tracking becomes priority

3. **@property decorators**:
   - Property getters/setters affect method vs. attribute access patterns
   - Current queries don't distinguish between property methods and regular methods
   - **Potential follow-on**: Add decorator metadata to method definitions if needed

4. **Walrus operator** (`:=`):
   - Python 3.8+ feature for assignment expressions
   - Current queries may not capture these as assignments
   - **Low priority**: Edge case for modern Python code

## Issues Encountered

### None Critical
No critical issues were encountered during the audit:
- All query patterns work correctly for essential features
- No parsing failures or AST traversal errors
- Type extraction metadata is populated correctly
- Receiver location tracking functions as expected

## Follow-on Work

### Optional Enhancements (Low Priority)

1. **Subscript access tracking**: Consider adding subscript notation back if dictionary/list property chains prove important for call graph completeness

2. **Decorator metadata**: Add decorator information to method definitions if property/classmethod/staticmethod distinctions are needed

3. **super() call chain tracking**: Re-enable if inheritance method resolution requires explicit super() tracking

4. **Complex generic types**: Current queries handle basic generics well; nested generics like `Dict[str, List[Tuple[int, str]]]` work but aren't thoroughly tested

### No Critical Work Required
The Python query patterns are sufficient for current call graph analysis needs. All removed tests were for advanced features or edge cases that don't impact core functionality.

## Recommendations

1. **Keep test suite lean**: Continue focusing on essential features rather than comprehensive edge case coverage
2. **Monitor real-world usage**: If subscript access or decorator patterns become important in actual codebases, add targeted tests back
3. **Language parity**: Ensure JavaScript/TypeScript/Rust test suites follow similar essential-feature-only approach
4. **Query documentation**: Consider documenting Python-specific AST patterns (attribute vs. member_expression, etc.) for future maintainers
