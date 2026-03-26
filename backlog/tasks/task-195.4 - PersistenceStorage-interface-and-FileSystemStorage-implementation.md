---
id: TASK-195.4
title: PersistenceStorage interface and FileSystemStorage implementation
status: To Do
assignee: []
created_date: "2026-03-26 11:03"
labels: []
dependencies: []
parent_task_id: TASK-195
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Define the `PersistenceStorage` interface and implement `FileSystemStorage`.

Interface methods: `read_index(file_path)`, `write_index(file_path, data)`, `read_manifest()`, `write_manifest(data)`, `clear()` — all async, all string-based.

`FileSystemStorage` writes to a configurable cache directory. Uses atomic write-to-temp-then-rename for all writes. Creates the cache directory if missing.

Location: `packages/core/src/persistence/storage.ts` (interface) and `packages/core/src/persistence/filesystem_storage.ts` (implementation) with co-located tests.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 PersistenceStorage interface defined with 5 async methods
- [ ] #2 FileSystemStorage creates cache directory if missing
- [ ] #3 FileSystemStorage uses atomic write-to-temp-then-rename for all writes
- [ ] #4 read returns null for missing keys (not an error)
- [ ] #5 clear() removes all cached data
- [ ] #6 Round-trip tests using temp directories
- [ ] #7 Storage contract test suite that can be reused for other implementations
<!-- AC:END -->
