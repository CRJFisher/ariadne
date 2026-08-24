---
id: TASK-381.16
title: "Decide the memory contract by running the corpus at node's default heap ceiling"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - memory
  - performance
dependencies:
  - TASK-381.8
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Both full-corpus runs so far used `--max-old-space-size=12288`. Peak RSS is 7.83 GB with the built stack and 4.25 GB with the export-gate files withheld, against a default old-space ceiling of roughly 4 GB on a 16 GB box. RSS runs about 2.3x settled heap because of the native tree-sitter arenas — 3.32 GB settled against 7.83 GB resident — which is why every projection made from heap figures alone in this investigation was low. Nobody has run the corpus without the flag.

This is a capability question rather than a performance one, and it is currently unanswered. A user who types `ariadne` on a 16 GB laptop either gets an entry-point report or gets `Ineffective mark-compacts near heap limit`, and which one depends on a flag they have no reason to know exists.

The resolution must not be a flag Ariadne sets for itself. Setting `--max-old-space-size` from inside the CLI requires a re-exec or a `NODE_OPTIONS` hand-off — a second execution path, which the constitution forbids — and it would cover only the CLI, leaving the MCP server and the library consumer with neither the flag nor the guarantee. So the outcome of this task is either "it fits, with recorded headroom" or "it does not fit by N MB, and here is the follow-up task against that number".

This is small and it gates the honesty of the epic's headline: a runtime that only holds for people who pass a flag is not the runtime.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 A full-corpus cold load of every discovered file runs with no `--max-old-space-size` flag on a 16 GB box and is recorded as completing or not completing, with peak RSS and settled heap reported.
- [ ] #2 #2 If it completes, the measured headroom against node's default old-space ceiling is recorded, against 7.83 GB RSS / 3.32 GB settled heap with the flag today and 4,246.9 MB RSS with the gate files withheld.
- [ ] #3 #3 If it does not complete, the shortfall in MB is recorded, NO heap flag is added anywhere — a re-exec or `NODE_OPTIONS` path would be a second execution path and would cover only the CLI, not the MCP server or the library — and a follow-up task is opened against the measured shortfall, with the documented memory requirement stating the machine it was measured on.
- [ ] #4 #4 The RSS-to-settled-heap ratio is recorded (measured 2.3x) so no future memory projection in this codebase is made from heap alone.

<!-- AC:END -->
