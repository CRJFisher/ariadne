# Task epic-11.116.2: Implement Fixture Generation Tooling

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.1
**Priority:** High
**Created:** 2025-10-03

## Overview

Build command-line tooling to automatically generate and regenerate JSON fixtures from code fixtures. This enables easy fixture maintenance and ensures fixtures stay in sync with implementation changes.

## Objectives

1. Create fixture generator for semantic_index JSON
2. Create fixture generator for symbol_resolution JSON
3. Create fixture generator for call_graph JSON
4. Create unified CLI tool for fixture management
5. Add fixture validation utilities

## Sub-tasks

### 116.2.1: Create Fixture Generator for semantic_index

Build a script that:

- Discovers all code fixtures in `fixtures/{language}/code/`
- Runs `build_semantic_index` on each
- Serializes output to JSON according to schema from 116.1.2
- Writes to `fixtures/{language}/semantic_index/`

**Key features:**

- Preserves folder structure (code/classes/ → semantic_index/classes/)
- Generates deterministic output (stable sorting)
- Reports any parsing errors
- Supports filtering (e.g., only TypeScript, only classes/)

**Script location**: `packages/core/scripts/generate_semantic_index_fixtures.ts`

**Usage:**

```bash
npx tsx scripts/generate_semantic_index_fixtures.ts
npx tsx scripts/generate_semantic_index_fixtures.ts --language typescript
npx tsx scripts/generate_semantic_index_fixtures.ts --category classes
```

**Deliverables:**

- [ ] Generator script implemented
- [ ] Handles all 4 languages (typescript, python, rust, javascript)
- [ ] Proper error handling and reporting
- [ ] Deterministic JSON output (sorted keys, stable ordering)

### 116.2.2: Create Fixture Generator for symbol_resolution

Build a script that:

- Loads semantic_index JSON fixtures
- Runs `resolve_symbols` on each
- Serializes output to JSON according to schema from 116.1.3
- Writes to `fixtures/{language}/resolved_symbols/`

**Key features:**

- Uses semantic_index JSON as input (not code files)
- Validates that semantic_index fixture exists
- Reports resolution failures or warnings
- Supports dry-run mode

**Script location**: `packages/core/scripts/generate_symbol_resolution_fixtures.ts`

**Usage:**

```bash
npx tsx scripts/generate_symbol_resolution_fixtures.ts
npx tsx scripts/generate_symbol_resolution_fixtures.ts --dry-run
```

**Deliverables:**

- [ ] Generator script implemented
- [ ] Validates semantic_index fixtures exist
- [ ] Handles all 4 languages
- [ ] Clear error messages for resolution failures

### 116.2.3: Create Fixture Generator for call_graph

Build a script that:

- Loads resolved_symbols JSON fixtures
- Runs `detect_call_graph` on each
- Serializes output to JSON according to schema from 116.1.4
- Writes to `fixtures/{language}/call_graph/`

**Script location**: `packages/core/scripts/generate_call_graph_fixtures.ts`

**Usage:**

```bash
npx tsx scripts/generate_call_graph_fixtures.ts
```

**Deliverables:**

- [ ] Generator script implemented
- [ ] Validates resolved_symbols fixtures exist
- [ ] Handles all 4 languages
- [ ] Captures entry point detection correctly

### 116.2.4: Create Unified Fixture Regeneration CLI Tool

Create a single CLI tool that orchestrates all fixture generation:

**Script location**: `packages/core/scripts/manage_fixtures.ts`

**Commands:**

```bash
# Regenerate all fixtures for all stages
npx tsx scripts/manage_fixtures.ts generate --all

# Regenerate specific stage
npx tsx scripts/manage_fixtures.ts generate --stage semantic_index
npx tsx scripts/manage_fixtures.ts generate --stage symbol_resolution
npx tsx scripts/manage_fixtures.ts generate --stage call_graph

# Regenerate for specific language
npx tsx scripts/manage_fixtures.ts generate --all --language typescript

# Validate fixtures (check they're up-to-date)
npx tsx scripts/manage_fixtures.ts validate

# Show fixture coverage stats
npx tsx scripts/manage_fixtures.ts stats
```

**Features:**

- Runs generators in correct order (semantic_index → symbol_resolution → call_graph)
- Reports progress and statistics
- Dry-run mode for validation
- Git integration (detect fixture changes)

**Deliverables:**

- [ ] Unified CLI tool implemented
- [ ] All commands working
- [ ] Help documentation
- [ ] Progress reporting

### 116.2.5: Add Fixture Validation Utilities

Create utilities for validating fixtures:

1. **Schema validation**: Ensure JSON matches expected schema
2. **Consistency validation**: Check pipeline consistency (e.g., symbol_resolution references symbols from semantic_index)
3. **Coverage validation**: Report missing fixtures or gaps

**Location**: `packages/core/tests/fixtures/validation.ts`

**Functions:**

- `validate_semantic_index_fixture(json)`: Check schema compliance
- `validate_symbol_resolution_fixture(json, semantic_index_json)`: Check consistency
- `validate_call_graph_fixture(json, resolved_symbols_json)`: Check consistency
- `get_fixture_coverage()`: Report which fixtures exist

**Usage in tests:**

```typescript
import { validate_semantic_index_fixture } from "../fixtures/validation";

it("fixture should be valid", () => {
  const fixture = load_fixture(
    "typescript/classes/basic_class.semantic_index.json"
  );
  const validation = validate_semantic_index_fixture(fixture);
  expect(validation.valid).toBe(true);
});
```

**Deliverables:**

- [ ] Validation utilities implemented
- [ ] Schema validation for all three fixture types
- [ ] Consistency validation across pipeline stages
- [ ] Coverage reporting

## Additional Tooling Considerations

### Deterministic Output

All generators must produce **deterministic output** to avoid spurious diffs:

- Sort object keys alphabetically
- Sort arrays by stable criteria (e.g., by symbol ID, by location)
- Use consistent formatting (2-space indent, trailing newlines)

### Error Handling

Generators should:

- Never fail silently
- Report which fixtures failed and why
- Continue processing remaining fixtures after errors
- Exit with non-zero status if any fixtures failed

### Performance

For large fixture sets:

- Consider parallel generation (per-language or per-category)
- Cache parsed trees where possible
- Report timing information

## Acceptance Criteria

- [ ] All five sub-tasks completed (116.2.1 - 116.2.5)
- [ ] Can regenerate all fixtures with single command
- [ ] Fixtures are deterministic (running twice produces identical output)
- [ ] Validation catches schema violations
- [ ] Clear error messages for all failure modes
- [ ] Documentation for all CLI commands

## Estimated Effort

- **semantic_index generator**: 2 hours
- **symbol_resolution generator**: 1.5 hours
- **call_graph generator**: 1 hour
- **Unified CLI tool**: 2 hours
- **Validation utilities**: 1.5 hours
- **Testing & debugging**: 2 hours
- **Total**: ~10 hours

## Testing Strategy

- Test each generator on small code samples
- Verify deterministic output (run twice, compare)
- Test error cases (invalid code, missing dependencies)
- Validate generated JSON against schemas
- Test pipeline consistency (symbol_resolution uses semantic_index IDs)

## Notes

- Consider using commander.js or similar for CLI
- JSON formatting: use `JSON.stringify(obj, null, 2)`
- Git hooks: Could add pre-commit hook to validate fixtures
- Consider adding `--update` mode that updates existing fixtures only if they differ
