# Task epic-11.116.4: Generate Initial JSON Fixtures

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.2, task-epic-11.116.3
**Priority:** High (blocks testing tasks)
**Created:** 2025-10-14

## Overview

Use the fixture generation tooling (from 116.2) to generate semantic index JSON fixtures from all organized code files (from 116.3). This creates the fixture library that will be used by all integration tests.

## Prerequisites

- ✅ Task 116.1 complete (schema designed)
- ✅ Task 116.2 complete (tooling implemented)
- ✅ Task 116.3 complete (code fixtures organized)

## Objectives

1. Generate semantic index JSON for all code fixtures
2. Verify generated JSON is valid and complete
3. Review and commit JSON fixtures to version control
4. Document fixture regeneration workflow

## Implementation Steps

### 1. Generate All Fixtures (0.5 hours)

Run the generation tool on all languages:

```bash
cd packages/core

# Generate all fixtures
npm run generate-fixtures -- --all

# Or per-language
npm run generate-fixtures:ts
npm run generate-fixtures:py
npm run generate-fixtures:rs
npm run generate-fixtures:js
```

**Expected output:**
```
=== TYPESCRIPT ===

Generating fixture for fixtures/typescript/code/classes/basic_class.ts...
  ✓ Written to fixtures/typescript/semantic_index/classes/basic_class.json

Generating fixture for fixtures/typescript/code/classes/inheritance.ts...
  ✓ Written to fixtures/typescript/semantic_index/classes/inheritance.json

... (all fixtures)

Found 25 typescript files
Generated 25 fixtures successfully
```

### 2. Verify Generated JSON (1 hour)

**Automated verification:**

Create `scripts/verify_fixtures.ts`:

```typescript
#!/usr/bin/env tsx

import { glob } from "glob";
import path from "path";
import fs from "fs";
import { deserialize_semantic_index } from "../tests/fixtures/deserialize_semantic_index";

let errors = 0;

// Find all generated JSON fixtures
const fixtures = glob.sync("tests/fixtures/**/semantic_index/**/*.json");

console.log(`Verifying ${fixtures.length} fixtures...\n`);

for (const fixture_path of fixtures) {
  try {
    // Try to load and deserialize
    const json_string = fs.readFileSync(fixture_path, "utf-8");
    const json = JSON.parse(json_string);
    const index = deserialize_semantic_index(json);

    // Basic sanity checks
    if (!index.file_path) {
      throw new Error("Missing file_path");
    }
    if (!index.root_scope_id) {
      throw new Error("Missing root_scope_id");
    }
    if (index.scopes.size === 0) {
      throw new Error("No scopes found");
    }

    console.log(`✓ ${path.relative("tests/fixtures", fixture_path)}`);
  } catch (error) {
    console.error(`✗ ${path.relative("tests/fixtures", fixture_path)}`);
    console.error(`  Error: ${error.message}`);
    errors++;
  }
}

console.log(`\n${fixtures.length - errors} passed, ${errors} failed`);
process.exit(errors > 0 ? 1 : 0);
```

Run verification:
```bash
npm run verify-fixtures
```

**Manual spot-checks:**

Open a few JSON files and verify:
- Formatting is readable (2-space indents)
- Structure matches schema
- Symbol IDs look correct
- Scope relationships make sense
- References are captured

Example review:
```bash
# Look at a class fixture
cat tests/fixtures/typescript/semantic_index/classes/basic_class.json | head -50

# Check a complex one
cat tests/fixtures/typescript/semantic_index/modules/imports.json | head -100
```

### 3. Review and Validate (0.5 hours)

**Check for common issues:**

1. **Missing references:** Ensure call sites are captured
   ```bash
   # Grep for "references" arrays
   grep -A 5 '"references":' tests/fixtures/typescript/semantic_index/**/*.json | head -50
   ```

2. **Empty fixtures:** Check if any fixtures have no definitions
   ```bash
   # Find fixtures with empty function/class maps
   grep -l '"functions": {}' tests/fixtures/typescript/semantic_index/**/*.json
   ```

3. **Scope trees:** Verify scope parent/child relationships
   ```bash
   # Check scope structure in a fixture
   jq '.scopes | to_entries[] | {id: .key, parent: .value.parent_id}' \
     tests/fixtures/typescript/semantic_index/classes/basic_class.json
   ```

### 4. Commit to Version Control (0.5 hours)

Add fixtures to git:

```bash
git add tests/fixtures/
git commit -m "feat: add semantic index JSON fixtures for integration tests

Generated from code fixtures using serialize_semantic_index.

These fixtures will be used as inputs for:
- Registry integration tests (116.5)
- Call graph integration tests (116.6)

Fixtures can be regenerated using:
  npm run generate-fixtures -- --all
"
```

**Important:** Add fixture regeneration reminder to CONTRIBUTING.md or similar:

```markdown
## Semantic Index Fixtures

JSON fixtures in `tests/fixtures/{language}/semantic_index/` are generated
from code files in `tests/fixtures/{language}/code/`.

When modifying SemanticIndex schema or adding new code fixtures, regenerate:
```bash
npm run generate-fixtures -- --all
```

## Document Regeneration Workflow (0.5 hours)

Create `tests/fixtures/README.md`:

```markdown
# Test Fixtures

## Structure

- `{language}/code/` - Source code fixtures
- `{language}/semantic_index/` - Generated JSON (SemanticIndex objects)

## Generating Fixtures

After adding/modifying code fixtures or changing SemanticIndex schema:

```bash
# Regenerate all
npm run generate-fixtures -- --all

# Or specific language
npm run generate-fixtures:ts

# Or single file
npm run generate-fixtures -- --file tests/fixtures/typescript/code/classes/new_fixture.ts
```

## Verification

After generation, verify fixtures are valid:

```bash
npm run verify-fixtures
```

## Using in Tests

Load fixtures in integration tests:

```typescript
import { load_fixture } from "./fixtures/test_helpers";

const index = load_fixture("typescript/classes/basic_class.json");
```

## When to Regenerate

- After modifying SemanticIndex type
- After adding/removing code fixtures
- After fixing bugs in index_single_file
- Before committing changes to fixtures/

## CI Integration

CI will verify fixtures are up-to-date by:
1. Running generate-fixtures --all
2. Checking for git diff
3. Failing if fixtures are stale
```

## Deliverables

- [ ] All JSON fixtures generated successfully
- [ ] Verification script confirms all fixtures are valid
- [ ] Manual spot-checks completed
- [ ] Fixtures committed to version control
- [ ] README.md with regeneration workflow
- [ ] npm script for verification added

## Success Criteria

- ✅ JSON fixture exists for every code fixture
- ✅ All fixtures pass verification
- ✅ JSON is well-formatted and human-readable
- ✅ Fixtures are committed to git
- ✅ Regeneration workflow is documented
- ✅ No errors or warnings during generation

## Estimated Effort

**2-3 hours**
- 0.5 hours: Generate fixtures
- 1 hour: Implement and run verification
- 0.5 hours: Manual review and spot-checks
- 0.5 hours: Documentation and commit
- 0.5 hours: Buffer for issues/fixes

## Next Steps

After completion, fixtures are ready to use:
- Proceed to **116.5**: Registry integration tests (use JSON as input)
- Proceed to **116.6**: Call graph integration tests (use JSON as input)

## Notes

- Expect some iteration - may find issues in generation tooling
- If generation fails for some files, fix tooling (116.2) and regenerate
- JSON files will be ~2-5KB each for typical fixtures
- Total fixture library should be < 1MB
- Keep fixtures in version control (they're source of truth for tests)
- Consider adding pre-commit hook to verify fixtures are up-to-date
