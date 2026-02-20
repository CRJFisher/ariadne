# Task 11.161.3: Delete Stale Debug Files

## Status: Completed

## Parent: Task 11.161

## Goal

Remove stale debug scripts, one-off utilities, and temporary files from the repository.

## Subtasks

### 11.161.3.1: Delete Root Debug Scripts

Remove from root directory:

- [x] `debug_anonymous_calls.ts`
- [x] `debug_anonymous_scope_attribution.ts`
- [x] `test_anonymous_scope_simple.ts`
- [x] `test_property_chain.js`
- [x] `verify_entry_point_reduction.ts`
- [x] `add_visibility.js`
- [x] `validate_captures.js`

### 11.161.3.2: Delete Root One-off Scripts

Remove from root directory:

- [x] `cleanup_original_tasks.py`
- [x] `create_subtasks.py`
- [x] `remove_prerequisites.py`
- [x] `fix_capture_names.sed`
- [x] `fix_capture_names_in_strings.sed`
- [x] `extract_captures.sh`
- [x] `verify_handlers.sh`
- [x] `fix_naming_conventions.sh`
- [x] `fix_bespoke_naming.sh`

### 11.161.3.3: Delete Root Report Files

Remove all matching patterns from root:

- [x] `*_report.md`
- [x] `*_analysis.md`
- [x] `TASK*.md` (excluding actual docs)
- [x] `*SUMMARY*.md`
- [x] `*VERIFICATION*.md`
- [x] `*AUDIT*.md`

Specific files to delete:

- `ANSWER-HOW-TESTS-WERE-FIXED.md`
- `BUILDER_AUDIT.md`
- `CAPTURE_NAME_FIXES_SUMMARY.md`
- `COMPREHENSIVE_TEST_RESULTS.md`
- `EXTENDED_BUILDER_AUDIT.md`
- `FULL_TEST_SUITE_VERIFICATION.md`
- `HANDLER_VERIFICATION.md`
- `METADATA_COVERAGE_FINAL_REPORT.md`
- `OPTIMIZATION_ANALYSIS.md`
- `PYTHON_QUERY_VERIFICATION_REPORT.md`
- `PYTHON_TEST_VERIFICATION.md`
- `QUERY_PATTERNS_REFERENCE.md`
- `REFERENCE_METADATA_PLAN.md`
- `RUST_TEST_COVERAGE_ANALYSIS.md`
- `RUST_TEST_REGRESSION_ANALYSIS.md`
- `SESSION-FINAL-SUMMARY.md`
- `SymbolId_Comprehensive_Adoption_Report.md`
- `TEST_MIGRATION_STATUS.md`
- `TEST_REGRESSION_ANALYSIS.md`
- `TEST_RESULTS.md`
- `TYPESCRIPT_COMPILATION_VERIFICATION.md`
- `TYPE_SYSTEM_ANALYSIS.md`
- `capture_name_mapping_guide.md`
- `function_signature_violations_report.md`
- `map_symbolid_analysis.md`
- `migrate_tests.md`
- `stub_validation_report.md`
- `symbolid_comprehensive_survey.md`
- `symbolid_survey_report.md`
- `test_regression_report.md`
- And any `TASK-*.md`, `TASK_*.md` files

### 11.161.3.4: Delete Log Files and Package Violations

Log files:

- [x] `test-output.log`
- [x] `test-output-rust.log`
- [x] `test-output-rust-new.log`
- [x] `test-output-full.log`
- [x] `full-test-output.log`

Package violations:

- [x] `packages/core/fix_test_paths.js`
- [x] `packages/core/test_constructor.js`

Other:

- [x] `CLAUDE.md.backup.pre-treesitter-transformation`
- [x] `.mcp.json.disabled`

## Additional Files Deleted

The following file was identified as stale during implementation (not in original list):

- `METADATA_EXTRACTORS_GUIDE.md` - outdated documentation that no longer matches the current `MetadataExtractors` interface

## Verification

Before deletion, verified files are truly stale:

1. Checked git log for last modification dates
2. Grepped for any imports/references
3. Confirmed no active use

## Commit Strategy

Single commit: `chore: Remove stale debug scripts, reports, and temporary files`

## Success Criteria

1. All identified files deleted
2. No breaking references
3. Repository cleaner and more navigable
