---
paths: backlog/**
---

# Backlog Workflow

## Standard Workflow

```bash
# 1. Identify work
backlog task list -s "To Do" --plain

# 2. Read details and documentation
backlog task 42 --plain
# Also read relevant files in backlog/docs/ and backlog/decisions/

# 3. Start work: set status to In Progress
backlog task edit 42 -s "In Progress"

# 4. Add implementation plan before starting
backlog task edit 42 --plan "1. Analyze current implementation\n2. Identify bottlenecks\n3. Refactor in phases"

# 5. Break work down if needed
backlog task create "Refactor DB layer" -p 42 -d "Description" --ac "Tests pass,Performance improved"

# 6. Complete and mark Done
backlog task edit 42 -s Done --notes "Implemented with error handling and monitoring"
```

## Definition of Done (DoD)

A task is **Done** only when ALL of the following are complete:

1. **Acceptance criteria** fully checked (all `- [ ]` changed to `- [x]`)
2. **Implementation plan** followed or deviations documented
3. **Automated tests** (unit + integration) cover new logic
4. **Static analysis**: linter and formatter succeed
5. **Documentation**: Relevant docs updated, task has `## Implementation Notes` section
6. **Review**: Self-review completed
7. **Task hygiene**: Status set to Done via CLI
8. **No regressions**: All checks green

## Final Steps Before Marking Done

1. Mark all acceptance criteria as completed (`- [ ]` to `- [x]`)
2. Add `## Implementation Notes` section documenting approach
3. Run all tests and linting checks
4. Update relevant documentation

## Important Guidelines

- **Do not implement anything that deviates from Acceptance Criteria**
- If additional work is needed, update AC first or create a new task
- Always use `--plain` flag for AI-friendly output
- Read the task file before starting implementation
- Create sub-tasks for follow-up work
- Document test gaps in implementation notes
