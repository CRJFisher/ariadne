# Task 105.1: Audit Type Structure Usage

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1 hour
**Parent:** task-epic-11.105

## Objective

Document concrete usage patterns of all 4 type structures to provide evidence for deletion decisions. Create audit report showing production vs test usage.

## Scope

Analyze usage of:
1. `local_types: LocalTypeInfo[]`
2. `local_type_annotations: LocalTypeAnnotation[]`
3. `local_type_tracking: LocalTypeTracking`
4. `local_type_flow: LocalTypeFlowData`

## Tasks

### 1. Production Code Analysis (30 min)

Run grep analysis for each structure:

```bash
# Find all usage in production code (exclude tests)
grep -r "local_types\b" packages/core/src --include="*.ts" | grep -v test | grep -v spec

grep -r "local_type_annotations" packages/core/src --include="*.ts" | grep -v test | grep -v spec

grep -r "local_type_tracking" packages/core/src --include="*.ts" | grep -v test | grep -v spec

grep -r "local_type_flow" packages/core/src --include="*.ts" | grep -v test | grep -v spec
```

For each usage found:
- Note file path and line number
- Classify as: read, write, or pass-through
- Note what specific fields are accessed

### 2. Test Code Analysis (15 min)

Same grep analysis but only in test files:

```bash
grep -r "local_types\b" packages/core/src --include="*.test.ts"
grep -r "local_types\b" packages/core/src --include="*.spec.ts"
# Repeat for other structures
```

### 3. Create Audit Report (15 min)

Create `AUDIT-type-structures-usage.md` with format:

```markdown
# Type Structure Usage Audit

## Summary
- local_types: X production uses, Y test uses
- local_type_annotations: X production uses, Y test uses
- local_type_tracking: X production uses, Y test uses
- local_type_flow: X production uses, Y test uses

## Detailed Findings

### local_types
**Production usage:**
- File: path/to/file.ts:123
  - Access: local_types.find(...)
  - Purpose: [brief description]

**Test usage:**
- File: path/to/test.ts:456
  - Purpose: [brief description]

### [Repeat for each structure]

## Conclusions

[Which structures are unused, partially used, or heavily used]
```

## Deliverables

- [ ] `AUDIT-type-structures-usage.md` created
- [ ] Usage patterns documented with line numbers
- [ ] Clear recommendations for each structure

## Validation

Report should answer:
- ✅ Is this structure used in production method resolution?
- ✅ What percentage of usage is in tests vs production?
- ✅ Can we remove it safely?

## Next Steps

Based on audit results, proceed with:
- Task 105.2: Remove local_types (if unused)
- Task 105.3: Remove local_type_tracking (if unused)
- Task 105.4: Remove unused type_flow fields
