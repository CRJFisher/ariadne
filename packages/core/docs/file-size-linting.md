# File Size Linting

Ariadne uses tree-sitter for parsing, which has a hard limit of 32KB per file. To ensure all files can be properly analyzed, we've implemented file size checking throughout the development workflow.

## Thresholds

- **Warning**: 28KB - Files approaching the limit
- **Error**: 32KB - Files that exceed tree-sitter's limit and will cause parsing failures

## Usage

### Manual Check

Run the file size check manually:

```bash
cd packages/core
npm run check:size
```

This will:
- Scan all TypeScript and JavaScript files
- Report files approaching or exceeding the limit
- Show the top 5 largest files
- Provide refactoring suggestions for problematic files

### Pre-commit Hook

A git pre-commit hook automatically runs the file size check before each commit. If any files exceed 32KB, the commit will be blocked.

### CI/CD Pipeline

File size checking is integrated into the GitHub Actions workflow and runs on every push and pull request.

### Validation Script

The agent validation script (`validate-ariadne.ts`) automatically skips files over 32KB to prevent parsing failures.

## Refactoring Large Files

When a file exceeds the limit, consider these refactoring strategies:

### For Test Files
- Split into focused test suites by feature
- Extract common test utilities into separate files
- Group related tests into separate files

### For Implementation Files
- Extract related functionality into separate modules
- Use barrel exports to maintain the same public API
- Split large classes into smaller, focused classes
- Extract utility functions into separate files

### Specific Patterns

**project_call_graph.ts** (60KB+)
- Split into: traversal logic, graph building, analysis functions
- Extract type definitions to separate file
- Move utility functions to dedicated modules

**Large test files**
- Group by functionality (e.g., `function-tests.ts`, `class-tests.ts`)
- Extract test fixtures and helpers
- Split integration tests from unit tests

## Adding Exclusions

If you need to exclude certain files from the check (e.g., generated files), update the `ignore` array in `scripts/check-file-sizes.ts`.

## Monitoring File Growth

Run `npm run check:size:warn` to see all files approaching the limit, even if none exceed it. This helps identify files that may need refactoring soon.