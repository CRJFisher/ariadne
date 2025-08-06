# Backlog Post-Work Checklist

Complete these steps after finishing implementation work on any task.

## 1. Update Current Task

### Mark Acceptance Criteria
```bash
# View the task to check all ACs
backlog task <id> --plain
```
- Change all completed `- [ ]` to `- [x]` in the task file
- If any AC wasn't met, document why in Implementation Notes

### Add Implementation Notes
```bash
backlog task edit <id> --notes "Summary of implementation approach and key decisions"
```
Include:
- Approach taken and why
- Files modified or created
- Any deviations from original plan
- Test gaps discovered
- Performance considerations

### Set Status to Done
```bash
backlog task edit <id> -s Done
```

## 2. Archive Completed Tasks

```bash
# Archive the completed task
backlog task archive <id>
```

## 3. Update Project Status

### Review Dependencies
Check `backlog/task-dependencies.yaml`:
- Remove completed task from dependencies
- Update any dependent tasks that are now unblocked

### Update Work Priority
Update `backlog/WORK_PRIORITY.md`:
- Move next priority items up
- Add any new tasks discovered during work
- Note any blocked items

## 4. Handle Discovered Work

### For Small Issues (< 30 min)
- Fix immediately if within scope of current task
- Document the fix in Implementation Notes

### For Larger Issues
Create new task with full context:
```bash
backlog task create "Fix <issue>" -d "Discovered while working on task-X: detailed context" --ac "Clear success criteria"
```

### For Related Work
Create sub-task under current epic or task:
```bash
backlog task create -p <parent-id> "Related improvement" -d "Context from parent task"
```

## 5. Final Checks

Before moving to next task:
- [ ] All tests passing
- [ ] Linting/formatting clean
- [ ] Documentation updated if needed
- [ ] No TODO comments left uncommitted
- [ ] Git commits made with clear messages

## Quick Command Reference

```bash
# Complete task workflow
backlog task edit <id> --notes "Implementation summary"
backlog task edit <id> -s Done
backlog task archive <id>

# Check what's next
backlog task list -s "To Do" --plain
cat backlog/WORK_PRIORITY.md
```