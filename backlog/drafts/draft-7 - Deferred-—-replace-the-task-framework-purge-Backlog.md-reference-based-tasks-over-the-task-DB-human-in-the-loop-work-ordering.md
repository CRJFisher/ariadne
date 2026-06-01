---
id: DRAFT-7
title: >-
  Deferred — replace the task framework: purge Backlog.md, reference-based tasks
  over the task-DB, human-in-the-loop work ordering
status: Draft
assignee: []
created_date: '2026-06-01 15:41'
labels:
  - self-repair
  - deferred
  - task-framework
dependencies: []
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: 190.22.5
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why deferred

Goes further than 190.22.5.5 (which only archives the auto-filed clutter out of `backlog/tasks/`). This is the eventual replacement of the whole task framework — likely **ditching Backlog.md** — once the detect→plan loop is proven and the task-DB holds real content. The hard, valuable decisions here are about **work ordering with the user in the loop at a high level**, not storage mechanics, so it is intentionally deferred until there's real data to order.

For now, the task-DB ↔ `backlog/` duplication is an **accepted non-issue** (explicit user decision) — it will be resolved by this work, not before. The caveat raised earlier (two stores must not drift) is waived in the interim because the task-DB is the pipeline's source of truth and `backlog/` is downstream/user-only.

## Direction (to design when promoted)

- **Purge and start fresh.** Completely replace the current Backlog.md-based framework rather than incrementally patching it. Migrate only the genuinely useful tasks into the new format.
- **Reference-based tasks, not restated content.** A task in the new framework is thin: it **references task-DB entries** (`PlanTask` rows — the fault evidence + fix proposal already live there) instead of duplicating their content. It adds the things the DB doesn't hold: external motivations/considerations (product goals, user priorities, cross-cutting constraints, dependencies on non-pipeline work).
- **Order of work is the centerpiece.** The framework's primary job is deciding *what to work on next* — a human-in-the-loop, high-level prioritization surface over the task-DB. This is the open design problem (how the user steers ordering without hand-managing every ticket).
- **Possible end-state: no Backlog.md.** The task-DB + a thin ordering/curation layer becomes the planning surface; the export adapter (190.22.5.4) either targets the user's chosen external tool or is retired. The "switch planning tools easily" seam exists precisely so this is a low-cost pivot.

## Supersedes / relationship

Supersedes the export-to-backlog adapter (190.22.5.4) and the archive-cleanup (190.22.5.5) as the long-term answer; both are interim. Sibling to DRAFT-5 (actuator) and DRAFT-6 (DB storage upgrade).

## Trigger

Promote once: (a) `triage`→`plan` runs end-to-end and the task-DB has a real corpus, and (b) we're ready to design the work-ordering UX with the user. Not before.
<!-- SECTION:DESCRIPTION:END -->
