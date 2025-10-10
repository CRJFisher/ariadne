import { describe, it, expect, beforeEach } from 'vitest'
import { ResolutionCache } from './resolution_cache'
import { function_symbol, reference_id } from '@ariadnejs/types'
import type { FilePath } from '@ariadnejs/types'

describe('ResolutionCache', () => {
  let cache: ResolutionCache

  beforeEach(() => {
    cache = new ResolutionCache()
  })

  describe('set and get', () => {
    it('should cache and retrieve resolutions', () => {
      const file1 = 'file1.ts' as FilePath
      const ref_id = reference_id('foo', { file_path: file1, start_line: 5, start_column: 10, end_line: 5, end_column: 13 })
      const symbol_id = function_symbol('foo', { file_path: file1, start_line: 1, start_column: 0, end_line: 3, end_column: 1 })

      cache.set(ref_id, symbol_id, file1)

      expect(cache.get(ref_id)).toBe(symbol_id)
    })

    it('should return undefined for unknown reference', () => {
      const file1 = 'test.ts' as FilePath
      const ref_id = reference_id('unknown', { file_path: file1, start_line: 1, start_column: 0, end_line: 1, end_column: 7 })
      expect(cache.get(ref_id)).toBeUndefined()
    })
  })

  describe('invalidate_file', () => {
    it('should remove all resolutions for a file', () => {
      const file1 = 'file1.ts' as FilePath
      const ref1 = reference_id('foo', { file_path: file1, start_line: 5, start_column: 10, end_line: 5, end_column: 13 })
      const ref2 = reference_id('bar', { file_path: file1, start_line: 6, start_column: 10, end_line: 6, end_column: 13 })
      const symbol1 = function_symbol('foo', { file_path: file1, start_line: 1, start_column: 0, end_line: 3, end_column: 1 })
      const symbol2 = function_symbol('bar', { file_path: file1, start_line: 2, start_column: 0, end_line: 4, end_column: 1 })

      cache.set(ref1, symbol1, file1)
      cache.set(ref2, symbol2, file1)

      expect(cache.size()).toBe(2)

      cache.invalidate_file(file1)

      expect(cache.size()).toBe(0)
      expect(cache.get(ref1)).toBeUndefined()
      expect(cache.get(ref2)).toBeUndefined()
    })

    it('should mark file as pending', () => {
      const file1 = 'file1.ts' as FilePath
      const ref_id = reference_id('foo', { file_path: file1, start_line: 5, start_column: 10, end_line: 5, end_column: 13 })
      const symbol_id = function_symbol('foo', { file_path: file1, start_line: 1, start_column: 0, end_line: 3, end_column: 1 })

      cache.set(ref_id, symbol_id, file1)
      cache.mark_file_resolved(file1)

      expect(cache.is_file_resolved(file1)).toBe(true)

      cache.invalidate_file(file1)

      expect(cache.is_file_resolved(file1)).toBe(false)
      expect(cache.get_pending_files().has(file1)).toBe(true)
    })

    it('should not affect other files', () => {
      const file1 = 'file1.ts' as FilePath
      const file2 = 'file2.ts' as FilePath
      const ref1 = reference_id('foo', { file_path: file1, start_line: 5, start_column: 10, end_line: 5, end_column: 13 })
      const ref2 = reference_id('bar', { file_path: file2, start_line: 5, start_column: 10, end_line: 5, end_column: 13 })
      const symbol1 = function_symbol('foo', { file_path: file1, start_line: 1, start_column: 0, end_line: 3, end_column: 1 })
      const symbol2 = function_symbol('bar', { file_path: file2, start_line: 1, start_column: 0, end_line: 3, end_column: 1 })

      cache.set(ref1, symbol1, file1)
      cache.set(ref2, symbol2, file2)

      cache.invalidate_file(file1)

      expect(cache.get(ref1)).toBeUndefined()
      expect(cache.get(ref2)).toBe(symbol2)
    })
  })

  describe('is_file_resolved', () => {
    it('should return false for files in pending set', () => {
      const file1 = 'file1.ts' as FilePath

      cache.invalidate_file(file1)

      expect(cache.is_file_resolved(file1)).toBe(false)
    })

    it('should return true after marking file as resolved', () => {
      const file1 = 'file1.ts' as FilePath

      cache.invalidate_file(file1)
      expect(cache.is_file_resolved(file1)).toBe(false)

      cache.mark_file_resolved(file1)
      expect(cache.is_file_resolved(file1)).toBe(true)
    })

    it('should return true for files never invalidated', () => {
      const file1 = 'file1.ts' as FilePath
      expect(cache.is_file_resolved(file1)).toBe(true)
    })
  })

  describe('get_pending_files', () => {
    it('should return all pending files', () => {
      const file1 = 'file1.ts' as FilePath
      const file2 = 'file2.ts' as FilePath

      cache.invalidate_file(file1)
      cache.invalidate_file(file2)

      const pending = cache.get_pending_files()
      expect(pending.size).toBe(2)
      expect(pending.has(file1)).toBe(true)
      expect(pending.has(file2)).toBe(true)
    })

    it('should return empty set when no files pending', () => {
      expect(cache.get_pending_files().size).toBe(0)
    })
  })

  describe('get_file_resolutions', () => {
    it('should return all resolutions for a file', () => {
      const file1 = 'file1.ts' as FilePath
      const ref1 = reference_id('foo', { file_path: file1, start_line: 5, start_column: 10, end_line: 5, end_column: 13 })
      const ref2 = reference_id('bar', { file_path: file1, start_line: 6, start_column: 10, end_line: 6, end_column: 13 })
      const symbol1 = function_symbol('foo', { file_path: file1, start_line: 1, start_column: 0, end_line: 3, end_column: 1 })
      const symbol2 = function_symbol('bar', { file_path: file1, start_line: 2, start_column: 0, end_line: 4, end_column: 1 })

      cache.set(ref1, symbol1, file1)
      cache.set(ref2, symbol2, file1)

      const resolutions = cache.get_file_resolutions(file1)
      expect(resolutions.size).toBe(2)
      expect(resolutions.get(ref1)).toBe(symbol1)
      expect(resolutions.get(ref2)).toBe(symbol2)
    })

    it('should return empty map for unknown file', () => {
      const unknown_file = 'unknown.ts' as FilePath
      expect(cache.get_file_resolutions(unknown_file).size).toBe(0)
    })
  })

  describe('remove_file', () => {
    it('should remove all resolutions and pending state', () => {
      const file1 = 'file1.ts' as FilePath
      const ref_id = reference_id('foo', { file_path: file1, start_line: 5, start_column: 10, end_line: 5, end_column: 13 })
      const symbol_id = function_symbol('foo', { file_path: file1, start_line: 1, start_column: 0, end_line: 3, end_column: 1 })

      cache.set(ref_id, symbol_id, file1)
      cache.invalidate_file(file1)

      expect(cache.get_pending_files().has(file1)).toBe(true)

      cache.remove_file(file1)

      expect(cache.size()).toBe(0)
      expect(cache.get_pending_files().has(file1)).toBe(false)
      expect(cache.is_file_resolved(file1)).toBe(true)  // No longer pending
    })
  })

  describe('get_stats', () => {
    it('should return accurate statistics', () => {
      const file1 = 'file1.ts' as FilePath
      const file2 = 'file2.ts' as FilePath

      cache.set(
        reference_id('foo', { file_path: file1, start_line: 5, start_column: 10, end_line: 5, end_column: 13 }),
        function_symbol('foo', { file_path: file1, start_line: 1, start_column: 0, end_line: 3, end_column: 1 }),
        file1
      )

      cache.set(
        reference_id('bar', { file_path: file2, start_line: 5, start_column: 10, end_line: 5, end_column: 13 }),
        function_symbol('bar', { file_path: file2, start_line: 1, start_column: 0, end_line: 3, end_column: 1 }),
        file2
      )

      cache.invalidate_file(file2)

      const stats = cache.get_stats()
      expect(stats.total_resolutions).toBe(1)  // file2 invalidated
      expect(stats.files_with_resolutions).toBe(1)
      expect(stats.pending_files).toBe(1)
    })
  })

  describe('clear', () => {
    it('should remove all resolutions and pending state', () => {
      const file1 = 'file1.ts' as FilePath
      const ref_id = reference_id('foo', { file_path: file1, start_line: 5, start_column: 10, end_line: 5, end_column: 13 })
      const symbol_id = function_symbol('foo', { file_path: file1, start_line: 1, start_column: 0, end_line: 3, end_column: 1 })

      cache.set(ref_id, symbol_id, file1)
      cache.invalidate_file(file1)

      // After invalidate_file, resolutions are removed but file is marked as pending
      expect(cache.get_pending_files().size).toBeGreaterThan(0)

      cache.clear()

      expect(cache.size()).toBe(0)
      expect(cache.get_pending_files().size).toBe(0)
    })
  })

  describe('has_resolution', () => {
    it('should return true for cached references', () => {
      const file1 = 'file1.ts' as FilePath
      const ref_id = reference_id('foo', { file_path: file1, start_line: 5, start_column: 10, end_line: 5, end_column: 13 })
      const symbol_id = function_symbol('foo', { file_path: file1, start_line: 1, start_column: 0, end_line: 3, end_column: 1 })

      cache.set(ref_id, symbol_id, file1)

      expect(cache.has_resolution(ref_id)).toBe(true)
    })

    it('should return false for unknown references', () => {
      const file1 = 'file1.ts' as FilePath
      const ref_id = reference_id('foo', { file_path: file1, start_line: 5, start_column: 10, end_line: 5, end_column: 13 })

      expect(cache.has_resolution(ref_id)).toBe(false)
    })
  })
})
