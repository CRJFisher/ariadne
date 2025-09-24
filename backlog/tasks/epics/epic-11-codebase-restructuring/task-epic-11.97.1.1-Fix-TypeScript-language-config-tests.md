# Task Epic-11.97.1.1: Fix TypeScript Language Configuration Tests

## Status
Pending

## Description
Fix all failing tests in `language_configs/typescript.test.ts` by ensuring the TYPESCRIPT_CAPTURE_CONFIG map correctly covers all captures defined in `typescript.scm` and removing any tests for unsupported captures.

## Context
This sub-task focuses specifically on the language configuration test file `src/semantic_index/language_configs/typescript.test.ts`. The configuration tests verify that:
1. All capture patterns from `typescript.scm` have proper mappings in `TYPESCRIPT_CAPTURE_CONFIG`
2. Each mapping has correct semantic categories and entities
3. TypeScript-specific context functions work properly

## Requirements

### Primary Objectives
1. **Audit typescript.scm**: Extract complete list of capture patterns
2. **Review TYPESCRIPT_CAPTURE_CONFIG**: Ensure complete coverage
3. **Fix Configuration Gaps**: Add missing capture mappings
4. **Remove Invalid Tests**: Remove tests for captures not in .scm file
5. **Validate Context Functions**: Ensure TypeScript-specific functions work

### TypeScript Capture Categories to Validate

#### Scopes
- `scope.module`, `scope.function`, `scope.class`, `scope.interface`, `scope.enum`, `scope.namespace`, `scope.block`

#### Definitions
- Basic: `def.function`, `def.class`, `def.interface`, `def.type_alias`, `def.enum`, `def.namespace`
- Methods: `def.method`, `def.constructor`
- Fields: `def.field`, `def.field.private`, `def.field.param_property`
- Parameters: `def.param`, `def.param.optional`
- Type System: `def.type_param`

#### Type Annotations
- Parameter types: `param.typed`, `param.typed.optional`
- Return types: `function.with_return_type`, `method.with_return_type`
- Field types: `field.typed`, `property.typed`
- Variable types: `var.typed`

#### Access Modifiers & Decorators
- Access: `method.with_access`, `field.with_access`
- Modifiers: `method.with_static`, `field.with_static`, `field.with_readonly`
- Decorators: `class.decorated`, `method.decorated`, `property.decorated`

#### Imports/Exports
- Standard patterns plus TypeScript-specific: `export.interface`, `export.type_alias`, `export.enum`

#### References
- Standard patterns plus TypeScript-specific: generics, type references, type assertions

## Implementation Steps

### Step 1: Extract Complete Capture List
```bash
# Extract all capture patterns from typescript.scm
grep -o '@[a-zA-Z0-9_.]*' typescript.scm | sort | uniq
```

### Step 2: Audit Configuration Coverage
1. Compare .scm captures with `TYPESCRIPT_CAPTURE_CONFIG` keys
2. Identify missing mappings
3. Identify extra mappings not in .scm

### Step 3: Fix Configuration Mappings
1. Add missing capture configurations with proper:
   - `SemanticCategory` (SCOPE, DEFINITION, REFERENCE, etc.)
   - `SemanticEntity` (FUNCTION, CLASS, INTERFACE, etc.)
   - `context_function` if needed
2. Remove configurations for captures not in .scm file

### Step 4: Validate Context Functions
1. Review TypeScript-specific context functions
2. Test interface context detection
3. Test enum context detection
4. Test namespace context detection
5. Test generic type parameter handling

### Step 5: Update Test Cases
1. Remove test cases for unsupported captures
2. Add test cases for missing captures
3. Ensure test descriptions match actual functionality
4. Verify expected values match configuration

## Acceptance Criteria
- [ ] All captures in `typescript.scm` have configuration mappings
- [ ] No configuration exists for captures not in .scm file
- [ ] All test cases in `typescript.test.ts` pass
- [ ] TypeScript-specific context functions work correctly
- [ ] Configuration mappings use correct semantic categories/entities
- [ ] Test coverage includes all major TypeScript constructs

## Deliverables
1. Updated `TYPESCRIPT_CAPTURE_CONFIG` map
2. Fixed test cases in `typescript.test.ts`
3. Documentation of TypeScript-specific capture patterns
4. 100% test pass rate for language configuration

## Dependencies
- `typescript.scm` query file
- `TYPESCRIPT_CAPTURE_CONFIG` in `language_configs/typescript.ts`
- Test utilities and fixtures

## Estimated Effort
- Capture audit: 1 hour
- Configuration fixes: 2 hours
- Test updates: 2 hours
- Validation: 1 hour

Total: ~6 hours

## Parent Task
Task Epic-11.97.1: TypeScript Language Support Validation