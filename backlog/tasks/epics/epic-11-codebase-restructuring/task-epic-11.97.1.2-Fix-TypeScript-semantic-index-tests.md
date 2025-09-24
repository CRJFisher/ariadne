# Task Epic-11.97.1.2: Fix TypeScript Semantic Index Integration Tests

## Status
Pending

## Description
Fix all failing tests in `semantic_index.typescript.test.ts` by ensuring the integration tests properly validate TypeScript code parsing using real code fixtures and the corrected query patterns.

## Context
This sub-task focuses specifically on the semantic index integration test file `src/semantic_index/semantic_index.typescript.test.ts`. These tests validate that:
1. TypeScript code is correctly parsed using tree-sitter
2. Query patterns extract expected semantic information
3. Real TypeScript language constructs are properly captured
4. Integration between parser, queries, and semantic index works

## Requirements

### Primary Objectives
1. **Review Test Fixtures**: Ensure TypeScript fixtures cover all language features
2. **Fix Capture Expectations**: Align test expectations with actual .scm patterns
3. **Add Missing Coverage**: Test TypeScript-specific features not currently covered
4. **Remove Invalid Tests**: Remove tests for patterns not supported in .scm
5. **Validate Real Code**: Ensure tests work with realistic TypeScript examples

### TypeScript Features to Test

#### Core Language Constructs
- Functions (regular, async, generator)
- Classes (regular, abstract, with inheritance)
- Interfaces and type aliases
- Enums (numeric, string, computed)
- Namespaces/modules

#### Type System Features
- Generic types and constraints
- Type parameters on functions/classes/interfaces
- Type annotations on parameters, returns, fields
- Optional parameters and properties
- Access modifiers (public, private, protected)
- Readonly modifier

#### Advanced Features
- Decorators (class, method, property)
- Abstract classes and methods
- Constructor parameter properties
- Method overloads
- Type assertions (as expressions)
- Typeof queries

#### Import/Export Patterns
- TypeScript-specific exports (interfaces, types, enums)
- Type-only imports/exports
- Namespace imports
- Re-exports with type information

## Implementation Steps

### Step 1: Audit Current Test Coverage
1. Review existing test cases in `semantic_index.typescript.test.ts`
2. Identify which TypeScript features are tested
3. Compare with captures available in `typescript.scm`
4. Document gaps in coverage

### Step 2: Review Test Fixtures
1. Examine TypeScript fixture files in `fixtures/typescript/`
2. Ensure fixtures include comprehensive TypeScript examples
3. Add missing language constructs if needed
4. Verify fixtures compile with TypeScript compiler

### Step 3: Fix Failing Tests
1. Run current tests and identify specific failures
2. Debug each failure:
   - Check if capture pattern exists in .scm
   - Verify expected semantic entity types
   - Validate test logic and expectations
3. Fix or remove tests based on actual .scm support

### Step 4: Add Missing Test Coverage
1. Add tests for TypeScript features not currently covered
2. Focus on TypeScript-specific constructs:
   - Interface definitions and implementations
   - Enum definitions and variants
   - Generic type parameters
   - Decorators and access modifiers
   - Type annotations

### Step 5: Validate Integration
1. Test with realistic TypeScript code samples
2. Verify cross-reference between definitions and references
3. Ensure proper scope tracking for TypeScript constructs
4. Test performance with larger TypeScript files

## Test Categories to Address

### Definition Tests
- Interface definitions: `SemanticEntity.INTERFACE`
- Type alias definitions: `SemanticEntity.TYPE_ALIAS`
- Enum definitions: `SemanticEntity.ENUM`
- Namespace definitions: `SemanticEntity.NAMESPACE`
- Generic type parameters: `SemanticEntity.TYPE_PARAMETER`

### Reference Tests
- Type references in annotations
- Generic type instantiations
- Interface implementations
- Type assertions
- Method calls with type arguments

### Scope Tests
- Interface scopes
- Enum scopes
- Namespace scopes
- Generic parameter scopes

### Integration Tests
- Class inheritance with interfaces
- Generic functions with constraints
- Decorated classes and methods
- Complex type relationships

## Acceptance Criteria
- [ ] All tests in `semantic_index.typescript.test.ts` pass
- [ ] Test coverage includes all major TypeScript language features
- [ ] Tests validate against realistic TypeScript code samples
- [ ] No tests exist for unsupported capture patterns
- [ ] Integration between queries and semantic index works correctly
- [ ] Performance is acceptable for typical TypeScript files
- [ ] Test fixtures are comprehensive and valid TypeScript

## Deliverables
1. Fixed test cases in `semantic_index.typescript.test.ts`
2. Updated or new TypeScript test fixtures
3. Comprehensive test coverage documentation
4. 100% test pass rate for semantic index integration

## Dependencies
- Task Epic-11.97.1.1 completion (fixed language configuration)
- TypeScript test fixtures
- Working tree-sitter TypeScript parser
- Semantic index infrastructure

## Estimated Effort
- Test audit: 2 hours
- Fixture review: 1 hour
- Test fixes: 4 hours
- Coverage additions: 3 hours
- Integration validation: 2 hours

Total: ~12 hours

## Parent Task
Task Epic-11.97.1: TypeScript Language Support Validation