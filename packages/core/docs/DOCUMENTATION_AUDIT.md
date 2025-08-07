# Documentation Audit Report

## Files to Archive/Remove

### High Priority (Contains outdated patterns)

1. **`docs/testing-guide.md`**
   - References: `src/test/shared-language-tests.ts`
   - Pattern: Old shared testing infrastructure
   - Action: Archive and replace with contract-based testing guide

2. **`docs/language-feature-matrix.md`** (referenced but may not exist)
   - Pattern: Manual feature tracking
   - Action: Replace with auto-generated matrix from folder structure

3. **`packages/core/tests/migration-example.md`**
   - Pattern: Old test structure examples
   - Action: Archive or update with new patterns

### Low Priority (Historical context)

1. **Archived tasks** (already in archive, no action needed)
   - `task-27 - Refactor-testing-infrastructure-for-multi-language-support.md`
   - `task-21 - Add-function-metadata-support.md`
   - `task-18 - Migrate-test-runner-from-Jest-to-Vitest.md`

## Files to Update

### Rules Files

1. **`rules/testing.md`**
   - Current: General testing guidelines
   - Update: Add test contract pattern, language adapter pattern
   - Keep: Core testing principles

2. **`rules/coding.md`**
   - Review for any file structure assumptions
   - Add: Feature-based organization principles

3. **`rules/refactoring.md`**
   - Current: Good principles
   - Add: Migration-specific guidelines

### Documentation Files

1. **`docs/README.md`**
   - Update: Links to new architecture docs
   - Remove: References to old test structure

2. **`docs/jest-to-vitest-migration.md`**
   - Keep: Historical reference
   - Note: Not actively harmful

## New Documentation to Create

### Core Architecture Docs

1. **`docs/ARCHITECTURE.md`**
   - Overall system architecture
   - Hierarchy pattern explanation
   - Feature categories overview

2. **`docs/FEATURE_DEVELOPMENT.md`**
   - How to add new features
   - Test contract creation
   - Language adapter implementation

3. **`docs/LANGUAGE_SUPPORT.md`**
   - How to add new language support
   - Required implementations
   - Testing requirements

### Developer Guides

1. **`docs/TESTING_CONTRACTS.md`**
   - Replace old testing-guide.md
   - Contract-based testing approach
   - Examples and patterns

2. **`docs/MIGRATION_GUIDE.md`**
   - For developers migrating old features
   - Step-by-step instructions
   - Common patterns and solutions

## Documentation Locations to Standardize

### Current Inconsistencies

- Some docs in `/docs/`
- Some in `/packages/core/docs/`
- Some in `/rules/`
- Feature docs should be in feature folders

### Proposed Structure

```
/docs/                          # Repository-level documentation
  ├── ARCHITECTURE.md          # Overall architecture
  ├── CONTRIBUTING.md          # Contribution guidelines
  └── README.md               # Project overview

/packages/core/docs/           # Package-specific documentation
  ├── FEATURE_DEVELOPMENT.md  # Feature development guide
  ├── LANGUAGE_SUPPORT.md     # Language implementation guide
  └── TESTING_CONTRACTS.md    # Testing patterns

/rules/                        # Agent and workflow rules
  ├── *.md                    # Keep as-is, update content

/src/[feature]/README.md      # Feature-specific documentation
```

## Search Patterns to Find More Issues

```bash
# Find references to old test patterns
rg "generateLanguageTests|runLanguageSpecificTests|SHARED_TEST_FIXTURES"

# Find references to old paths
rg "src/test/|test/shared|shared-language-tests"

# Find manual feature matrices
rg "feature.matrix|language.matrix|support.matrix"
```

## Priority Order for Updates

### Week 1
1. Archive `docs/testing-guide.md`
2. Create `docs/ARCHITECTURE.md`
3. Update `rules/testing.md`

### Week 2
1. Create `docs/FEATURE_DEVELOPMENT.md`
2. Create `docs/TESTING_CONTRACTS.md`
3. Update CLAUDE.md references

### Week 3
1. Create `docs/LANGUAGE_SUPPORT.md`
2. Update all remaining rules files
3. Clean up outdated references

## Validation Checklist

- [ ] No references to `shared-language-tests`
- [ ] No references to `generateLanguageTests`
- [ ] No paths like `src/test/*.test.ts`
- [ ] All features have README.md
- [ ] Rules files updated with new patterns
- [ ] CLAUDE.md references current structure
- [ ] CI/CD scripts updated