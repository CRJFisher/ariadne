---
id: task-epic-11.30.2
title: Rewrite storage interface integration test
status: To Do
assignee: []
created_date: "2025-08-25"
labels: [testing, storage, epic-11, technical-debt]
dependencies: [task-epic-11.30.1]
parent_task_id: task-epic-11.30
---

## Description

Rewrite the legacy `tests/storage_interface.test.ts` to properly test the storage interface contract across different implementations using the new feature-based architecture.

## Context

During task-epic-11.30.1, we discovered that the storage interface test was completely broken due to the epic-11 restructuring:

- Test references non-existent APIs from the old architecture (createStorage, registerStorageProvider, Project class, etc.)
- Storage implementations have been migrated to feature-based structure with colocated tests
- The old test is currently disabled with `describe.skip` and comprehensive documentation

## Tasks

- [ ] Review the current storage interface contract in `src/storage/storage_interface.ts`
- [ ] Design integration tests that verify the contract across all implementations (memory, disk, cache)
- [ ] Consider whether to:
  - Keep the integration test in `tests/` directory as a cross-feature test, OR
  - Create a new test file colocated with the storage interface itself
- [ ] Implement the new integration test following current architecture patterns
- [ ] Remove the old commented-out test code once new test is working
- [ ] Ensure all storage implementations pass the contract tests

## Acceptance Criteria

- [ ] New integration test properly verifies the StorageInterface contract
- [ ] Test covers all three implementations: MemoryStorage, DiskStorage, CacheLayer
- [ ] Test follows the current architecture patterns from Architecture.md
- [ ] All storage-related tests pass
- [ ] Old commented code is removed

## Design Considerations

1. **Test Location**: Consider if this should remain in `tests/` as a true integration test or be colocated with storage_interface.ts

2. **Contract Testing Pattern**: The test should define a contract that all implementations must satisfy, similar to:
   ```typescript
   const implementations = [
     { name: 'memory', create: () => create_memory_storage() },
     { name: 'disk', create: () => create_disk_storage({ storage_dir: tempDir }) },
     { name: 'cache', create: () => create_cache_layer({ base: memoryStorage }) }
   ];
   
   implementations.forEach(({ name, create }) => {
     describe(`StorageInterface contract - ${name}`, () => {
       // Contract tests here
     });
   });
   ```

3. **Key Contract Points to Test**:
   - State initialization
   - File CRUD operations
   - Transaction atomicity
   - State persistence (for disk storage)
   - Cache invalidation (for cache layer)

## Notes

This is a follow-up to the storage layer migration work in epic-11. While the individual storage implementations have good colocated tests, we're missing integration tests that verify they all properly implement the storage interface contract.