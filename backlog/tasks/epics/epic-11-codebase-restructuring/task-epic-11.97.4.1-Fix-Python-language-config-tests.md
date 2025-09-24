# Task Epic-11.97.4.1: Fix Python Language Configuration Tests

## Status
Pending

## Description
Fix all failing tests in `language_configs/python.test.ts` by ensuring the PYTHON_CAPTURE_CONFIG map correctly covers all captures defined in `python.scm` and removing any tests for unsupported captures. Currently 35 out of 90 tests are failing.

## Context
This sub-task focuses specifically on the language configuration test file `src/semantic_index/language_configs/python.test.ts`. The configuration tests verify that:
1. All capture patterns from `python.scm` have proper mappings in `PYTHON_CAPTURE_CONFIG`
2. Each mapping has correct semantic categories and entities
3. Python-specific context functions work properly

The failure rate (35/90 tests failing) indicates significant misalignment between the .scm file and the configuration mappings.

## Requirements

### Primary Objectives
1. **Audit python.scm**: Extract complete list of capture patterns
2. **Review PYTHON_CAPTURE_CONFIG**: Ensure complete coverage
3. **Fix Configuration Gaps**: Add missing capture mappings
4. **Remove Invalid Tests**: Remove tests for captures not in .scm file
5. **Validate Context Functions**: Ensure Python-specific functions work

### Python Capture Categories to Validate

#### Scopes
- `scope.module`, `scope.function`, `scope.lambda`, `scope.class`, `scope.method`
- `scope.block`, `scope.for`, `scope.while`, `scope.with`, `scope.if`, `scope.elif`, `scope.else`
- `scope.try`, `scope.except`, `scope.finally`, `scope.match`, `scope.case`
- `scope.comprehension` (list, dict, set, generator)

#### Definitions - Functions and Classes
- `def.function`, `def.function.async`, `def.lambda`
- `def.class`, `def.method`, `def.constructor`, `def.property`
- `def.method.static`, `def.method.class`

#### Definitions - Variables and Parameters
- `def.variable`, `def.variable.typed`, `def.variable.multiple`, `def.variable.tuple`
- `def.param`, `def.param.default`, `def.param.typed`, `def.param.typed.default`
- `def.param.args`, `def.param.kwargs`
- `def.field` (class attributes)

#### Definitions - Control Flow Variables
- `def.loop_var`, `def.loop_var.multiple`, `def.comprehension_var`
- `def.except_var`, `def.with_var`

#### Assignments
- `assignment.var`, `assignment.lambda`, `assignment.typed`, `assignment.multiple`, `assignment.tuple`
- `assignment.expr`, `assignment.member`, `assignment.augmented`

#### Imports and Exports
- `import.module`, `import.module.source`, `import.module.alias`
- `import.source`, `import.named`, `import.named.source`, `import.named.alias`
- `import.star`, `import.source.star`, `import.named.relative`, `import.source.relative`
- `export.all`, `export.all.list`, `export.explicit`, `export.function`, `export.class`, `export.variable`

#### References and Calls
- `ref.call`, method calls with chaining, `ref.constructor`
- `ref.property`, `ref.subscript.object`, `ref.subscript.index`
- `ref.decorator`, `ref.decorator.call`
- `ref.self`, `ref.cls`, `ref.super`
- `ref.type`, `ref.type.generic`

## Known Problem Areas
Based on test failure patterns:

### Context Function Issues
- **Class Context**: Class definition vs method distinction
- **Decorator Context**: Decorator application detection
- **Async Context**: Async function vs regular function
- **Comprehension Context**: Comprehension scope handling

### Missing Configurations
Tests expecting configurations that may not exist for:
- Async functions and await expressions
- Comprehension variables and scopes
- Exception handling constructs
- Type annotations
- Property decorators

### Invalid Test Cases
Tests for captures that may not be defined in `python.scm`:
- Some advanced Python features
- Type hints that aren't captured
- Edge cases not covered by queries

## Implementation Steps

### Step 1: Complete .scm Audit
```bash
# Extract all capture patterns from python.scm
grep -o '@[a-zA-Z0-9_.]*' python.scm | sort | uniq
```

### Step 2: Configuration Coverage Analysis
1. Compare .scm captures with `PYTHON_CAPTURE_CONFIG` keys
2. Create detailed mapping of missing vs extra configurations
3. Prioritize by test failure frequency

### Step 3: Fix Configuration Mappings
1. Add missing capture configurations:
   - Determine appropriate `SemanticCategory`
   - Assign correct `SemanticEntity`
   - Implement `context_function` where needed
2. Remove configurations for captures not in .scm

### Step 4: Implement Missing Context Functions
1. **Class Detection**: Distinguish class definitions from methods
2. **Decorator Handling**: Context for decorator application
3. **Async Function Detection**: Async vs regular function distinction
4. **Comprehension Scope**: List/dict/set comprehension context

### Step 5: Update Test Cases
1. Identify and remove invalid test cases (35 failures to analyze)
2. Add test cases for missing but valid captures
3. Correct expected values to match actual configurations
4. Ensure test descriptions accurately reflect functionality

## Python-Specific Considerations

### Object-Oriented Features
- Class vs function distinction
- Method vs function (self parameter)
- Static methods and class methods
- Property decorators

### Decorators
- Function decorators
- Class decorators
- Built-in decorators (@property, @staticmethod, @classmethod)
- Custom decorator patterns

### Async/Await
- Async function definitions
- Await expressions
- Async context managers
- Async comprehensions

### Import System
- Standard imports vs from imports
- Relative imports (. and ..)
- Star imports (from module import *)
- __all__ export lists

### Comprehensions and Generators
- List, dict, set comprehensions
- Generator expressions
- Comprehension variable scoping
- Nested comprehensions

## Acceptance Criteria
- [ ] All captures in `python.scm` have configuration mappings
- [ ] No configuration exists for captures not in .scm file
- [ ] All test cases in `python.test.ts` pass (currently 35 failing)
- [ ] Python-specific context functions work correctly
- [ ] Configuration mappings use correct semantic categories/entities
- [ ] Test coverage includes all major Python constructs

## Deliverables
1. Updated `PYTHON_CAPTURE_CONFIG` map
2. Implemented missing context functions
3. Fixed test cases in `python.test.ts`
4. Documentation of Python-specific capture patterns
5. 100% test pass rate for language configuration

## Dependencies
- `python.scm` query file
- `PYTHON_CAPTURE_CONFIG` in `language_configs/python.ts`
- Tree-sitter Python parser
- Test utilities and fixtures

## Estimated Effort
- .scm audit: 2 hours
- Configuration fixes: 4 hours
- Context function implementation: 3 hours
- Test updates: 4 hours
- Validation: 2 hours

Total: ~15 hours

## Parent Task
Task Epic-11.97.4: Python Language Support Validation