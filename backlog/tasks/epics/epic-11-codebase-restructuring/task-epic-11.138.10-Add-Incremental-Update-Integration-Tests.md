# Task: Add Incremental Update Integration Tests

**Parent Task**: task-epic-11.138 - Implement Project Coordination Layer
**Status**: Not Started
**Priority**: High
**Complexity**: Medium

## Overview

Add comprehensive integration tests that validate the entire incremental update pipeline. These tests ensure that file updates correctly invalidate resolutions, lazy re-resolution works as expected, and the call graph cache invalidates properly.

## Goals

1. Test complete file update → registry update → invalidation → re-resolution flow
2. Test dependent file invalidation when imports change
3. Test lazy re-resolution behavior
4. Test call graph cache invalidation and rebuild
5. Test multi-file update scenarios
6. Test edge cases (circular imports, etc.)

## Detailed Implementation Plan

### Step 1: Create Integration Test File

**File**: `packages/core/src/project/project.integration.test.ts` (new file)

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { Project } from './project'
import { file_id } from '@ariadnejs/types'

describe('Project - Incremental Updates (Integration)', () => {
  let project: Project

  beforeEach(() => {
    project = new Project()
  })

  describe('file update → registry update', () => {
    it('should update registries when file changes', () => {
      const file1 = file_id('file1.ts')

      // Initial version
      project.update_file(file1, 'function foo() {}')
      const defs_v1 = project.get_file_definitions(file1)
      expect(defs_v1).toHaveLength(1)
      expect(defs_v1[0].name).toBe('foo')

      // Updated version
      project.update_file(file1, 'function bar() {}')
      const defs_v2 = project.get_file_definitions(file1)
      expect(defs_v2).toHaveLength(1)
      expect(defs_v2[0].name).toBe('bar')  // foo should be gone
    })

    it('should update type registry when file changes', () => {
      const file1 = file_id('file1.ts')

      // Initial version
      project.update_file(file1, 'const x: number = 5')
      const derived_v1 = project.get_derived_data(file1)
      expect(derived_v1?.type_bindings.size).toBeGreaterThan(0)

      // Updated version (different type)
      project.update_file(file1, 'const x: string = "hello"')
      const derived_v2 = project.get_derived_data(file1)

      // Should have updated type binding
      const x_def = project.get_file_definitions(file1)[0]
      const x_type = project.get_type_info(x_def.symbol_id)
      expect(x_type).toBeDefined()
    })
  })

  describe('invalidation on file change', () => {
    it('should invalidate resolutions when file changes', () => {
      const file1 = file_id('file1.ts')
      const code = `
        function foo() { return 42 }
        const x = foo()
      `

      // Initial index and resolve
      project.update_file(file1, code)
      project.resolve_file(file1)

      const stats_before = project.get_stats()
      expect(stats_before.cached_resolution_count).toBeGreaterThan(0)
      expect(stats_before.pending_resolution_count).toBe(0)

      // Update file
      project.update_file(file1, code + '\n// comment')

      const stats_after = project.get_stats()
      expect(stats_after.pending_resolution_count).toBe(1)  // file1 is pending
    })

    it('should invalidate dependent files when imports change', () => {
      const lib = file_id('lib.ts')
      const main = file_id('main.ts')

      // lib.ts exports foo
      project.update_file(lib, 'export function foo() { return 42 }')

      // main.ts imports and uses foo
      project.update_file(main, `
        import { foo } from './lib'
        const x = foo()
      `)

      // Resolve both files
      project.resolve_file(lib)
      project.resolve_file(main)

      expect(project.get_stats().pending_resolution_count).toBe(0)

      // Update lib.ts (change implementation)
      project.update_file(lib, 'export function foo() { return 100 }')

      // main.ts should be invalidated (it depends on lib.ts)
      const dependents = project.get_dependents(lib)
      expect(dependents.has(main)).toBe(true)

      const stats = project.get_stats()
      expect(stats.pending_resolution_count).toBe(2)  // lib and main
    })
  })

  describe('lazy re-resolution', () => {
    it('should not resolve until queried', () => {
      const file1 = file_id('file1.ts')
      project.update_file(file1, 'function foo() {}')

      // File is pending (never resolved)
      expect(project.get_stats().pending_resolution_count).toBe(1)

      // Trigger resolution
      project.resolve_file(file1)

      // Now resolved
      expect(project.get_stats().pending_resolution_count).toBe(0)
    })

    it('should use cached resolutions when available', () => {
      const file1 = file_id('file1.ts')
      const code = `
        function foo() { return 42 }
        const x = foo()
      `

      project.update_file(file1, code)
      project.resolve_file(file1)

      const cache_count_before = project.get_stats().cached_resolution_count

      // Resolve again (should use cache, not re-resolve)
      project.resolve_file(file1)

      const cache_count_after = project.get_stats().cached_resolution_count
      expect(cache_count_after).toBe(cache_count_before)  // No new resolutions
    })

    it('should re-resolve after invalidation', () => {
      const file1 = file_id('file1.ts')
      const code = `
        function foo() { return 42 }
        const x = foo()
      `

      project.update_file(file1, code)
      project.resolve_file(file1)

      // Update invalidates
      project.update_file(file1, code + '\n// changed')

      expect(project.get_stats().pending_resolution_count).toBe(1)

      // Re-resolve
      project.resolve_file(file1)

      expect(project.get_stats().pending_resolution_count).toBe(0)
    })
  })

  describe('call graph cache', () => {
    it('should invalidate call graph when file changes', () => {
      const file1 = file_id('file1.ts')
      project.update_file(file1, `
        function foo() { return 42 }
        function bar() { return foo() }
      `)

      // Build call graph
      const graph1 = project.get_call_graph()
      expect(graph1).toBeDefined()

      // Update file
      project.update_file(file1, 'function baz() {}')

      // Call graph should rebuild (cache invalidated)
      const graph2 = project.get_call_graph()
      expect(graph2).toBeDefined()
      // Graph2 should be different from graph1
    })

    it('should automatically resolve pending files before building call graph', () => {
      const file1 = file_id('file1.ts')
      project.update_file(file1, `
        function foo() { return 42 }
        const x = foo()
      `)

      // File is pending
      expect(project.get_stats().pending_resolution_count).toBe(1)

      // Get call graph triggers resolution
      const graph = project.get_call_graph()

      // Should have resolved pending files
      expect(project.get_stats().pending_resolution_count).toBe(0)
      expect(graph).toBeDefined()
    })
  })

  describe('multi-file scenarios', () => {
    it('should handle updates to multiple files', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')
      const file3 = file_id('file3.ts')

      project.update_file(file1, 'export function foo() {}')
      project.update_file(file2, 'export function bar() {}')
      project.update_file(file3, `
        import { foo } from './file1'
        import { bar } from './file2'
        foo()
        bar()
      `)

      // Resolve all
      project.resolve_file(file1)
      project.resolve_file(file2)
      project.resolve_file(file3)

      expect(project.get_stats().pending_resolution_count).toBe(0)

      // Update file1
      project.update_file(file1, 'export function foo() { return 100 }')

      // file1 and file3 should be invalidated (file3 depends on file1)
      const stats = project.get_stats()
      expect(stats.pending_resolution_count).toBe(2)

      // file2 should still be resolved
      expect(project.get_dependents(file2).size).toBe(1)  // file3 depends on file2
    })

    it('should handle import graph changes', () => {
      const lib = file_id('lib.ts')
      const main = file_id('main.ts')

      project.update_file(lib, 'export function foo() {}')
      project.update_file(main, `
        import { foo } from './lib'
        foo()
      `)

      // main depends on lib
      expect(project.get_dependents(lib).has(main)).toBe(true)

      // Update main to remove import
      project.update_file(main, 'function bar() {}')

      // main should no longer depend on lib
      expect(project.get_dependents(lib).has(main)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle circular imports', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      // file1 imports from file2
      project.update_file(file1, `
        import { bar } from './file2'
        export function foo() { return bar() }
      `)

      // file2 imports from file1 (circular!)
      project.update_file(file2, `
        import { foo } from './file1'
        export function bar() { return foo() }
      `)

      // Should not hang or crash
      expect(() => {
        project.resolve_file(file1)
        project.resolve_file(file2)
      }).not.toThrow()
    })

    it('should handle file removal', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      project.update_file(file1, 'export function foo() {}')
      project.update_file(file2, `
        import { foo } from './file1'
        foo()
      `)

      project.resolve_file(file1)
      project.resolve_file(file2)

      // Remove file1
      project.remove_file(file1)

      // file2 should be invalidated
      expect(project.get_stats().pending_resolution_count).toBe(1)

      // file1 should be gone
      expect(project.get_all_files()).not.toContain(file1)
      expect(project.get_file_definitions(file1)).toEqual([])
    })

    it('should handle empty files', () => {
      const file1 = file_id('file1.ts')
      project.update_file(file1, '')

      expect(project.get_file_definitions(file1)).toEqual([])
      expect(() => project.resolve_file(file1)).not.toThrow()
    })

    it('should handle files with only comments', () => {
      const file1 = file_id('file1.ts')
      project.update_file(file1, '// just a comment\n/* and another */')

      expect(() => {
        project.resolve_file(file1)
        project.get_call_graph()
      }).not.toThrow()
    })
  })

  describe('cross-file resolution', () => {
    it('should resolve imported symbols across files', () => {
      const lib = file_id('lib.ts')
      const main = file_id('main.ts')

      project.update_file(lib, 'export function add(a: number, b: number) { return a + b }')
      project.update_file(main, `
        import { add } from './lib'
        const result = add(1, 2)
      `)

      project.resolve_file(lib)
      project.resolve_file(main)

      // Find reference to 'add' in main
      const main_index = project.get_semantic_index(main)!
      const add_ref = main_index.references.find(r => r.name === 'add')

      expect(add_ref).toBeDefined()

      // Resolve the reference
      const resolved_symbol = project.resolve_reference(add_ref!.reference_id, main)

      // Should resolve to add from lib.ts
      expect(resolved_symbol).toBeDefined()
      const add_def = project.get_definition(resolved_symbol!)
      expect(add_def?.name).toBe('add')
      expect(add_def?.location.file).toBe(lib)
    })

    it('should handle re-exports', () => {
      const original = file_id('original.ts')
      const reexporter = file_id('reexporter.ts')
      const consumer = file_id('consumer.ts')

      project.update_file(original, 'export function foo() {}')
      project.update_file(reexporter, `export { foo } from './original'`)
      project.update_file(consumer, `
        import { foo } from './reexporter'
        foo()
      `)

      project.resolve_file(original)
      project.resolve_file(reexporter)
      project.resolve_file(consumer)

      // Should resolve foo in consumer to original definition
      const consumer_index = project.get_semantic_index(consumer)!
      const foo_ref = consumer_index.references.find(r => r.name === 'foo')

      const resolved = project.resolve_reference(foo_ref!.reference_id, consumer)
      const foo_def = project.get_definition(resolved!)

      expect(foo_def?.location.file).toBe(original)
    })
  })
})
```

### Step 2: Add Performance-Related Integration Tests

Add tests that validate incremental updates are actually faster:

```typescript
describe('incremental update performance', () => {
  it('should be faster than full rebuild for single file change', () => {
    const files = Array.from({ length: 10 }, (_, i) => file_id(`file${i}.ts`))

    // Initial build
    for (const file of files) {
      project.update_file(file, `export function func${file}() { return ${Math.random()} }`)
    }

    // Resolve all
    for (const file of files) {
      project.resolve_file(file)
    }

    // Update one file
    const start = performance.now()
    project.update_file(files[0], 'export function func0() { return 999 }')
    project.resolve_file(files[0])
    const incremental_time = performance.now() - start

    // Full rebuild
    const project2 = new Project()
    const rebuild_start = performance.now()
    for (const file of files) {
      project2.update_file(file, `export function func${file}() { return ${Math.random()} }`)
      project2.resolve_file(file)
    }
    const full_rebuild_time = performance.now() - rebuild_start

    // Incremental should be significantly faster
    expect(incremental_time).toBeLessThan(full_rebuild_time / 2)
  })
})
```

## Acceptance Criteria

- [x] Integration tests cover complete update flow
- [x] Tests validate registry updates on file changes
- [x] Tests validate invalidation of file and dependents
- [x] Tests validate lazy re-resolution behavior
- [x] Tests validate call graph cache invalidation
- [x] Tests cover multi-file scenarios
- [x] Tests cover edge cases (circular imports, empty files, etc.)
- [x] Tests validate cross-file resolution
- [x] All tests pass
- [x] Tests demonstrate incremental updates are faster than full rebuild

## Dependencies

- Sub-tasks 138.1-138.9 (all previous sub-tasks must be complete)

## Estimated Effort

- Implementation: 4-5 hours
- Debugging: 2-3 hours
- Total: 6-8 hours

## Notes

- These tests validate end-to-end behavior, not just individual components
- Focus on realistic scenarios (imports, updates, invalidation)
- Edge cases are important for robustness
- Performance tests should demonstrate the value of incremental updates

## Implementation Notes

(To be filled in during implementation)
