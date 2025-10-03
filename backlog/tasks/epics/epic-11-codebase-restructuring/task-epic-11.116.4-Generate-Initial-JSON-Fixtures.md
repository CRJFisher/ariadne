# Task epic-11.116.4: Generate Initial JSON Fixtures

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.2, task-epic-11.116.3
**Priority:** Medium
**Created:** 2025-10-03

## Overview

Use the fixture generation tooling from 116.2 to generate the initial set of JSON fixtures for all code fixtures organized in 116.3. This creates the "golden output" fixtures that integration tests will validate against.

## Objectives

1. Generate semantic_index JSON for all languages
2. Generate symbol_resolution JSON for all languages
3. Generate call_graph JSON for all languages
4. Review and validate generated fixtures
5. Commit baseline fixtures to git

## Sub-tasks

### 116.4.1: Generate semantic_index JSON for All Languages

Run the semantic_index fixture generator on all code fixtures:

```bash
npx tsx scripts/generate_semantic_index_fixtures.ts --all
```

**Expected output structure:**
```
fixtures/
  typescript/semantic_index/
    classes/
      basic_class.semantic_index.json
      inheritance.semantic_index.json
      ...
    functions/
      ...
  python/semantic_index/
    ...
  rust/semantic_index/
    ...
  javascript/semantic_index/
    ...
```

**Actions:**
1. Run generator for each language
2. Verify all code fixtures have corresponding JSON
3. Check for any parsing errors or warnings
4. Review sample outputs for correctness
5. Ensure deterministic output (git diff should be clean on re-run)

**Deliverables:**
- [ ] All TypeScript code fixtures have semantic_index JSON
- [ ] All Python code fixtures have semantic_index JSON
- [ ] All Rust code fixtures have semantic_index JSON
- [ ] All JavaScript code fixtures have semantic_index JSON
- [ ] No parsing errors reported
- [ ] JSON format matches schema from 116.1.2

### 116.4.2: Generate symbol_resolution JSON for All Languages

Run the symbol_resolution fixture generator on all semantic_index fixtures:

```bash
npx tsx scripts/generate_symbol_resolution_fixtures.ts --all
```

**Expected output structure:**
```
fixtures/
  typescript/resolved_symbols/
    classes/
      basic_class.resolved_symbols.json
      ...
```

**Actions:**
1. Run generator using semantic_index JSON as input
2. Verify all semantic_index fixtures have corresponding resolved_symbols JSON
3. Check for resolution failures or unresolved references
4. Review sample outputs:
   - Check that references are resolved to correct definitions
   - Verify symbol ID mapping is correct
   - Check scope resolution is accurate
5. Document any expected unresolved references (e.g., external library calls)

**Deliverables:**
- [ ] All semantic_index fixtures have corresponding resolved_symbols JSON
- [ ] JSON format matches schema from 116.1.3
- [ ] Known limitations documented (e.g., cross-file resolution)
- [ ] Baseline established for what should/shouldn't resolve

### 116.4.3: Generate call_graph JSON for All Languages

Run the call_graph fixture generator on all resolved_symbols fixtures:

```bash
npx tsx scripts/generate_call_graph_fixtures.ts --all
```

**Expected output structure:**
```
fixtures/
  typescript/call_graph/
    classes/
      basic_class.call_graph.json
      ...
```

**Actions:**
1. Run generator using resolved_symbols JSON as input
2. Verify all resolved_symbols fixtures have corresponding call_graph JSON
3. Review sample outputs:
   - Check that function nodes are created correctly
   - Verify enclosed_calls are captured
   - Check entry point detection is accurate
4. Document entry point semantics for each language

**Deliverables:**
- [ ] All resolved_symbols fixtures have corresponding call_graph JSON
- [ ] JSON format matches schema from 116.1.4
- [ ] Entry point detection validated
- [ ] Call graph structure validated for sample fixtures

### 116.4.4: Review and Validate Generated Fixtures

Perform quality review of generated fixtures:

**Validation steps:**

1. **Schema compliance**:
   ```bash
   npx tsx scripts/manage_fixtures.ts validate
   ```
   - Check all JSON is valid
   - Verify schema compliance
   - Check for missing required fields

2. **Pipeline consistency**:
   - Verify symbol IDs from semantic_index appear in resolved_symbols
   - Verify symbol IDs from resolved_symbols appear in call_graph
   - Check location keys are consistent

3. **Manual spot checks**:
   - Pick 2-3 fixtures per language
   - Review JSON by hand
   - Verify it matches expected structure
   - Check for obvious errors (wrong symbols, missing references, etc.)

4. **Coverage check**:
   ```bash
   npx tsx scripts/manage_fixtures.ts stats
   ```
   - Verify expected number of fixtures generated
   - Check for any missing categories
   - Document coverage gaps

**Deliverables:**
- [ ] All fixtures pass schema validation
- [ ] Pipeline consistency verified
- [ ] Manual review completed for sample fixtures
- [ ] Coverage stats documented

## Quality Criteria for Generated Fixtures

### Semantic Index JSON

Should include:
- ✓ All definitions (functions, classes, variables, etc.)
- ✓ All references with scope information
- ✓ Complete scope tree
- ✓ Type information (where applicable)
- ✓ Import/export information

### Resolved Symbols JSON

Should include:
- ✓ All definitions from semantic index
- ✓ All references with resolution status
- ✓ Mapping of reference locations to definition IDs
- ✓ Reverse mapping of definitions to referencing locations

### Call Graph JSON

Should include:
- ✓ Function nodes for all callable definitions
- ✓ Enclosed calls for each function
- ✓ Entry points (uncalled functions)
- ✓ Resolved call targets

## Handling Issues

If generation reveals bugs or issues:

1. **Parsing errors**: Fix in `build_semantic_index`, then regenerate
2. **Resolution errors**: Fix in `resolve_symbols`, then regenerate
3. **Call graph errors**: Fix in `detect_call_graph`, then regenerate
4. **Schema issues**: Update schema in 116.1, then regenerate

**Don't modify fixtures manually** - always fix the source and regenerate.

## Git Strategy

**Initial commit:**
```bash
git add packages/core/tests/fixtures/
git commit -m "feat: Add baseline JSON fixtures for integration testing

- Generated semantic_index fixtures for all languages
- Generated resolved_symbols fixtures for all languages
- Generated call_graph fixtures for all languages
- Establishes golden outputs for integration tests

Part of task-epic-11.116.4"
```

**Large diff considerations:**
- Fixtures may be large - consider git-lfs if needed
- Break into multiple commits if helpful (one per language or stage)
- Include summary stats in commit message

## Acceptance Criteria

- [ ] All code fixtures have corresponding JSON at all three stages
- [ ] All generated JSON validates against schemas
- [ ] Pipeline consistency verified
- [ ] Manual review completed
- [ ] Coverage stats documented
- [ ] Fixtures committed to git
- [ ] No outstanding generation errors

## Estimated Effort

- **Generation runs**: 1 hour
- **Validation and review**: 2 hours
- **Issue investigation and fixes**: 2-3 hours (variable)
- **Documentation**: 30 minutes
- **Total**: ~5-6 hours

## Notes

- This task may uncover bugs in existing implementation - that's good!
- Expect to iterate between generation and bug fixes
- Generated fixtures become the source of truth
- Re-running generation should produce identical output (deterministic)

## Success Metrics

- **Coverage**: 100% of code fixtures have JSON at all stages
- **Validity**: 100% of JSON passes schema validation
- **Consistency**: 100% of symbol ID references are valid
- **Determinism**: Re-running generation produces zero git diff
