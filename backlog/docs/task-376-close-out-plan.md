# TASK-376 close-out — run plan

The order below is the author's, verbatim:

> Run TASK-376.24, TASK-376.21, TASK-376.22 and TASK-398 together.
> Then run TASK-376.27 and TASK-397 together. By then TASK-376.21 has landed, and these two touch different files.
> Finally, do the TASK-376 close-out measurement and tick the remaining criteria.

Each step is specified by its own task document under `backlog/tasks/`; the rules every TASK-376 step follows are the parent's `### Rules for every step`.

## Model

All steps should use sonnet 5.5: pin every session to the `claude-sonnet-5-5` model.

## Bounds

- TASK-376.21 and TASK-376.22: give each session at most 90 minutes and spend at most sixty dollars on it.
- TASK-376.24 and TASK-376.27: give each session at most 150 minutes and spend at most 150 dollars on it.
- TASK-397 and TASK-398: give each session four hours and spend at most 150 dollars on it.
- The close-out: give its session six hours and spend at most 150 dollars on it.

## The close-out's assertion

The close-out passes only when no acceptance criterion of TASK-376 is left unticked and the suite is green; a criterion that is honestly unmet fails the step rather than being ticked:

`test -f "backlog/tasks/task-376 - Record-the-five-type-facts-once-and-resolve-members-over-a-single-lookup-ladder.md" && ! grep -q '^- \[ \] #' "backlog/tasks/task-376 - Record-the-five-type-facts-once-and-resolve-members-over-a-single-lookup-ladder.md" && cd packages/core && npx tsc --noEmit && npx vitest run`
