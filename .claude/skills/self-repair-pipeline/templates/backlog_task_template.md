# Backlog Task Template for Auto-Generated Fix Tasks

## Title Format

`Fix {root-cause-description}` — imperative voice, under 70 characters.

Examples:

- `Fix missing indirect call resolution for re-exported functions`
- `Fix unresolved method calls through destructured imports`

## Description Sections

### Description

One-paragraph summary of the detection gap. State what false positives occur and why.

### Reproduction

```
File: {file_path}
Function: {function_name} (line {line})
Expected: Not reported as entry point (called via {call_mechanism})
Actual: Reported as unreachable entry point
```

Include a minimal code example demonstrating the pattern.

### Root Cause

Identify the pipeline stage and specific code path:

- **Pipeline stage**: `index_single_file` | `resolve_references` | `trace_call_graph`
- **Module**: `{module_path}`
- **Code path**: Description of the specific logic gap

### Fix Approach

From synthesis + reviewer feedback:

1. Files to modify (with specific functions)
2. Logic changes (pseudocode or description)
3. Test fixtures to add

### Review Notes

Key findings from each review angle:

- **info-architecture**: {findings}
- **simplicity**: {findings}
- **fundamentality**: {findings}
- **language-coverage**: {findings}

## Acceptance Criteria Format

Outcome-oriented, testable criteria:

- `The pattern {pattern_description} is resolved correctly`
- `Test fixture added for {language}: {fixture_description}`
- `No regression in existing test suite`
- `Coverage for all affected languages: {language_list}`

## Labels

`bug`, `{pipeline-stage}`, `auto-generated`

## Parent Task

task-190

## CLI Command

```bash
backlog task create "Fix {root-cause-description}" \
  -d "{description}" \
  --ac "{criterion_1},{criterion_2},{criterion_3}" \
  -p 190
```
