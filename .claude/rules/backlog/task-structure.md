---
paths: backlog/**
---

# Task Structure and Conventions

## Source of Truth

- Tasks live under `backlog/tasks/` (drafts under `backlog/drafts/`)
- Every implementation decision starts with reading the corresponding task file
- Project documentation is in `backlog/docs/`
- Project decisions are in `backlog/decisions/`

## Task File Naming

Tasks are stored as Markdown files with format: `task-<id> - <title>.md`

Example: `task-42 - Add GraphQL resolver.md`

## Task Hierarchy

Tasks support unlimited nesting with parent-child relationships:

- **Parent tasks**: High-level features or epics
- **Sub-tasks**: Breakdowns of parent tasks (created with `-p <parent-id>`)
- **Sub-sub-tasks**: Further breakdowns as needed

Task IDs reflect hierarchy: `task-42`, `task-42.1`, `task-42.1.1`, etc.

```bash
# Create a sub-task under task-42
backlog task create "Implement auth middleware" -p 42

# Create a sub-sub-task under task-42.1
backlog task create "Add JWT validation" -p 42.1
```

Use hierarchical tasks to break complex work into manageable pieces while maintaining clear relationships.

## Task Anatomy

```markdown
# task-42 - Add GraphQL resolver

## Description (the why)

Short, imperative explanation of the goal and why it is needed. No implementation details.

## Acceptance Criteria (the what)

- [ ] Resolver returns correct data for happy path
- [ ] Error response matches REST
- [ ] P95 latency ≤ 50 ms under 100 RPS

## Implementation Plan (the how)

1. Research existing patterns
2. Implement with error handling
3. Add performance monitoring
4. Write tests
5. Benchmark performance

## Implementation Notes (added after working on the task)

- Approach taken
- Features implemented or modified
- Technical decisions and trade-offs
- Modified or added files
```

## Section Guidelines

### Title

Use a clear brief title that summarizes the task.

### Description (the "why")

- Concise summary of task purpose and goal
- No implementation details
- Explains context and motivation
- Avoid code snippets

### Acceptance Criteria (the "what")

Focus on **outcomes, behaviors, and verifiable requirements**, not implementation steps.

**Principles:**
- **Outcome-Oriented**: Focus on results, not methods
- **Testable**: Each criterion can be objectively verified
- **Clear**: Unambiguous language
- **Complete**: Collectively cover the task scope
- **User-Focused**: Frame from end-user or system behavior perspective

**Good examples:**
- `- [ ] User can successfully log in with valid credentials`
- `- [ ] System processes 1000 requests per second without errors`

**Bad examples (implementation steps):**
- `- [ ] Add a new function handleLogin() in auth.ts`

### Implementation Plan (the "how")

- Outline steps to achieve the task
- Add **only after putting task in progress** and before starting work
- May change during implementation

### Implementation Notes

- Document approach, decisions, challenges, and deviations
- Add **after completing work** on the task
- Keep concise but informative

## Task Requirements

- Tasks must be **atomic** and **testable**
- Each task represents a single unit of work completable in a single PR
- **Never** reference future tasks (only reference tasks with id < current id)
- Ensure tasks are **independent** - don't depend on tasks not yet created
- Break large tasks into sub-tasks for manageability

**Wrong task splitting:**
1. "Add API endpoint for user data"
2. "Define the user model and DB schema"

**Correct task splitting:**
1. "Add system for handling API requests"
2. "Add user model and DB schema"
3. "Add API endpoint for user data"
