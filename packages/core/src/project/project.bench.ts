import { describe, it, expect } from 'vitest'
import { Project } from './project'
import type { FilePath } from '@ariadnejs/types'

/**
 * Lightweight performance benchmarks for Project coordination layer.
 *
 * Run with: npm test -- project.bench.ts
 *
 * Note: These are optional benchmarks to document performance characteristics,
 * not strict requirements.
 */
describe('Project - Performance Benchmarks', () => {
  describe('update_file performance', () => {
    it('should handle small file updates', { timeout: 15000 }, () => {
      const project = new Project()
      const file1 = 'file1.ts' as FilePath

      // Small file (~80 lines)
      const code = `
        function foo() { return 42 }
        function bar() { return foo() + 1 }
        const x = bar()
      `.repeat(20)

      const iterations = 50
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        project.update_file(file1, code + `\n// v${i}`)
      }

      const elapsed = performance.now() - start
      const avg_time = elapsed / iterations

      console.log(`update_file (small): ${avg_time.toFixed(2)}ms avg over ${iterations} iterations`)

      // Just document, don't enforce strict limits
      expect(avg_time).toBeGreaterThan(0)
    })
  })

  describe('resolution cache effectiveness', () => {
    it('should demonstrate cache hit performance', () => {
      const project = new Project()
      const file1 = 'file1.ts' as FilePath

      const code = `
        function foo() { return 42 }
        function bar() { return foo() }
        function baz() { return bar() }
        const x = baz()
      `

      project.update_file(file1, code)

      // First resolution (cold)
      const start_cold = performance.now()
      project.resolve_file(file1)
      const cold_time = performance.now() - start_cold

      // Repeated resolutions (should use cache)
      const iterations = 100
      const start_warm = performance.now()

      for (let i = 0; i < iterations; i++) {
        project.resolve_file(file1)
      }

      const warm_time = (performance.now() - start_warm) / iterations

      console.log(`Resolution - cold: ${cold_time.toFixed(2)}ms, warm: ${warm_time.toFixed(4)}ms`)
      console.log(`Cache speedup: ${(cold_time / warm_time).toFixed(0)}x`)

      // Warm should be faster (cache hit)
      expect(warm_time).toBeLessThan(cold_time)
    })
  })

  describe('incremental vs full rebuild', () => {
    it('should compare incremental update vs full rebuild', { timeout: 15000 }, () => {
      const file_count = 20

      // === INCREMENTAL APPROACH ===
      const project_incremental = new Project()
      const files = Array.from({ length: file_count }, (_, i) => `file${i}.ts` as FilePath)

      // Initial build
      for (let i = 0; i < files.length; i++) {
        const imports = i > 0 ? `import { func${i - 1} } from './file${i - 1}'` : ''
        project_incremental.update_file(files[i], `
          ${imports}
          export function func${i}() { return ${i} }
        `)
      }

      // Resolve all
      for (const file of files) {
        project_incremental.resolve_file(file)
      }

      // Update one file and resolve affected
      const start_incremental = performance.now()
      project_incremental.update_file(files[0], `
        export function func0() { return 999 }
      `)
      project_incremental.resolve_file(files[0])
      const dependents = project_incremental.get_dependents(files[0])
      for (const dep of dependents) {
        project_incremental.resolve_file(dep)
      }
      const incremental_time = performance.now() - start_incremental

      // === FULL REBUILD ===
      const project_full = new Project()
      const start_full = performance.now()

      for (let i = 0; i < files.length; i++) {
        const imports = i > 0 ? `import { func${i - 1} } from './file${i - 1}'` : ''
        const content = i === 0
          ? 'export function func0() { return 999 }'
          : `${imports}\nexport function func${i}() { return ${i} }`

        project_full.update_file(files[i], content)
        project_full.resolve_file(files[i])
      }
      const full_rebuild_time = performance.now() - start_full

      const speedup = full_rebuild_time / incremental_time

      console.log(`\nIncremental vs Full Rebuild (${file_count} files):`)
      console.log(`  Incremental: ${incremental_time.toFixed(2)}ms`)
      console.log(`  Full rebuild: ${full_rebuild_time.toFixed(2)}ms`)
      console.log(`  Speedup: ${speedup.toFixed(1)}x`)

      // Incremental should be faster
      expect(incremental_time).toBeLessThan(full_rebuild_time)
    })
  })

  describe('cache hit rate', () => {
    it('should measure resolution cache behavior', () => {
      const project = new Project()
      const files = Array.from({ length: 10 }, (_, i) => `file${i}.ts` as FilePath)

      // Create files with dependencies
      for (let i = 0; i < files.length; i++) {
        const imports = i > 0 ? `import { func${i - 1} } from './file${i - 1}'` : ''
        project.update_file(files[i], `
          ${imports}
          export function func${i}() { return ${i} }
        `)
      }

      // Resolve all files
      for (const file of files) {
        project.resolve_file(file)
      }

      const stats_before = project.get_stats()
      console.log(`\nAfter initial resolution:`)
      console.log(`  Cached resolutions: ${stats_before.cached_resolution_count}`)
      console.log(`  Pending resolutions: ${stats_before.pending_resolution_count}`)

      // Update one file in the middle
      project.update_file(files[5], `
        import { func4 } from './file4'
        export function func5() { return 555 }
      `)

      const stats_after_update = project.get_stats()
      console.log(`After updating file5:`)
      console.log(`  Cached resolutions: ${stats_after_update.cached_resolution_count}`)
      console.log(`  Pending resolutions: ${stats_after_update.pending_resolution_count}`)

      // Some resolutions should be invalidated
      expect(stats_after_update.pending_resolution_count).toBeGreaterThan(0)
    })
  })
})
