import { describe, it, expect, beforeEach } from 'vitest'
import { TypeRegistry } from './type_registry'
import {
  class_symbol,
  method_symbol,
  variable_symbol,
  location_key
} from '@ariadnejs/types'
import type { DerivedData } from '../index_single_file/derived_data'
import type { TypeMemberInfo, FilePath, Location, LocationKey } from '@ariadnejs/types'

// Helper to create location keys for testing
function make_location_key(file_path: FilePath, line: number, column: number = 0): LocationKey {
  const location: Location = {
    file_path,
    start_line: line,
    start_column: column,
    end_line: line,
    end_column: column + 5
  }
  return location_key(location)
}

describe('TypeRegistry', () => {
  let registry: TypeRegistry

  beforeEach(() => {
    registry = new TypeRegistry()
  })

  describe('update_file', () => {
    it('should add type bindings from a file', () => {
      const file1 = 'file1.ts' as FilePath
      const loc_key = make_location_key(file1, 1)

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map([[loc_key, 'number']]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      expect(registry.get_type_binding(loc_key)).toBe('number')
      expect(registry.size().bindings).toBe(1)
    })

    it('should add type members from a file', () => {
      const file1 = 'file1.ts' as FilePath
      const class_id = class_symbol('MyClass', file1, { line: 1, column: 0 })
      const method_id = method_symbol('foo', 'MyClass', file1, { line: 2, column: 2 })

      const members: TypeMemberInfo = {
        methods: new Map([['foo', method_id]]),
        properties: new Map(),
        extends: []
      }

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map(),
        type_members: new Map([[class_id, members]]),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      const retrieved_members = registry.get_type_members(class_id)
      expect(retrieved_members).toBeDefined()
      expect(retrieved_members?.methods.get('foo')).toBe(method_id)
      expect(registry.size().members).toBe(1)
    })

    it('should add type aliases from a file', () => {
      const file1 = 'file1.ts' as FilePath
      const alias_id = variable_symbol('MyType', file1, { line: 1, column: 0 })

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map(),
        type_members: new Map(),
        type_alias_metadata: new Map([[alias_id, 'string | number']]),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      expect(registry.resolve_type_alias(alias_id)).toBe('string | number')
      expect(registry.size().aliases).toBe(1)
    })

    it('should replace type info when file is updated', () => {
      const file1 = 'file1.ts' as FilePath
      const loc_key_v1 = make_location_key(file1, 1, 0)
      const loc_key_v2 = make_location_key(file1, 2, 0)

      // First version
      const derived_v1: DerivedData = {
        file_path: file1,
        type_bindings: new Map([[loc_key_v1, 'number']]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived_v1)
      expect(registry.size().bindings).toBe(1)
      expect(registry.get_type_binding(loc_key_v1)).toBe('number')

      // Second version (replace)
      const derived_v2: DerivedData = {
        file_path: file1,
        type_bindings: new Map([[loc_key_v2, 'string']]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived_v2)

      expect(registry.size().bindings).toBe(1)
      expect(registry.get_type_binding(loc_key_v1)).toBeUndefined()
      expect(registry.get_type_binding(loc_key_v2)).toBe('string')
    })

    it('should handle files with multiple type information types', () => {
      const file1 = 'file1.ts' as FilePath
      const loc_key = make_location_key(file1, 1, 0)
      const class_id = class_symbol('MyClass', file1, { line: 2, column: 0 })
      const alias_id = variable_symbol('MyType', file1, { line: 3, column: 0 })

      const members: TypeMemberInfo = {
        methods: new Map([['foo', method_symbol('foo', 'MyClass', file1, { line: 3, column: 2 })]]),
        properties: new Map(),
        extends: []
      }

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map([[loc_key, 'number']]),
        type_members: new Map([[class_id, members]]),
        type_alias_metadata: new Map([[alias_id, 'string']]),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      expect(registry.size().bindings).toBe(1)
      expect(registry.size().members).toBe(1)
      expect(registry.size().aliases).toBe(1)
    })
  })

  describe('get_type_binding', () => {
    it('should return undefined for non-existent location', () => {
      const file1 = 'file1.ts' as FilePath
      const loc_key = make_location_key(file1, 1, 0)

      expect(registry.get_type_binding(loc_key)).toBeUndefined()
    })

    it('should retrieve type binding by location key', () => {
      const file1 = 'file1.ts' as FilePath
      const loc_key = make_location_key(file1, 1, 0)

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map([[loc_key, 'string']]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      expect(registry.get_type_binding(loc_key)).toBe('string')
    })
  })

  describe('get_type_members', () => {
    it('should return undefined for non-existent type', () => {
      const file1 = 'file1.ts' as FilePath
      const class_id = class_symbol('NonExistent', file1, { line: 1, column: 0 })

      expect(registry.get_type_members(class_id)).toBeUndefined()
    })

    it('should retrieve type members by symbol id', () => {
      const file1 = 'file1.ts' as FilePath
      const class_id = class_symbol('MyClass', file1, { line: 1, column: 0 })
      const method_id = method_symbol('foo', 'MyClass', file1, { line: 2, column: 2 })
      const prop_id = variable_symbol('bar', file1, { line: 3, column: 2 })

      const members: TypeMemberInfo = {
        methods: new Map([['foo', method_id]]),
        properties: new Map([['bar', prop_id]]),
        extends: ['BaseClass']
      }

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map(),
        type_members: new Map([[class_id, members]]),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      const retrieved = registry.get_type_members(class_id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.methods.get('foo')).toBe(method_id)
      expect(retrieved?.properties.get('bar')).toBe(prop_id)
      expect(retrieved?.extends).toEqual(['BaseClass'])
    })
  })

  describe('resolve_type_alias', () => {
    it('should return undefined for non-existent alias', () => {
      const file1 = 'file1.ts' as FilePath
      const alias_id = variable_symbol('NonExistent', file1, { line: 1, column: 0 })

      expect(registry.resolve_type_alias(alias_id)).toBeUndefined()
    })

    it('should resolve type alias to type expression', () => {
      const file1 = 'file1.ts' as FilePath
      const alias_id = variable_symbol('MyType', file1, { line: 1, column: 0 })

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map(),
        type_members: new Map(),
        type_alias_metadata: new Map([[alias_id, 'string | number | boolean']]),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      expect(registry.resolve_type_alias(alias_id)).toBe('string | number | boolean')
    })
  })

  describe('has_type_binding', () => {
    it('should return false for non-existent location', () => {
      const file1 = 'file1.ts' as FilePath
      const loc_key = make_location_key(file1, 1, 0)

      expect(registry.has_type_binding(loc_key)).toBe(false)
    })

    it('should return true for existing location', () => {
      const file1 = 'file1.ts' as FilePath
      const loc_key = make_location_key(file1, 1, 0)

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map([[loc_key, 'number']]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      expect(registry.has_type_binding(loc_key)).toBe(true)
    })
  })

  describe('has_type_members', () => {
    it('should return false for non-existent type', () => {
      const file1 = 'file1.ts' as FilePath
      const class_id = class_symbol('NonExistent', file1, { line: 1, column: 0 })

      expect(registry.has_type_members(class_id)).toBe(false)
    })

    it('should return true for existing type', () => {
      const file1 = 'file1.ts' as FilePath
      const class_id = class_symbol('MyClass', file1, { line: 1, column: 0 })

      const members: TypeMemberInfo = {
        methods: new Map(),
        properties: new Map(),
        extends: []
      }

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map(),
        type_members: new Map([[class_id, members]]),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      expect(registry.has_type_members(class_id)).toBe(true)
    })
  })

  describe('get_all_type_bindings', () => {
    it('should return empty map when no bindings exist', () => {
      const bindings = registry.get_all_type_bindings()
      expect(bindings.size).toBe(0)
    })

    it('should return all type bindings', () => {
      const file1 = 'file1.ts' as FilePath
      const loc1 = make_location_key(file1, 1, 0)
      const loc2 = make_location_key(file1, 2, 0)

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map([
          [loc1, 'number'],
          [loc2, 'string']
        ]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      const bindings = registry.get_all_type_bindings()
      expect(bindings.size).toBe(2)
      expect(bindings.get(loc1)).toBe('number')
      expect(bindings.get(loc2)).toBe('string')
    })
  })

  describe('get_all_type_members', () => {
    it('should return empty map when no members exist', () => {
      const members = registry.get_all_type_members()
      expect(members.size).toBe(0)
    })

    it('should return all type members', () => {
      const file1 = 'file1.ts' as FilePath
      const class1 = class_symbol('Class1', file1, { line: 1, column: 0 })
      const class2 = class_symbol('Class2', file1, { line: 10, column: 0 })

      const members1: TypeMemberInfo = {
        methods: new Map([['foo', method_symbol('foo', 'Class1', file1, { line: 2, column: 2 })]]),
        properties: new Map(),
        extends: []
      }

      const members2: TypeMemberInfo = {
        methods: new Map(),
        properties: new Map([['bar', variable_symbol('bar', file1, { line: 11, column: 2 })]]),
        extends: []
      }

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map(),
        type_members: new Map([
          [class1, members1],
          [class2, members2]
        ]),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      const all_members = registry.get_all_type_members()
      expect(all_members.size).toBe(2)
      expect(all_members.get(class1)).toBe(members1)
      expect(all_members.get(class2)).toBe(members2)
    })
  })

  describe('remove_file', () => {
    it('should remove all type info from a file', () => {
      const file1 = 'file1.ts' as FilePath
      const loc_key = make_location_key(file1, 1, 0)

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map([[loc_key, 'number']]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)
      expect(registry.size().bindings).toBe(1)

      registry.remove_file(file1)

      expect(registry.size().bindings).toBe(0)
      expect(registry.get_type_binding(loc_key)).toBeUndefined()
    })

    it('should not affect other files', () => {
      const file1 = 'file1.ts' as FilePath
      const file2 = 'file2.ts' as FilePath
      const loc1 = make_location_key(file1, 1, 0)
      const loc2 = make_location_key(file2, 1, 0)

      registry.update_file(file1, {
        file_path: file1,
        type_bindings: new Map([[loc1, 'number']]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      })

      registry.update_file(file2, {
        file_path: file2,
        type_bindings: new Map([[loc2, 'string']]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      })

      registry.remove_file(file1)

      expect(registry.size().bindings).toBe(1)
      expect(registry.get_type_binding(loc1)).toBeUndefined()
      expect(registry.get_type_binding(loc2)).toBe('string')
    })

    it('should handle removing non-existent file gracefully', () => {
      const file1 = 'nonexistent.ts' as FilePath

      expect(() => registry.remove_file(file1)).not.toThrow()
      expect(registry.size().bindings).toBe(0)
    })

    it('should remove all types of data from a file', () => {
      const file1 = 'file1.ts' as FilePath
      const loc_key = make_location_key(file1, 1, 0)
      const class_id = class_symbol('MyClass', file1, { line: 2, column: 0 })
      const alias_id = variable_symbol('MyType', file1, { line: 3, column: 0 })

      const members: TypeMemberInfo = {
        methods: new Map(),
        properties: new Map(),
        extends: []
      }

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map([[loc_key, 'number']]),
        type_members: new Map([[class_id, members]]),
        type_alias_metadata: new Map([[alias_id, 'string']]),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)
      expect(registry.size().bindings).toBe(1)
      expect(registry.size().members).toBe(1)
      expect(registry.size().aliases).toBe(1)

      registry.remove_file(file1)

      expect(registry.size().bindings).toBe(0)
      expect(registry.size().members).toBe(0)
      expect(registry.size().aliases).toBe(0)
    })
  })

  describe('size', () => {
    it('should return zero for empty registry', () => {
      const sizes = registry.size()
      expect(sizes.bindings).toBe(0)
      expect(sizes.members).toBe(0)
      expect(sizes.aliases).toBe(0)
    })

    it('should return correct counts', () => {
      const file1 = 'file1.ts' as FilePath
      const loc_key = make_location_key(file1, 1, 0)
      const class_id = class_symbol('MyClass', file1, { line: 2, column: 0 })
      const alias_id = variable_symbol('MyType', file1, { line: 3, column: 0 })

      const members: TypeMemberInfo = {
        methods: new Map(),
        properties: new Map(),
        extends: []
      }

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map([[loc_key, 'number']]),
        type_members: new Map([[class_id, members]]),
        type_alias_metadata: new Map([[alias_id, 'string']]),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)

      const sizes = registry.size()
      expect(sizes.bindings).toBe(1)
      expect(sizes.members).toBe(1)
      expect(sizes.aliases).toBe(1)
    })
  })

  describe('clear', () => {
    it('should remove all data from registry', () => {
      const file1 = 'file1.ts' as FilePath
      const loc_key = make_location_key(file1, 1, 0)
      const class_id = class_symbol('MyClass', file1, { line: 2, column: 0 })

      const members: TypeMemberInfo = {
        methods: new Map(),
        properties: new Map(),
        extends: []
      }

      const derived: DerivedData = {
        file_path: file1,
        type_bindings: new Map([[loc_key, 'number']]),
        type_members: new Map([[class_id, members]]),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      }

      registry.update_file(file1, derived)
      expect(registry.size().bindings).toBe(1)
      expect(registry.size().members).toBe(1)

      registry.clear()

      expect(registry.size().bindings).toBe(0)
      expect(registry.size().members).toBe(0)
      expect(registry.size().aliases).toBe(0)
    })
  })

  describe('cross-file scenarios', () => {
    it('should aggregate type information from multiple files', () => {
      const file1 = 'file1.ts' as FilePath
      const file2 = 'file2.ts' as FilePath

      const loc1 = make_location_key(file1, 1, 0)
      const loc2 = make_location_key(file2, 1, 0)

      const class1 = class_symbol('Class1', file1, { line: 2, column: 0 })
      const class2 = class_symbol('Class2', file2, { line: 2, column: 0 })

      const members1: TypeMemberInfo = {
        methods: new Map([['foo', method_symbol('foo', 'Class1', file1, { line: 3, column: 2 })]]),
        properties: new Map(),
        extends: []
      }

      const members2: TypeMemberInfo = {
        methods: new Map([['bar', method_symbol('bar', 'Class2', file2, { line: 3, column: 2 })]]),
        properties: new Map(),
        extends: []
      }

      registry.update_file(file1, {
        file_path: file1,
        type_bindings: new Map([[loc1, 'number']]),
        type_members: new Map([[class1, members1]]),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      })

      registry.update_file(file2, {
        file_path: file2,
        type_bindings: new Map([[loc2, 'string']]),
        type_members: new Map([[class2, members2]]),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      })

      // Should have data from both files
      expect(registry.size().bindings).toBe(2)
      expect(registry.size().members).toBe(2)

      expect(registry.get_type_binding(loc1)).toBe('number')
      expect(registry.get_type_binding(loc2)).toBe('string')

      expect(registry.get_type_members(class1)?.methods.get('foo')).toBeDefined()
      expect(registry.get_type_members(class2)?.methods.get('bar')).toBeDefined()
    })

    it('should handle incremental updates across multiple files', () => {
      const file1 = 'file1.ts' as FilePath
      const file2 = 'file2.ts' as FilePath

      const loc1_v1 = make_location_key(file1, 1, 0)
      const loc1_v2 = make_location_key(file1, 2, 0)
      const loc2 = make_location_key(file2, 1, 0)

      // Add file1 version 1
      registry.update_file(file1, {
        file_path: file1,
        type_bindings: new Map([[loc1_v1, 'number']]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      })

      // Add file2
      registry.update_file(file2, {
        file_path: file2,
        type_bindings: new Map([[loc2, 'string']]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      })

      expect(registry.size().bindings).toBe(2)

      // Update file1 to version 2
      registry.update_file(file1, {
        file_path: file1,
        type_bindings: new Map([[loc1_v2, 'boolean']]),
        type_members: new Map(),
        type_alias_metadata: new Map(),
        exported_symbols: new Map(),
        scope_to_definitions: new Map()
      })

      // Should still have 2 bindings total
      expect(registry.size().bindings).toBe(2)
      // file1 v1 should be gone, v2 should exist
      expect(registry.get_type_binding(loc1_v1)).toBeUndefined()
      expect(registry.get_type_binding(loc1_v2)).toBe('boolean')
      // file2 should be unchanged
      expect(registry.get_type_binding(loc2)).toBe('string')
    })
  })
})
