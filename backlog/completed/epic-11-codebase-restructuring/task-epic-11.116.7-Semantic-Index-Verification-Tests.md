# Task epic-11.116.7: Semantic Index Verification Tests

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.5.1, task-epic-11.116.5.2, task-epic-11.116.5.3, task-epic-11.116.5.4
**Priority:** Medium
**Created:** 2025-10-14
**Updated:** 2025-10-16

## Overview

Verify that the comprehensive semantic index JSON fixtures added in tasks 11.116.5.1-4 correctly represent their source code files. This provides validation that our indexing logic properly captures all language features across TypeScript, JavaScript, Python, and Rust.

Tasks 11.116.5.1-4 added extensive fixture coverage for:
- **TypeScript**: 42+ fixtures covering classes, enums, functions, generics, interfaces, modules, types, and integration scenarios
- **JavaScript**: 21+ fixtures covering classes, functions, modules (CommonJS/ES6), and dynamic patterns
- **Python**: 17+ fixtures covering classes, functions, modules, and import patterns
- **Rust**: 8+ fixtures covering structs, functions, and modules

Each fixture includes both source code (`code/`) and corresponding semantic index JSON (`semantic_index/`).

## Objectives

1. Verify generated JSON matches expected structure
2. Validate that indexing produces correct results
3. Provide regression protection for index_single_file
4. Document expected semantic index outputs

## Approach

This task verifies the comprehensive fixtures added in 11.116.5.1-4 by:

1. **Reading fixture pairs**: For each language, read both source code files and their corresponding JSON files
2. **Verifying semantic accuracy**: Check that the JSON correctly represents the semantic elements in the code
3. **Documenting issues**: When discrepancies are found, create sub-tasks to fix the indexing logic or regenerate fixtures

### Verification Strategy

For each fixture category, verify that:

- **Definitions are captured**: All classes, functions, methods, variables are present in the JSON
- **Scopes are correct**: Scope hierarchy matches the lexical structure
- **References are accurate**: Function calls, variable references, imports are correctly identified
- **Types are preserved**: Type information is captured where applicable
- **Locations are precise**: Source locations correctly point to code positions

### Sub-Task Structure

Create one verification sub-task per language:

1. **11.116.7.1**: TypeScript fixtures (42+ fixtures across 8 categories)
2. **11.116.7.2**: JavaScript fixtures (21+ fixtures across 3 categories)
3. **11.116.7.3**: Python fixtures (17+ fixtures across 3 categories)
4. **11.116.7.4**: Rust fixtures (8+ fixtures across 3 categories)

Each sub-task should:
- Read all JSON fixtures for that language
- Read corresponding source code files
- Verify semantic accuracy
- Create issue sub-tasks when discrepancies are found

## Deliverables

### Main Task
- [ ] All 4 sub-tasks completed (one per language)
- [ ] Issue sub-tasks created for any discrepancies found
- [ ] Summary report of verification results

### Per Sub-Task
- [ ] All fixtures for that language verified
- [ ] List of verified semantic elements per fixture
- [ ] Issue sub-tasks created for problems (if any)
- [ ] Documentation of verification approach

## Success Criteria

- ✅ All fixture JSON files verified against source code
- ✅ Semantic accuracy confirmed for all language features
- ✅ Issues documented as sub-tasks
- ✅ Verification approach documented

## Estimated Effort

**12-16 hours total** across 4 sub-tasks:
- TypeScript: 4-5 hours (42+ fixtures)
- JavaScript: 3-4 hours (21+ fixtures)
- Python: 3-4 hours (17+ fixtures)
- Rust: 2-3 hours (8+ fixtures)

## Sub-Tasks

- [ ] **11.116.7.1**: Verify TypeScript fixtures
- [ ] **11.116.7.2**: Verify JavaScript fixtures
- [ ] **11.116.7.3**: Verify Python fixtures
- [ ] **11.116.7.4**: Verify Rust fixtures

## Next Steps

1. Create the 4 sub-task files
2. Start with TypeScript verification (largest fixture set)
3. Document verification patterns that can be reused across languages
4. Fix any issues found before moving to registry/call graph tests

## Notes

- This task validates the foundation for integration testing
- Finding and fixing issues now prevents problems in 116.5 and 116.6
- Each sub-task should create granular issue sub-tasks for problems
- Verification should be thorough but pragmatic - focus on semantic correctness
