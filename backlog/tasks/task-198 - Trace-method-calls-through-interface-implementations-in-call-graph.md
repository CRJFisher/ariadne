---
id: TASK-198
title: Trace method calls through interface implementations in call graph
status: To Do
assignee: []
created_date: '2026-03-27 10:25'
labels:
  - call-graph
  - false-positives
  - type-resolution
dependencies: []
references:
  - packages/core/src/resolve_references/call_resolution/
  - packages/core/src/resolve_references/registries/type.ts
  - .claude/self-repair-pipeline-state/known_entrypoints/core.json
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The entry point detection hook currently cannot trace method calls through TypeScript interface implementations. When a method like `read_manifest()` is called via an interface type (`CacheStorage`), the call graph doesn't connect it to the concrete implementation (`FileSystemStorage.read_manifest`).

This causes false positives in entry point detection — interface method implementations appear as "exported but never called" even though they're called through the interface.

**Current workaround:** These methods are added to `known_entrypoints/core.json` as whitelisted entries.

**Goal:** Improve call resolution to trace calls through interface → implementation relationships. Once fixed, remove the whitelisted entries from `known_entrypoints/core.json`:
- `read_manifest` in `file_system_storage.ts`
- `clear` in `file_system_storage.ts`

**Relevant code:**
- Call resolution: `packages/core/src/resolve_references/call_resolution/`
- Type registry (tracks interface/class relationships): `packages/core/src/resolve_references/registries/type.ts`
- Known entrypoints whitelist: `.claude/self-repair-pipeline-state/known_entrypoints/core.json`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Interface method calls are traced to concrete implementations in the call graph
- [ ] #2 read_manifest and clear from file_system_storage.ts no longer appear as unexpected entry points
- [ ] #3 Whitelisted entries for these methods removed from known_entrypoints/core.json
<!-- AC:END -->
