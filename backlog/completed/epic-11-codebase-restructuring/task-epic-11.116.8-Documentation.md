# Task epic-11.116.8: Documentation and CI Integration

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.5, task-epic-11.116.6
**Priority:** Medium
**Created:** 2025-10-14

## Overview

Document the fixture system, workflow, and best practices. Add CI checks to ensure fixtures stay up-to-date.

## Objectives

1. Document fixture system architecture
2. Create workflow guides for common tasks
3. Add CI validation for fixtures
4. Document testing patterns

## Documentation to Create

### 1. Fixture System README

**File:** `packages/core/tests/fixtures/README.md`

```markdown
# Test Fixtures

## Overview

This directory contains test fixtures for integration testing. Fixtures consist of:
- **Code files** (`{language}/code/`) - Source code examples
- **JSON files** (`{language}/semantic_index/`) - Generated semantic index outputs

## Structure

```
fixtures/
├── typescript/
│   ├── code/                  # Source .ts files
│   │   ├── classes/
│   │   ├── functions/
│   │   └── modules/
│   └── semantic_index/        # Generated JSON
│       ├── classes/
│       ├── functions/
│       └── modules/
├── python/
├── rust/
└── javascript/
```

## Using Fixtures in Tests

### Load fixtures

```typescript
import { load_fixture } from "./fixtures/test_helpers";

const index = load_fixture("typescript/classes/basic_class.json");
```

### Build registries

```typescript
import { build_registries } from "./fixtures/test_helpers";

const { definitions, resolutions } = build_registries([index]);
```

### Detect call graph

```typescript
import { detect_call_graph } from "../src/trace_call_graph/detect_call_graph";

const graph = detect_call_graph(definitions, resolutions);
```

## Generating Fixtures

### Initial generation

After adding new code fixtures:

```bash
# Generate all
npm run generate-fixtures -- --all

# Generate specific language
npm run generate-fixtures:ts

# Generate single file
npm run generate-fixtures -- --file tests/fixtures/typescript/code/classes/new.ts
```

### Regeneration workflow

When SemanticIndex schema changes:

```bash
# 1. Regenerate all fixtures
npm run generate-fixtures -- --all

# 2. Verify they're valid
npm run verify-fixtures

# 3. Run tests
npm test

# 4. Commit changes
git add tests/fixtures
git commit -m "chore: regenerate semantic index fixtures"
```

## Adding New Fixtures

### 1. Create code fixture

```bash
# Create new code file
touch tests/fixtures/typescript/code/new_feature/example.ts

# Write code demonstrating the feature
```

### 2. Generate JSON

```bash
npm run generate-fixtures -- --file tests/fixtures/typescript/code/new_feature/example.ts
```

### 3. Use in tests

```typescript
it("should handle new feature", () => {
  const index = load_fixture("typescript/new_feature/example.json");
  // ... test logic
});
```

## Fixture Design Guidelines

### Good fixtures

✅ Demonstrate a specific language feature clearly
✅ Are realistic (not just minimal syntax)
✅ Include enough complexity for call graph testing
✅ Are self-contained (no external dependencies)
✅ Are 50-150 lines (not too large)

### Avoid

❌ Minimal "hello world" examples
❌ Overly complex scenarios
❌ Fixtures that test multiple unrelated features
❌ Fixtures with external dependencies

## When Fixtures Break

If fixtures become invalid after code changes:

1. **Schema change?** Regenerate all fixtures
2. **Bug fix?** Regenerate affected fixtures
3. **Breaking change?** May need to update code fixtures

Always run verification after regeneration:

```bash
npm run generate-fixtures -- --all
npm run verify-fixtures
npm test
```

## CI Integration

CI automatically verifies fixtures are up-to-date:

```yaml
- name: Check fixtures are current
  run: |
    npm run generate-fixtures -- --all
    git diff --exit-code tests/fixtures/
```

If this fails, regenerate fixtures locally and commit.
```

### 2. Testing Patterns Documentation

**File:** Add section to `packages/core/README.md` or `TESTING.md`

```markdown
## Integration Testing with Fixtures

### Pattern: Registry Integration Tests

Load semantic index JSON → Build registries → Verify behavior

```typescript
it("should resolve cross-file imports", () => {
  // Load fixtures
  const utils = load_fixture("typescript/modules/utils.json");
  const main = load_fixture("typescript/modules/imports.json");

  // Build registries
  const { definitions, resolutions } = build_registries([utils, main]);

  // Verify resolution
  const ref = find_reference(main, "helper");
  const resolved = resolutions.resolve(ref.scope_id, "helper");
  expect(resolved).toBeDefined();
});
```

### Pattern: Call Graph Integration Tests

Load semantic index JSON → Build registries → Detect call graph → Verify structure

```typescript
it("should detect function call chains", () => {
  // Load fixture
  const index = load_fixture("typescript/functions/call_chains.json");

  // Build registries and detect call graph
  const { definitions, resolutions } = build_registries([index]);
  const graph = detect_call_graph(definitions, resolutions);

  // Verify call graph
  const main = find_node_by_name(graph, "main");
  expect_calls(main, "processData");
  expect_entry_point(graph, main.symbol_id);
});
```

### Adding New Tests

1. Identify required fixture(s)
2. Create code fixture if missing
3. Generate JSON fixture
4. Write test using fixture
5. Verify test passes
```

### 3. Schema Change Workflow

**File:** `packages/core/docs/SCHEMA_CHANGES.md` (or add to CONTRIBUTING.md)

```markdown
## Updating SemanticIndex Schema

When modifying the `SemanticIndex` type:

### 1. Update Type Definition

Edit `packages/types/src/semantic_index.ts`

### 2. Update Serialization

Update `packages/core/tests/fixtures/serialize_semantic_index.ts`:
- Add new fields to serialization
- Update `SemanticIndexJSON` type

Update `packages/core/tests/fixtures/deserialize_semantic_index.ts`:
- Add new fields to deserialization

### 3. Update Schema Tests

Update `packages/core/tests/fixtures/serialization.test.ts`:
- Add tests for new fields
- Verify round-trip works

### 4. Regenerate All Fixtures

```bash
cd packages/core
npm run generate-fixtures -- --all
npm run verify-fixtures
```

### 5. Update Tests

If schema change affects tests:
- Update test assertions
- Fix any broken tests

### 6. Commit Changes

```bash
git add packages/types/src/semantic_index.ts
git add packages/core/tests/fixtures/serialize_semantic_index.ts
git add packages/core/tests/fixtures/deserialize_semantic_index.ts
git add packages/core/tests/fixtures/*/semantic_index/**/*.json
git commit -m "feat: update SemanticIndex schema

- Add new field: xyz
- Regenerated all fixtures
- Updated serialization/deserialization
"
```

### 7. PR Checklist

- [ ] Type definition updated
- [ ] Serialization/deserialization updated
- [ ] Round-trip tests pass
- [ ] All fixtures regenerated
- [ ] All integration tests pass
- [ ] CI passes
```

## CI Integration

### GitHub Actions Workflow

Add to `.github/workflows/test.yml`:

```yaml
jobs:
  test:
    steps:
      # ... existing steps ...

      - name: Verify semantic index fixtures are up-to-date
        run: |
          cd packages/core
          npm run generate-fixtures -- --all
          if ! git diff --quiet tests/fixtures/; then
            echo "ERROR: Semantic index fixtures are out of date"
            echo "Run: npm run generate-fixtures -- --all"
            echo "Then commit the changes"
            git diff tests/fixtures/
            exit 1
          fi

      - name: Verify fixtures are valid
        run: |
          cd packages/core
          npm run verify-fixtures
```

### Pre-commit Hook (Optional)

**File:** `.githooks/pre-commit`

```bash
#!/bin/bash

# Check if SemanticIndex type changed
if git diff --cached --name-only | grep -q "packages/types/src/semantic_index.ts"; then
  echo "⚠️  SemanticIndex type changed"
  echo "Remember to regenerate fixtures:"
  echo "  cd packages/core && npm run generate-fixtures -- --all"
  echo ""
  echo "Continuing commit..."
fi

# Check if semantic index fixtures are staged without generation
if git diff --cached --name-only | grep -q "packages/core/tests/fixtures/.*/semantic_index/"; then
  echo "✓ Semantic index fixtures modified"
fi
```

## Deliverables

- [ ] `tests/fixtures/README.md` - Complete fixture documentation
- [ ] Testing patterns documented in main README or TESTING.md
- [ ] Schema change workflow documented
- [ ] CI check for fixture freshness added
- [ ] Optional pre-commit hook created
- [ ] All documentation reviewed and clear

## Success Criteria

- ✅ New developers can understand fixture system from docs
- ✅ Schema change workflow is clear and documented
- ✅ CI catches stale fixtures
- ✅ Testing patterns are documented with examples
- ✅ Regeneration workflow is clear

## Estimated Effort

**2-3 hours**
- 1 hour: Fixture README
- 0.5 hours: Testing patterns documentation
- 0.5 hours: Schema change workflow
- 0.5 hours: CI integration
- 0.5 hours: Review and refinement

## Next Steps

After completion:
- Entire task 11.116 is complete!
- Fixture system is documented and CI-validated
- Future developers can easily contribute

## Notes

- Good documentation prevents confusion later
- CI integration catches mistakes early
- Pre-commit hooks are optional but helpful
- Keep documentation concise and example-driven
- Update docs as fixture system evolves
