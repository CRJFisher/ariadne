# Task epic-11.116.8: Documentation and Tooling Finalization

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.7
**Priority:** Medium
**Created:** 2025-10-03

## Overview

Finalize the integration testing overhaul by creating comprehensive documentation, adding CI validation, and providing troubleshooting guides. This ensures the new fixture system is maintainable and usable by the team.

## Objectives

1. Document fixture format and conventions
2. Create fixture update workflow documentation
3. Add fixture validation to CI pipeline
4. Create troubleshooting guide for fixture mismatches
5. Add maintenance tooling and automation

## Sub-tasks

### 116.8.1: Document Fixture Format and Conventions

Create comprehensive documentation explaining the fixture system.

**Location**: `packages/core/tests/fixtures/README.md`

**Content outline:**

```markdown
# Integration Test Fixtures

## Overview

This directory contains JSON fixtures for integration testing the three main
stages of code analysis:

1. **Semantic Indexing** (`semantic_index.*.test.ts`)
2. **Symbol Resolution** (`symbol_resolution.*.test.ts`)
3. **Call Graph Detection** (`detect_call_graph.*.test.ts`)

## Fixture Pipeline

Code fixtures → Semantic Index JSON → Resolved Symbols JSON → Call Graph JSON

## Directory Structure

[Explain folder structure with examples]

## Fixture Formats

### Semantic Index JSON

[Explain schema, required fields, examples]

### Resolved Symbols JSON

[Explain schema, required fields, examples]

### Call Graph JSON

[Explain schema, required fields, examples]

## Naming Conventions

- Code fixtures: `feature_name.{ext}` (e.g., `basic_class.ts`)
- Semantic index: `feature_name.semantic_index.json`
- Resolved symbols: `feature_name.resolved_symbols.json`
- Call graph: `feature_name.call_graph.json`

## Adding New Fixtures

1. Create code fixture in `{language}/code/{category}/`
2. Run: `npx tsx scripts/manage_fixtures.ts generate --all`
3. Verify generated JSON is correct
4. Commit all files together

## Regenerating Fixtures

When implementation changes:
```bash
# Regenerate all fixtures
npx tsx scripts/manage_fixtures.ts generate --all

# Regenerate specific stage
npx tsx scripts/manage_fixtures.ts generate --stage semantic_index

# Regenerate specific language
npx tsx scripts/manage_fixtures.ts generate --all --language typescript
```

## Validating Fixtures

```bash
# Check fixtures are up-to-date
npx tsx scripts/manage_fixtures.ts validate

# Show coverage stats
npx tsx scripts/manage_fixtures.ts stats
```

## Schema Documentation

[Link to detailed schema docs]

## Troubleshooting

[Link to troubleshooting guide]
```

**Deliverables:**
- [ ] Main README.md created in fixtures directory
- [ ] Schema documentation complete
- [ ] Examples provided for each fixture type
- [ ] Instructions clear and actionable

### 116.8.2: Create Fixture Update Workflow Documentation

Document the workflow for maintaining fixtures when code changes.

**Location**: `packages/core/tests/fixtures/WORKFLOW.md`

**Content outline:**

```markdown
# Fixture Update Workflow

## When to Update Fixtures

### Scenario 1: Implementation Change

You've improved semantic_index to capture more information.

**Workflow:**
1. Make your implementation change
2. Run tests - they will likely fail
3. Regenerate fixtures: `npx tsx scripts/manage_fixtures.ts generate --stage semantic_index`
4. Review the diff carefully - does it match your expected changes?
5. If yes, commit both implementation and fixture changes
6. If no, debug your implementation

### Scenario 2: Bug Fix

You've fixed a bug in symbol resolution.

**Workflow:**
1. Identify affected fixtures
2. Fix the bug
3. Regenerate affected fixtures
4. Verify tests now pass
5. Commit fix and updated fixtures

### Scenario 3: New Language Feature

You're adding support for a new language feature.

**Workflow:**
1. Create code fixture in appropriate category
2. Implement feature support
3. Generate all three JSON fixtures for new code fixture
4. Create or update integration tests
5. Verify tests pass
6. Commit all changes together

### Scenario 4: Adding New Language

**Workflow:**
1. Create new directory: `fixtures/{language}/`
2. Add subdirectories: `code/`, `semantic_index/`, `resolved_symbols/`, `call_graph/`
3. Create initial code fixtures covering basic features
4. Generate JSON fixtures
5. Create integration test files for all three stages
6. Document language-specific conventions

## Git Best Practices

- **Commit together**: Code fixture + generated JSON should be in same commit
- **Review diffs**: Always review fixture diffs before committing
- **Meaningful messages**: Explain what fixture changes represent
- **Atomic changes**: One feature/fix per commit when possible

## Reviewing Fixture Changes

When reviewing PRs with fixture changes:

1. **Check code fixture first**: Is the test case realistic?
2. **Review generated JSON**: Does it match expected behavior?
3. **Look for inconsistencies**: Are all three stages consistent?
4. **Validate coverage**: Does new fixture add meaningful coverage?

## Common Pitfalls

- **Don't hand-edit JSON**: Always regenerate from code
- **Don't commit partial sets**: All three JSONs should exist for each code fixture
- **Don't ignore validation errors**: Fix issues, don't skip validation
```

**Deliverables:**
- [ ] Workflow documentation created
- [ ] Covers all common scenarios
- [ ] Git best practices documented
- [ ] Pitfalls and tips included

### 116.8.3: Add Fixture Validation to CI Pipeline

Integrate fixture validation into CI to catch drift.

**Actions:**

1. **Add npm script** in `packages/core/package.json`:
   ```json
   {
     "scripts": {
       "test:fixtures:validate": "tsx scripts/manage_fixtures.ts validate",
       "test:fixtures:stats": "tsx scripts/manage_fixtures.ts stats"
     }
   }
   ```

2. **Add CI job** in `.github/workflows/test.yml` or equivalent:
   ```yaml
   - name: Validate Integration Fixtures
     run: npm run test:fixtures:validate
     working-directory: packages/core
   ```

3. **Create pre-commit hook** (optional):
   ```bash
   # .husky/pre-commit or similar
   npm run test:fixtures:validate
   ```

**Validation checks:**
- All code fixtures have corresponding JSON at all stages
- All JSON validates against schema
- No orphaned JSON (JSON without code fixture)
- Pipeline consistency (symbol IDs match across stages)

**Deliverables:**
- [ ] CI job added to validate fixtures
- [ ] Validation runs on every PR
- [ ] Clear error messages when validation fails
- [ ] Optional pre-commit hook available

### 116.8.4: Create Troubleshooting Guide

Document common issues and solutions.

**Location**: `packages/core/tests/fixtures/TROUBLESHOOTING.md`

**Content outline:**

```markdown
# Fixture Troubleshooting Guide

## Test Failures

### "Actual output doesn't match fixture"

**Symptoms:** Integration test fails with diff showing differences

**Causes:**
1. Implementation changed behavior
2. Fixture is outdated
3. Non-deterministic output
4. Bug in implementation

**Solutions:**
1. Review the diff - is the new output correct?
2. If yes, regenerate: `npx tsx scripts/manage_fixtures.ts generate ...`
3. If no, debug your implementation
4. If output varies between runs, check for non-deterministic behavior

### "Fixture file not found"

**Symptoms:** Test fails with "Cannot find fixture at path..."

**Causes:**
1. Code fixture exists but JSON not generated
2. Wrong path in test
3. Missing fixture category

**Solutions:**
1. Generate fixtures: `npx tsx scripts/manage_fixtures.ts generate --all`
2. Check test file path matches fixture location
3. Verify fixture directory structure

### "Schema validation failed"

**Symptoms:** Fixture validation reports schema errors

**Causes:**
1. Fixture generated with old schema
2. Manual edit to fixture
3. Bug in generator

**Solutions:**
1. Regenerate fixture with current schema
2. Never manually edit - always regenerate
3. Report bug if generator produces invalid JSON

## Generation Issues

### "Parser error when generating fixtures"

**Symptoms:** Generator reports parse errors

**Causes:**
1. Code fixture has syntax errors
2. Tree-sitter parser bug
3. Unsupported language feature

**Solutions:**
1. Validate code fixture syntax
2. Check if feature is supported in this language version
3. Report parser issue if code is valid

### "Generated JSON is too large"

**Symptoms:** Fixture JSON is megabytes in size

**Causes:**
1. Code fixture is too complex
2. Bug in generator (infinite loop, duplication)

**Solutions:**
1. Split code fixture into smaller focused tests
2. Check for bugs in serialization logic
3. Review what's being captured - is it all necessary?

## CI Failures

### "Fixtures are out of date"

**Symptoms:** CI validation fails with "Fixtures need regeneration"

**Cause:** Code fixture changed but JSON not regenerated

**Solution:**
```bash
npx tsx scripts/manage_fixtures.ts generate --all
git add .
git commit --amend
git push -f
```

### "Pipeline consistency check failed"

**Symptoms:** Validation reports symbol ID mismatches between stages

**Cause:** Fixtures regenerated partially (only some stages updated)

**Solution:** Regenerate all stages:
```bash
npx tsx scripts/manage_fixtures.ts generate --all
```

## Performance Issues

### "Fixture generation is slow"

**Solutions:**
- Generate per-language: `--language typescript`
- Generate per-stage: `--stage semantic_index`
- Consider caching parsed trees
- Check for performance regressions in indexing/resolution

## Getting Help

If you encounter issues not covered here:
1. Check fixture validation output for specific errors
2. Review recent changes to fixture system
3. Ask team for help with example of failing fixture
```

**Deliverables:**
- [ ] Troubleshooting guide created
- [ ] Covers common issues
- [ ] Solutions are actionable
- [ ] Examples provided

## Additional Tooling

### Fixture Diff Viewer

Create a helper tool to show fixture diffs in readable format:

```bash
npx tsx scripts/diff_fixtures.ts \
  typescript/semantic_index/classes/basic_class.semantic_index.json
```

Shows:
- Side-by-side comparison of expected vs actual
- Highlighted differences
- Suggestions for fixing

### Fixture Coverage Report

Enhance `stats` command to show:
- Which language features are covered
- Which fixtures exist at all three stages
- Gaps in coverage
- Test coverage per fixture

Example output:
```
Fixture Coverage Report
=======================

TypeScript:
  Classes:
    ✓ basic_class.ts (all stages, tested)
    ✓ inheritance.ts (all stages, tested)
    ⚠ static_members.ts (missing call_graph)
  Functions:
    ✓ arrow_functions.ts (all stages, tested)
    ✗ async_functions.ts (no fixtures)

Coverage: 85% (17/20 features)
```

## Documentation Structure

Final documentation set:
```
packages/core/tests/fixtures/
├── README.md           # Main documentation
├── WORKFLOW.md         # Update workflows
├── TROUBLESHOOTING.md  # Common issues
└── SCHEMA.md           # Detailed schema docs
```

## Acceptance Criteria

- [ ] All documentation created (README, WORKFLOW, TROUBLESHOOTING)
- [ ] CI validation integrated
- [ ] Pre-commit hook available (optional)
- [ ] Fixture diff viewer implemented
- [ ] Coverage reporting enhanced
- [ ] Documentation is clear and complete
- [ ] Team has reviewed and provided feedback

## Estimated Effort

- **Main README**: 2 hours
- **Workflow documentation**: 1.5 hours
- **CI integration**: 1 hour
- **Troubleshooting guide**: 1.5 hours
- **Additional tooling**: 2 hours
- **Review and iteration**: 1 hour
- **Total**: ~9 hours

## Benefits

After completion:
- ✓ Team understands fixture system
- ✓ Clear process for updating fixtures
- ✓ Automated validation catches drift
- ✓ Common issues documented with solutions
- ✓ System is maintainable long-term
- ✓ New contributors can get up to speed quickly

## Notes

- Documentation should be kept up-to-date as system evolves
- Consider adding documentation to main project README
- Tooling should be discoverable (npm scripts, --help)
- Get team feedback on docs before finalizing
