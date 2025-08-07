// Call graph specific types for the immutable implementation

import { Def, SimpleRange, FunctionCall } from './index';

/**
 * Type information for a variable at a specific position
 */
export interface TypeInfo {
  readonly className: string;
  readonly classDef?: Def & { enclosing_range?: SimpleRange };
  readonly position: { readonly row: number; readonly column: number };
}

/**
 * Imported class information
 */
export interface ImportedClassInfo {
  readonly className: string;
  readonly classDef: Def & { enclosing_range?: SimpleRange };
  readonly sourceFile: string;
}

/**
 * Exported type information
 */
export interface ExportedTypeInfo {
  readonly className: string;
  readonly classDef: Def & { enclosing_range?: SimpleRange };
  readonly sourceFile: string;
}

/**
 * Result of analyzing calls from a definition
 */
export interface CallAnalysisResult {
  readonly calls: readonly FunctionCall[];
  readonly typeDiscoveries: readonly TypeDiscovery[];
}

/**
 * A discovered type assignment during call analysis
 */
export interface TypeDiscovery {
  readonly variableName: string;
  readonly typeInfo: TypeInfo;
  readonly scope: 'local' | 'file';
}

/**
 * Result of export detection for a single export
 */
export interface ExportDetectionResult {
  readonly name: string;           // Local name of the exported item
  readonly exportName: string;     // Name it's exported as (may differ for renamed exports)
  readonly definition?: Def;       // The definition being exported
  readonly isDefault?: boolean;    // Whether this is a default export
  readonly isTypeOnly?: boolean;   // Whether this is a type-only export (TS)
}

/**
 * Result of import detection for a single import
 */
export interface ImportDetectionResult {
  readonly localName: string;      // Name used locally in this file
  readonly importedName: string;   // Original name in source file
  readonly sourcePath: string;     // Path to the file being imported from
  readonly importDef?: Def;        // The import definition
  readonly isDefault?: boolean;    // Whether this is a default import
  readonly isTypeOnly?: boolean;   // Whether this is a type-only import (TS)
}

/**
 * Deep readonly utility type for TypeScript immutability
 * Makes all properties and nested properties readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T[P] extends ReadonlyArray<infer U>
    ? readonly DeepReadonly<U>[]
    : T[P] extends Set<infer U>
    ? ReadonlySet<DeepReadonly<U>>
    : T[P] extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

/**
 * Utility type for immutable arrays
 */
export type ImmutableArray<T> = readonly DeepReadonly<T>[];

/**
 * Utility type for immutable maps
 */
export type ImmutableMap<K, V> = ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>;

/**
 * Utility type for immutable sets
 */
export type ImmutableSet<T> = ReadonlySet<DeepReadonly<T>>;