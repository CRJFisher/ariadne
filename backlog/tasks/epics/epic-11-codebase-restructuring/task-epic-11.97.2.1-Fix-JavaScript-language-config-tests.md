# Task Epic-11.97.2.1: Fix JavaScript Language Configuration Tests

## Status
Pending

## Description
Fix all failing tests in `language_configs/javascript.test.ts` by ensuring the JAVASCRIPT_CAPTURE_CONFIG map correctly covers all captures defined in `javascript.scm` and removing any tests for unsupported captures.

## Context
This sub-task focuses specifically on the language configuration test file `src/semantic_index/language_configs/javascript.test.ts`. The configuration tests verify that:
1. All capture patterns from `javascript.scm` have proper mappings in `JAVASCRIPT_CAPTURE_CONFIG`
2. Each mapping has correct semantic categories and entities
3. JavaScript-specific context functions work properly

## Requirements

### Primary Objectives
1. **Audit javascript.scm**: Extract complete list of capture patterns
2. **Review JAVASCRIPT_CAPTURE_CONFIG**: Ensure complete coverage
3. **Fix Configuration Gaps**: Add missing capture mappings
4. **Remove Invalid Tests**: Remove tests for captures not in .scm file
5. **Validate Context Functions**: Ensure JavaScript-specific functions work

### JavaScript Capture Categories to Validate

#### Scopes
- `scope.module`, `scope.function`, `scope.class`, `scope.block`

#### Definitions
- Functions: `def.function`, `def.arrow`
- Classes: `def.class`
- Methods: `def.method`, `def.method.private`, `def.constructor`
- Fields: `def.field`, `def.field.private`
- Variables: `def.variable`, `def.variable.destructured`
- Parameters: `def.param`, `def.param.rest`, `def.param.default`

#### Assignments
- Variable assignments: `assignment.var`, `assignment.arrow`, `assignment.constructor`
- Member assignments: `assignment.member`
- Expression assignments: `assignment.expr`

#### Imports/Exports
- Imports: `import.source`, `import.named`, `import.default`, `import.namespace`
- Exports: `export.named`, `export.default`, `export.declaration`, `export.namespace`, `export.reexport`

#### References
- Function calls: `ref.call`, method calls with chaining
- Property access: `member_access`, `member_access.computed`, `member_access.optional`
- Assignments and updates
- JSX components: `ref.jsx`
- Special references: `ref.this`, `ref.super`

## Implementation Steps

### Step 1: Extract Complete Capture List
```bash
# Extract all capture patterns from javascript.scm
grep -o '@[a-zA-Z0-9_.]*' javascript.scm | sort | uniq
```

### Step 2: Audit Configuration Coverage
1. Compare .scm captures with `JAVASCRIPT_CAPTURE_CONFIG` keys
2. Identify missing mappings
3. Identify extra mappings not in .scm

### Step 3: Fix Configuration Mappings
1. Add missing capture configurations with proper:
   - `SemanticCategory` (SCOPE, DEFINITION, REFERENCE, etc.)
   - `SemanticEntity` (FUNCTION, CLASS, VARIABLE, etc.)
   - `context_function` if needed
2. Remove configurations for captures not in .scm file

### Step 4: Validate Context Functions
1. Review JavaScript-specific context functions
2. Test class context detection
3. Test function vs method distinction
4. Test arrow function handling
5. Test destructuring patterns

### Step 5: Update Test Cases
1. Remove test cases for unsupported captures
2. Add test cases for missing captures
3. Ensure test descriptions match actual functionality
4. Verify expected values match configuration

## JavaScript-Specific Considerations

### Arrow Functions
- Proper detection and categorization
- Assignment to variables vs standalone
- Context function handling

### Destructuring
- Object and array destructuring patterns
- Nested destructuring
- Proper variable definition detection

### Classes and Methods
- Class vs function distinction
- Static method detection
- Private field/method support
- Constructor identification

### JSX Support
- JSX component references
- Proper categorization of JSX elements

## Acceptance Criteria
- [ ] All captures in `javascript.scm` have configuration mappings
- [ ] No configuration exists for captures not in .scm file
- [ ] All test cases in `javascript.test.ts` pass
- [ ] JavaScript-specific context functions work correctly
- [ ] Configuration mappings use correct semantic categories/entities
- [ ] Test coverage includes all major JavaScript constructs

## Deliverables
1. Updated `JAVASCRIPT_CAPTURE_CONFIG` map
2. Fixed test cases in `javascript.test.ts`
3. Documentation of JavaScript-specific capture patterns
4. 100% test pass rate for language configuration

## Dependencies
- `javascript.scm` query file
- `JAVASCRIPT_CAPTURE_CONFIG` in `language_configs/javascript.ts`
- Test utilities and fixtures

## Estimated Effort
- Capture audit: 1 hour
- Configuration fixes: 2 hours
- Test updates: 2 hours
- Validation: 1 hour

Total: ~6 hours

## Parent Task
Task Epic-11.97.2: JavaScript Language Support Validation