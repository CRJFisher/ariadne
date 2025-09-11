import { describe, it, expect } from 'vitest';
import {
  convert_type_info_array_to_single,
  convert_export_info_to_statement,
  convert_type_map_to_public
} from './type_adapters';
import { TypeInfo } from './type_tracking';
import { ExportInfo, TypeKind } from '@ariadnejs/types';

describe('Type Adapters', () => {
  describe('convert_type_info_array_to_single', () => {
    it('should handle empty array', () => {
      const result = convert_type_info_array_to_single([]);
      
      expect(result.type_name).toBe('unknown');
      expect(result.type_kind).toBe(TypeKind.TYPE);
      expect(result.confidence).toBe('assumed');
      expect(result.location).toBeDefined();
    });

    it('should handle single type', () => {
      const typeInfo: TypeInfo = {
        type_name: 'string',
        type_kind: 'primitive',
        location: {
          file_path: 'test.ts' as any,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 10
        },
        confidence: 'explicit'
      };

      const result = convert_type_info_array_to_single([typeInfo]);
      
      expect(result.type_name).toBe('string');
      expect(result.type_kind).toBe(TypeKind.TYPE); // primitive maps to TYPE
      expect(result.confidence).toBe('explicit');
      expect(result.location).toEqual(typeInfo.location);
    });

    it('should handle multiple types creating union', () => {
      const types: TypeInfo[] = [
        {
          type_name: 'string',
          type_kind: 'primitive',
          location: {
            file_path: 'test.ts' as any,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 10
          }
        },
        {
          type_name: 'number',
          type_kind: 'primitive',
          location: {
            file_path: 'test.ts' as any,
            line: 2,
            column: 0,
            end_line: 2,
            end_column: 10
          }
        }
      ];

      const result = convert_type_info_array_to_single(types);
      
      expect(result.type_name).toBe('string | number');
      expect(result.type_kind).toBe(TypeKind.TYPE);
      expect(result.confidence).toBe('inferred');
    });

    it('should map type_kind values correctly', () => {
      const testCases: Array<[string | undefined, TypeKind]> = [
        ['class', TypeKind.CLASS],
        ['interface', TypeKind.INTERFACE],
        ['enum', TypeKind.ENUM],
        ['trait', TypeKind.TRAIT],
        ['primitive', TypeKind.TYPE],
        ['object', TypeKind.TYPE],
        ['function', TypeKind.TYPE],
        ['array', TypeKind.TYPE],
        ['unknown', TypeKind.TYPE],
        [undefined, TypeKind.TYPE]
      ];

      for (const [input, expected] of testCases) {
        const typeInfo: TypeInfo = {
          type_name: 'TestType',
          type_kind: input as any,
          location: {
            file_path: 'test.ts' as any,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 10
          }
        };

        const result = convert_type_info_array_to_single([typeInfo]);
        expect(result.type_kind).toBe(expected);
      }
    });
  });

  describe('convert_export_info_to_statement', () => {
    it('should handle basic export', () => {
      const exportInfo: ExportInfo = {
        name: 'myFunction',
        kind: 'named',
        location: {
          file_path: 'test.ts' as any,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 20
        },
        is_type_only: false,
        source: 'test.ts' as any
      };

      const result = convert_export_info_to_statement(exportInfo);
      
      expect(result.symbol_name).toBe('myFunction');
      expect(result.is_default).toBe(false);
      expect(result.is_type_export).toBe(false);
      expect(result.location).toEqual(exportInfo.location);
      expect(result.export_name).toBe('myFunction');
    });

    it('should handle default export', () => {
      const exportInfo: ExportInfo = {
        name: 'default',
        kind: 'default',
        location: {
          file_path: 'test.ts' as any,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 20
        },
        is_type_only: false,
        source: 'test.ts' as any
      };

      const result = convert_export_info_to_statement(exportInfo);
      
      expect(result.is_default).toBe(true);
      expect(result.export_name).toBe('default');
    });

    it('should handle undefined values with defaults', () => {
      const exportInfo: ExportInfo = {
        name: undefined as any,
        kind: 'named',
        location: {
          file_path: 'test.ts' as any,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 20
        },
        is_type_only: undefined as any,
        source: 'test.ts' as any
      };

      const result = convert_export_info_to_statement(exportInfo);
      
      expect(result.symbol_name).toBe('');
      expect(result.is_type_export).toBe(false);
      expect(result.export_name).toBe('');
    });
  });

  describe('convert_type_map_to_public', () => {
    it('should convert internal type map to public format', () => {
      const typeMap = new Map<string, TypeInfo[]>();
      
      typeMap.set('myVar', [{
        type_name: 'string',
        type_kind: 'primitive',
        location: {
          file_path: 'test.ts' as any,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 10
        }
      }]);

      const result = convert_type_map_to_public(typeMap);
      
      expect(result.get('myVar')).toBeDefined();
      expect(result.get('myVar')?.type_name).toBe('string');
      expect(result.get('myVar')?.type_kind).toBe(TypeKind.TYPE);
    });

    it('should handle multiple types for same variable', () => {
      const typeMap = new Map<string, TypeInfo[]>();
      
      typeMap.set('mixedVar', [
        {
          type_name: 'string',
          location: {
            file_path: 'test.ts' as any,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 10
          }
        },
        {
          type_name: 'number',
          location: {
            file_path: 'test.ts' as any,
            line: 2,
            column: 0,
            end_line: 2,
            end_column: 10
          }
        }
      ]);

      const result = convert_type_map_to_public(typeMap);
      
      expect(result.get('mixedVar')).toBeDefined();
      expect(result.get('mixedVar')?.type_name).toBe('string | number');
    });
  });
});