# File Naming Conventions

This document defines the file and folder naming conventions for the Ariadne codebase and the strategy for enforcing them via Claude Code hooks.

## Standard Naming Patterns

### Folder-Module Naming Rule

**The folder name defines the main module name.** Every directory containing implementation code has a main module file that matches the folder name.

```text
{folder}/
  {folder}.ts                              # Main implementation (required)
  {folder}.test.ts                         # Unit tests for main module
  {folder}.{language}.ts                   # Language-specific variant
  {folder}.{language}.test.ts              # Language-specific tests
  {folder}.{language}.{submodule}.ts       # Language-specific sub-split
  {folder}.integration.test.ts             # Integration tests
  {folder}.{language}.integration.test.ts  # Language-specific integration tests
  index.ts                                 # Barrel file for re-exports (optional)
  helper_module.ts                         # Helper modules can have different names
```

**Examples:**

```text
project/
  project.ts                               # Main implementation ✓
  project.test.ts                          # Unit tests
  project.typescript.integration.test.ts   # Language-specific integration test
  import_graph.ts                          # Helper module

capture_handlers/
  capture_handlers.typescript.ts           # Language-specific variant
  capture_handlers.rust.ts                 # Language-specific variant
  capture_handlers.rust.methods.ts         # Language + sub-split
  capture_handlers.types.ts                # Sub-module for types
```

### Source Files

| Category | Pattern | Examples |
|----------|---------|----------|
| Main module | `{folder}.ts` | `project.ts` in `project/`, `trace_call_graph.ts` in `trace_call_graph/` |
| Test files | `{folder}.test.ts` | `project.test.ts`, `trace_call_graph.test.ts` |
| Integration tests | `{folder}.integration.test.ts` | `project.integration.test.ts` |
| Language-specific | `{folder}.{language}.ts` | `capture_handlers.typescript.ts` |
| Language-specific tests | `{folder}.{language}.test.ts` | `project.typescript.test.ts` |
| Language integration tests | `{folder}.{language}.integration.test.ts` | `project.python.integration.test.ts` |
| Language + sub-split | `{folder}.{language}.{submodule}.ts` | `capture_handlers.rust.methods.ts` |
| Benchmark tests | `{folder}.bench.test.ts` | `project.bench.test.ts` |

### Directories

| Category | Pattern | Examples |
|----------|---------|----------|
| Source directories | `snake_case` | `index_single_file`, `resolve_references`, `trace_call_graph` |
| Language configs | `language_configs` | Contains `{language}_config.ts` files |

### Configuration Files

| Category | Pattern | Location |
|----------|---------|----------|
| Package config | `package.json` | Root and each package |
| TypeScript config | `tsconfig.json` | Root and each package |
| Test TypeScript config | `tsconfig.test.json` | Each package |
| ESLint config | `eslint.config.js` | Root only |

### Scripts (Legitimate)

| Category | Pattern | Location |
|----------|---------|----------|
| Package scripts | `snake_case.ts` | `packages/*/scripts/` |
| Project scripts | `snake_case.ts` | `scripts/` |
| Shell scripts | `snake-case.sh` | `scripts/` or package `scripts/` |

### Documentation

| Category | Pattern | Location |
|----------|---------|----------|
| Root docs | `UPPER_CASE.md` | Root (`README.md`, `CLAUDE.md`, `CONTRIBUTING.md`) |
| Backlog docs | `kebab-case.md` or `UPPER_CASE.md` | `backlog/docs/` |

## Prohibited File Patterns

These patterns indicate debug/temporary files that should not exist in the codebase:

### Debug Scripts (Root Level)

Files matching these patterns in the root directory are prohibited:

```
debug_*.ts        # Debug TypeScript scripts
debug_*.js        # Debug JavaScript scripts
test_*.ts         # Ad-hoc test scripts (not in test structure)
test_*.js         # Ad-hoc JavaScript test scripts
verify_*.ts       # One-off verification scripts
*_report.md       # Analysis report files
*_analysis.md     # Analysis documentation
```

### One-off Scripts (Root Level)

```
*.py              # Python scripts (should be in scripts/ or removed)
*.sed             # Sed scripts (one-time use)
fix_*.sh          # One-off fix scripts
```

### Stray JavaScript Files

```
packages/*/*.js   # JavaScript files in package roots (not in src/)
*.cjs             # CommonJS files outside .claude/hooks/
```

### Build/Test Artifacts

```
*.log             # Log files
test-output*.log  # Test output logs
```

## Allowed Exceptions

These patterns are explicitly allowed despite appearing unusual:

### Hook Scripts

```
.claude/hooks/*.cjs   # Claude Code hook scripts (CommonJS required)
```

### Generated Files

```
dist/                 # Build output (gitignored)
node_modules/         # Dependencies (gitignored)
```

### Tree-sitter Queries

```
packages/core/src/index_single_file/query_code_tree/*.scm   # Query files
```

### Language-Specific Extractors

Directories containing distinct language-specific implementations use prefix naming (`{language}_{module}.ts`) instead of suffix naming (`{module}.{language}.ts`):

```
packages/core/src/index_single_file/scopes/extractors/
  python_scope_boundary_extractor.ts       # Python extractor
  typescript_scope_boundary_extractor.ts   # TypeScript extractor
  javascript_scope_boundary_extractor.ts   # JavaScript extractor
  rust_scope_boundary_extractor.ts         # Rust extractor
  javascript_typescript_scope_boundary_extractor.ts  # Shared base
```

**Rationale**: These are distinct implementations sharing a common interface, not variants of a base module. The prefix pattern groups them by language while the directory name (`extractors/`) indicates their role.

## Current Violations (To Clean Up)

### Root Directory Debug Files

| File | Status | Action |
|------|--------|--------|
| `debug_anonymous_calls.ts` | Stale | Delete |
| `debug_anonymous_scope_attribution.ts` | Stale | Delete |
| `test_anonymous_scope_simple.ts` | Stale | Delete |
| `test_property_chain.js` | Stale | Delete |
| `verify_entry_point_reduction.ts` | Stale | Delete |
| `add_visibility.js` | Stale | Delete |
| `validate_captures.js` | Stale | Delete |

### Root Directory Scripts

| File | Status | Action |
|------|--------|--------|
| `cleanup_original_tasks.py` | Stale | Delete |
| `create_subtasks.py` | Stale | Delete |
| `remove_prerequisites.py` | Stale | Delete |
| `fix_capture_names.sed` | Stale | Delete |
| `fix_capture_names_in_strings.sed` | Stale | Delete |
| `extract_captures.sh` | Stale | Delete |
| `verify_handlers.sh` | Stale | Delete |
| `fix_naming_conventions.sh` | Stale | Delete |
| `fix_bespoke_naming.sh` | Stale | Delete |

### Root Directory Reports

| File | Status | Action |
|------|--------|--------|
| `ANSWER-HOW-TESTS-WERE-FIXED.md` | Stale | Delete |
| `BUILDER_AUDIT.md` | Stale | Delete |
| `CAPTURE_NAME_FIXES_SUMMARY.md` | Stale | Delete |
| `capture_name_mapping_guide.md` | Stale | Delete |
| `function_signature_violations_report.md` | Stale | Delete |
| `map_symbolid_analysis.md` | Stale | Delete |
| `stub_validation_report.md` | Stale | Delete |
| `symbolid_comprehensive_survey.md` | Stale | Delete |
| `symbolid_survey_report.md` | Stale | Delete |
| `test_regression_report.md` | Stale | Delete |
| (other `*_report.md`, `*_analysis.md`) | Stale | Delete |

### Root Directory Logs

| File | Status | Action |
|------|--------|--------|
| `test-output.log` | Artifact | Delete |
| `test-output-rust.log` | Artifact | Delete |
| `test-output-rust-new.log` | Artifact | Delete |
| `test-output-full.log` | Artifact | Delete |
| `full-test-output.log` | Artifact | Delete |

### Package Directory Violations

| File | Status | Action |
|------|--------|--------|
| `packages/core/fix_test_paths.js` | Stale | Delete |
| `packages/core/test_constructor.js` | Stale | Delete |

## Hook Enforcement Strategy

### Phase 1: Pre-Tool Hook (File Creation Prevention)

Add validation to the `PreToolUse` hook for `Write` and `Edit` tools:

```javascript
// Blocked patterns for new file creation
const BLOCKED_PATTERNS = [
  // Root directory debug files
  /^debug_.*\.(ts|js)$/,
  /^test_.*\.(ts|js)$/,
  /^verify_.*\.ts$/,

  // Root directory scripts (Python, sed, shell outside scripts/)
  /^.*\.py$/,
  /^.*\.sed$/,
  /^fix_.*\.sh$/,

  // Stray JavaScript in packages
  /^packages\/[^/]+\/[^/]+\.js$/,

  // Report/analysis files in root
  /^.*_report\.md$/,
  /^.*_analysis\.md$/,

  // Log files
  /^.*\.log$/,
];

// Allowed exceptions
const ALLOWED_PATTERNS = [
  /^\.claude\/hooks\/.*\.cjs$/,
  /^scripts\/.*\.(ts|sh)$/,
  /^packages\/.*\/scripts\/.*\.ts$/,
];
```

### Phase 2: Stop Hook (Existing File Audit)

Extend the `Stop` hook to scan for prohibited files:

```javascript
function audit_prohibited_files(project_dir) {
  const violations = [];

  // Check root directory
  const root_files = fs.readdirSync(project_dir);
  for (const file of root_files) {
    if (is_prohibited_pattern(file)) {
      violations.push(`Prohibited file in root: ${file}`);
    }
  }

  // Check package directories
  const packages = ['packages/core', 'packages/types', 'packages/mcp'];
  for (const pkg of packages) {
    const pkg_files = fs.readdirSync(path.join(project_dir, pkg));
    for (const file of pkg_files) {
      if (file.endsWith('.js') && !file.startsWith('eslint')) {
        violations.push(`Stray JS file in ${pkg}: ${file}`);
      }
    }
  }

  return violations;
}
```

### Phase 3: Test File Naming Validation

Ensure test files follow the naming convention:

```javascript
const TEST_FILE_PATTERNS = [
  /^[a-z][a-z0-9_]*\.test\.ts$/,                          // Basic test
  /^[a-z][a-z0-9_]*\.integration\.test\.ts$/,             // Integration test
  /^[a-z][a-z0-9_]*\.(typescript|javascript|python|rust)\.test\.ts$/,  // Language test
  /^[a-z][a-z0-9_]*\.(typescript|javascript|python|rust)\.integration\.test\.ts$/,  // Language integration
  /^[a-z][a-z0-9_]*\.bench\.test\.ts$/,                   // Benchmark test
];
```

## Implementation Priority

1. **Immediate**: Delete all identified stale files manually
2. **Short-term**: Add `PreToolUse` hook to prevent creating new prohibited files
3. **Medium-term**: Add `Stop` hook audit to catch any violations before task completion
4. **Ongoing**: Refine patterns based on false positives/negatives

## Open Questions

1. Should we allow `*.cjs` files outside `.claude/hooks/`?
2. Should root-level shell scripts (`extract_captures.sh`, etc.) be moved to `scripts/`?
3. Should we enforce that ALL `.md` files in root are UPPER_CASE?
