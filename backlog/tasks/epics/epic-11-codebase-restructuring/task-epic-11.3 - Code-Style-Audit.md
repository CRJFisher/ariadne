---
id: task-epic-11.3
title: Comprehensive Code Style Audit Against Coding Standards
status: To Do
assignee: []
created_date: "2025-08-07"
labels:
  - audit
  - code-quality
  - refactoring
dependencies:
  - task-epic-11.2
parent_task_id: task-epic-11-codebase-restructuring
---

## Description

Conduct a systematic audit of the entire Ariadne codebase to evaluate compliance with the coding standards defined in `rules/coding.md`. This audit will identify all areas where code deviates from functional programming principles, uses stateful classes, exceeds file size limits, or violates naming conventions.

## Motivation

Before restructuring, we need to understand:

- Current code quality baseline
- Technical debt locations
- Refactoring priorities
- Effort required for compliance

This audit will inform migration decisions and help prioritize which code needs immediate refactoring versus what can be migrated as-is.

## Acceptance Criteria

- [ ] Complete code style audit document created
- [ ] All violations of coding.md standards identified
- [ ] Severity levels assigned to each violation type
- [ ] Refactoring effort estimated for each violation
- [ ] Priority order for fixes established
- [ ] Automated audit script created for ongoing monitoring
- [ ] Baseline metrics established for tracking improvement

## Coding Standards to Audit

Based on `rules/coding.md`:

### 1. File Organization

- ❌ Files exceeding 32KB limit (tree-sitter parsing limit)
- ⚠️ Files between 20-32KB (approaching limit)
- ❌ Monolithic modules that should be split
- ❌ Poor directory organization

### 2. Functional Style

- ❌ Stateful classes (NEVER allowed)
- ❌ Classes used for non-data purposes
- ⚠️ Mutable data structures
- ⚠️ Side effects in pure functions
- ❌ Long functions with complex control flow
- ⚠️ Functions doing multiple unrelated things

### 3. Naming Conventions

- ❌ Non-snake_case variables/functions/files
- ❌ Non-PascalCase class names
- ⚠️ Inconsistent naming patterns
- ⚠️ Unclear or misleading names
- Public functions should always have functionality-oriented names. Internal functions can be more implmentation-oriented.

## Deliverables

### Primary Deliverable: Code Style Audit Report

Location: `backlog/tasks/epics/epic-11-codebase-restructuring/CODE_STYLE_AUDIT.md`

Structure:

```markdown
# Code Style Audit Report

## Executive Summary

- Total files audited: X
- Total violations: Y
- Critical violations: Z
- Estimated refactoring effort: N days

## File Size Violations

### Critical (>32KB)

| File             | Size | Functions | Recommendation     |
| ---------------- | ---- | --------- | ------------------ |
| src/huge_file.ts | 45KB | 120       | Split into 3 files |

### Warning (20-32KB)

[...]

## Functional Style Violations

### Stateful Classes (CRITICAL)

| File          | Class        | Usage                | Refactoring Strategy                        |
| ------------- | ------------ | -------------------- | ------------------------------------------- |
| src/bad.ts:45 | StateManager | Manages global state | Convert to pure functions + immutable store |

### Mutable Data

[...]

## Naming Convention Violations

[...]

## Priority Refactoring List

1. Critical file size issues (blocks parsing)
2. Stateful classes (violates core principle)
3. [...]
```

### Secondary Deliverables

1. **Violation Heat Map** (`backlog/tasks/epics/epic-11-codebase-restructuring/CODE_STYLE_HEATMAP.md`)

   - Visual representation of problem areas
   - Clustering of related violations
   - Dependencies between violations

2. **Refactoring Plan** (`backlog/tasks/epics/epic-11-codebase-restructuring/CODE_STYLE_REFACTORING.md`)

   - Step-by-step refactoring approach
   - Effort estimates per component
   - Risk assessment for each change

3. **Automated Audit Script** (`scripts/audit_code_style.ts`)
   - Reusable script for ongoing monitoring
   - CI/CD integration ready
   - Generates reports automatically

## Audit Methodology

### Phase 1: Automated Analysis

- File size checking
- AST analysis for class usage
- Pattern matching for naming conventions
- Complexity analysis for functions

### Phase 2: Manual Review

- Review flagged stateful classes
- Assess refactoring complexity
- Identify architectural anti-patterns
- Document edge cases

### Phase 3: Severity Assignment

- **Critical**: Blocks functionality or violates core principles
- **High**: Significant deviation from standards
- **Medium**: Minor violations with easy fixes
- **Low**: Style preferences

### Phase 4: Effort Estimation

- Simple rename: 5 minutes
- Function split: 30 minutes
- Class to function conversion: 2-4 hours
- Module restructuring: 1-2 days

## Metrics to Track

### Compliance Metrics

- % files under 32KB
- % files under 20KB (target)
- % pure functions vs total
- % immutable data structures
- % correct naming conventions

### Technical Debt Metrics

- Total violations by severity
- Estimated refactoring days
- Violation density per module
- Trend over time

## Tools and Scripts

```typescript
// scripts/audit_code_style.ts
interface AuditResult {
  file: string;
  violations: Violation[];
  metrics: FileMetrics;
}

interface Violation {
  type: "file_size" | "stateful_class" | "naming" | "complexity";
  severity: "critical" | "high" | "medium" | "low";
  line?: number;
  description: string;
  suggestion: string;
  estimatedEffort: string;
}
```

## Success Criteria

- 100% of source files audited
- All stateful classes identified
- All oversized files documented
- Refactoring effort quantified
- Baseline metrics established
- Automated monitoring in place

## Estimated Timeline

- Automated analysis setup: 0.5 days
- Phase 1 execution: 0.5 days
- Phase 2 manual review: 1 day
- Documentation: 0.5 days
- Script development: 0.5 days

**Total: 3 days**

## Implementation Notes

### High-Risk Areas (Expected Violations)

Based on preliminary review:

- `src/call_graph/` - Complex control flow, large files
- `src/languages/` - Mixed paradigms, some stateful patterns
- `src/services/` - Potential stateful service classes
- Test files - Often exceed size limits

### Quick Wins

- Naming convention fixes (automated)
- Simple file splits
- Obvious function extractions
- Dead code removal

### Complex Refactoring

- State management patterns
- Service class conversions
- Cross-cutting concerns
- Legacy compatibility layers
