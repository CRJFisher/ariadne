# Task Epic 11.154.8: Final Integration and Documentation

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Low
**Time Estimate**: 2 days

---

## Objective

Complete integration, update reference builder, run final validation, and document the new capture system.

---

## Deliverables

### 1. Update Reference Builder (0.5 day)

**File**: `packages/core/src/index_single_file/references/reference_builder.ts`

**Changes:**

- Remove need for parent context checking (queries are now clean)
- Simplify `determine_reference_kind()` logic
- Add comments explaining new capture strategy
- Ensure `extract_call_name()` is always used for method names

**Note**: This is now SIMPLER than original Option A because we fixed the source.

### 2. Run Full Test Suite (0.5 day)

```bash
# All language tests
npm test

# Specific test suites
npm test -- typescript.test
npm test -- javascript.test
npm test -- python.test
npm test -- rust.test

# Integration tests
npm test -- project.test
npm test -- call_graph.test
```

**Must pass:**

- All semantic index tests
- All reference resolution tests
- Call graph detection tests

### 3. Verify Entry Point Detection (0.5 day)

Re-run the analysis that found the original bug:

```bash
npx tsx top-level-nodes-analysis/triage_false_negative_entrypoints.ts
```

**Expected results:**

- `api_missing_from_detection.json` should be empty or greatly reduced
- All 4 Project methods detected as entry points:
  - `Project.update_file`
  - `Project.remove_file`
  - `Project.get_dependents`
  - `Project.clear`

### 4. Final Validation (0.25 day)

```bash
# Validate all languages - must pass
npm run validate:captures

# Should report:
# ✅ TypeScript: 0 errors
# ✅ JavaScript: 0 errors
# ✅ Python: 0 errors
# ✅ Rust: 0 errors
```

### 5. Update Documentation (0.25 day)

**Update files:**

- `README.md` - Mention capture validation
- `CONTRIBUTING.md` - Add section on query file guidelines
- `packages/core/README.md` - Link to CAPTURE-SCHEMA.md

**Example addition to CONTRIBUTING.md:**

```markdown
## Query File Guidelines

When modifying tree-sitter query files (`.scm`):

1. **Follow the capture schema**: See `packages/core/docs/CAPTURE-SCHEMA.md`
2. **Validate changes**: Run `npm run validate:captures` before committing
3. **Test thoroughly**: Ensure semantic index tests pass for affected language
4. **One capture per construct**: Avoid duplicate captures for the same syntactic element

The canonical schema is defined in `packages/core/src/index_single_file/query_code_tree/capture_schema.ts` and enforced via CI.
```

---

## Acceptance Criteria

- [ ] Reference builder simplified (no parent context checking needed)
- [ ] All test suites pass (TypeScript, JavaScript, Python, Rust)
- [ ] Entry point detection fixed (all 4 Project methods detected)
- [ ] Validation passes for all languages with 0 errors
- [ ] CI successfully validates on test commit
- [ ] Documentation updated with capture guidelines
- [ ] No regressions in call graph detection
- [ ] Performance is same or better (fewer captures to process)

---

## Success Metrics

### Primary Goals Achieved

- ✅ Bug fixed: Entry points detected correctly
- ✅ Root cause addressed: No duplicate captures
- ✅ Prevention: Validation in CI stops future issues
- ✅ Maintainability: Clear schema for adding languages

### Quality Metrics

- Zero validation errors across all languages
- 100% entry point detection accuracy for Project API
- All existing tests still pass
- No performance regression

---

## Dependencies

- Tasks 11.154.4-7 (all query files must be fixed first)

---

## Time Breakdown

- **Update reference builder**: 0.5 day
- **Run full test suite**: 0.5 day
- **Verify entry point detection**: 0.5 day
- **Final validation**: 0.25 day
- **Update documentation**: 0.25 day

**Total: 2 days**

---

## Completion Checklist

### Code Changes

- [ ] Reference builder simplified
- [ ] All query files conform to schema
- [ ] Validation passes

### Testing

- [ ] TypeScript tests pass
- [ ] JavaScript tests pass
- [ ] Python tests pass
- [ ] Rust tests pass
- [ ] Integration tests pass
- [ ] Entry point analysis shows fix

### CI/CD

- [ ] Validation runs in CI
- [ ] PR checks include capture validation
- [ ] Failing validation blocks merge

### Documentation

- [ ] CAPTURE-SCHEMA.md complete
- [ ] capture_schema.ts fully commented
- [ ] CONTRIBUTING.md updated
- [ ] README.md mentions validation

### Cleanup

- [ ] Remove any debug code
- [ ] Remove old/unused captures
- [ ] Ensure consistent formatting

---

## Final Deliverable

A complete, validated capture system that:

1. **Fixes the immediate bug** - Entry points detected correctly
2. **Prevents future bugs** - Schema enforced in CI
3. **Improves maintainability** - Clear rules for all languages
4. **Enables growth** - Easy to add new languages

---

## Post-Task: Update Parent Task

Update main task 11.154 with:

- Mark all subtasks as complete
- Document total time taken
- Note any deviations from plan
- List lessons learned
