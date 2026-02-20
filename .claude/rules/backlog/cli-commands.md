---
paths: backlog/**
---

# Backlog CLI Commands

## Task Commands

| Purpose              | Command                                                            |
|----------------------|--------------------------------------------------------------------|
| Create task          | `backlog task create "Add OAuth"`                                  |
| Create with desc     | `backlog task create "Feature" -d "Enables this feature"`          |
| Create with AC       | `backlog task create "Feature" --ac "Must work,Must be tested"`    |
| Create with deps     | `backlog task create "Feature" --dep task-1,task-2`                |
| Create sub task      | `backlog task create -p 14 "Add Google auth"`                      |
| List tasks           | `backlog task list --plain`                                        |
| List by status       | `backlog task list -s "To Do" --plain`                             |
| View detail          | `backlog task 7 --plain`                                           |
| Edit task            | `backlog task edit 7 -a @{yourself} -l auth,backend`               |
| Add plan             | `backlog task edit 7 --plan "Implementation approach"`             |
| Add AC               | `backlog task edit 7 --ac "New criterion,Another one"`             |
| Add deps             | `backlog task edit 7 --dep task-1,task-2`                          |
| Add notes            | `backlog task edit 7 --notes "Added this feature because..."`      |
| Append notes         | `backlog task edit 7 --append-notes "Additional notes"`            |
| Mark as done         | `backlog task edit 7 -s "Done"`                                    |
| Archive              | `backlog task archive 7`                                           |

## Draft Commands

| Purpose              | Command                                    |
|----------------------|--------------------------------------------|
| Create draft         | `backlog draft create "Spike GraphQL"`     |
| List drafts          | `backlog draft list --plain`               |
| Promote to task      | `backlog draft promote 3.1`                |
| Demote task to draft | `backlog task demote <task-id>`            |

## Documentation Commands

| Purpose              | Command                                    |
|----------------------|--------------------------------------------|
| Create doc           | `backlog doc create "Title"`               |
| List docs            | `backlog doc list`                         |
| View doc             | `backlog doc view <id>`                    |

## Decision Commands

| Purpose              | Command                                    |
|----------------------|--------------------------------------------|
| Create decision      | `backlog decision create "Title"`          |

## Other Commands

| Purpose              | Command                                    |
|----------------------|--------------------------------------------|
| Search               | `backlog search "query" --plain`           |
| Project overview     | `backlog overview`                         |
| Kanban board         | `backlog board`                            |
| Web interface        | `backlog browser`                          |
| Export board         | `backlog board export [file]`              |
| Archive completed    | `backlog cleanup`                          |

## AI Agent Tips

- **Always use `--plain` flag** for AI-friendly text output
- When users mention "create a task", use the Backlog.md CLI
- Read task files before implementation
- Update task status as you work
- Use `--append-notes` to add to existing notes without overwriting
