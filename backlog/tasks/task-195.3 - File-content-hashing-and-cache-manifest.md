---
id: TASK-195.3
title: File content hashing and cache manifest
status: To Do
assignee: []
created_date: "2026-03-26 11:02"
labels: []
dependencies:
  - TASK-195.1
parent_task_id: TASK-195
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Implement SHA-256 content hashing for cache invalidation and define the `CacheManifest` type.

`compute_content_hash(content: string): string` — uses Node.js `crypto.createHash('sha256')` on raw content.

`CacheManifest` type: `{ schema_version: number; files: Map<FilePath, { content_hash: string }> }` with serialization/deserialization. The `CURRENT_SCHEMA_VERSION` constant starts at 1 and is bumped when any serialized type changes.

Location: `packages/core/src/persistence/content_hash.ts` and `packages/core/src/persistence/cache_manifest.ts` with co-located tests.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 compute_content_hash produces deterministic SHA-256 hex string
- [ ] #2 Same content always produces same hash; different content always produces different hash
- [ ] #3 CacheManifest serializes/deserializes correctly including schema_version and file map
- [ ] #4 CURRENT_SCHEMA_VERSION constant defined and exported
- [ ] #5 Co-located unit tests
<!-- AC:END -->
