---
id: task-epic-11.30.2
title: Rewrite storage interface integration test
status: Done
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

- [x] Review the current storage interface contract in `src/storage/storage_interface.ts`
- [x] Design integration tests that verify the contract across all implementations (memory, disk, cache)
- [x] Consider whether to:
  - Keep the integration test in `tests/` directory as a cross-feature test, OR
  - Create a new test file colocated with the storage interface itself
- [x] Implement the new integration test following current architecture patterns
- [x] Remove the old commented-out test code once new test is working
- [x] Ensure all storage implementations pass the contract tests

## Acceptance Criteria

- [x] New integration test properly verifies the StorageInterface contract
- [x] Test covers all three implementations: MemoryStorage, DiskStorage, CacheLayer
- [x] Test follows the current architecture patterns from Architecture.md
- [x] All storage-related tests pass
- [x] Old commented code is removed

## Implementation Notes

### Key Decisions

1. **Test Location**: Placed the contract test in `/packages/core/src/storage/__tests__/storage_contract.test.ts` following Architecture.md patterns for integration tests within feature folders. The `__tests__` directory clearly separates this from individual implementation tests while keeping it colocated with the storage feature.

2. **Test Structure**: Implemented a parameterized test pattern using a factory approach:
   - Single `run_storage_contract_tests` function that defines the contract
   - Each implementation provides a factory to create instances
   - All implementations run through the same test suite
   - Implementation-specific tests are separate

3. **Contract Coverage**: The test suite comprehensively covers:
   - Initialization behavior
   - CRUD operations for files
   - State management (get/set complete state)
   - Transaction support (atomicity, isolation, rollback)
   - Error handling
   - Helper function immutability
   - Implementation-specific behaviors (persistence for disk, caching for cache layer)

### Issues Encountered and Resolved

1. **CacheLayer Interface Mismatch**: The initial test used incorrect parameter names (`base_storage` instead of `backend`, `ttl_seconds` instead of `ttl_ms`). Fixed by checking the actual interface in `cache_layer.ts`.

2. **State Immutability Test**: The original approach of trying to mutate a readonly Map was invalid. Changed to test that multiple calls to `get_state()` return consistent data when no changes have been made.

3. **Old Test File**: The legacy `tests/storage_interface.test.ts` was completely removed as it was incompatible with the new architecture and has been fully replaced by the new contract test.

### Test Results

All 65 tests pass successfully:
- 20 tests for MemoryStorage contract
- 20 tests for DiskStorage contract  
- 20 tests for CacheLayer contract
- 2 DiskStorage-specific persistence tests
- 3 CacheLayer-specific caching behavior tests

The test suite validates that all three storage implementations correctly implement the StorageInterface contract while also testing their unique characteristics.

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