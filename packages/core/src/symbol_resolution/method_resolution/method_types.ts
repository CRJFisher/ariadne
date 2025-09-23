/**
 * Types for method and constructor call resolution
 */

import type {
  Location,
  LocationKey,
  SymbolId,
  SymbolName,
  TypeId,
  FilePath,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { TypeResolutionMap } from "../types";

/**
 * Resolution result for a single method call
 */
export interface MethodCallResolution {
  readonly call_location: Location;
  readonly resolved_method: SymbolId;
  readonly receiver_type: TypeId;
  readonly method_kind: "instance" | "static" | "constructor";
  readonly resolution_path: "direct" | "inherited" | "interface" | "trait" | "parameter_property";
  readonly receiver_symbol?: SymbolId;
}

/**
 * Complete method resolution mapping
 */
export interface MethodResolutionMap {
  readonly method_calls: ReadonlyMap<LocationKey, SymbolId>;
  readonly constructor_calls: ReadonlyMap<LocationKey, SymbolId>;
  readonly calls_to_method: ReadonlyMap<SymbolId, readonly Location[]>;
  readonly resolution_details: ReadonlyMap<LocationKey, MethodCallResolution>;
}

/**
 * Context for resolving method calls
 */
export interface MethodLookupContext {
  readonly type_resolution: TypeResolutionMap;
  readonly imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
  readonly current_file: FilePath;
  readonly current_index: SemanticIndex;
  readonly indices: ReadonlyMap<FilePath, SemanticIndex>;
}

/**
 * Type method mapping
 */
export interface TypeMethodMap {
  readonly type_id: TypeId;
  readonly methods: ReadonlyMap<SymbolName, SymbolId>;
  readonly static_methods: ReadonlyMap<SymbolName, SymbolId>;
  readonly constructors: ReadonlyMap<SymbolName, SymbolId>;
}

/**
 * Type member mapping including fields/properties
 */
export interface TypeMemberMap {
  readonly type_id: TypeId;
  readonly methods: ReadonlyMap<SymbolName, SymbolId>;
  readonly static_methods: ReadonlyMap<SymbolName, SymbolId>;
  readonly constructors: ReadonlyMap<SymbolName, SymbolId>;
  readonly fields: ReadonlyMap<SymbolName, SymbolId>;
  readonly static_fields: ReadonlyMap<SymbolName, SymbolId>;
}

/**
 * Resolution result for property access
 */
export interface PropertyAccessResolution {
  readonly access_location: Location;
  readonly resolved_field: SymbolId;
  readonly receiver_type: TypeId;
  readonly field_kind: "instance" | "static";
  readonly resolution_path: "direct" | "inherited" | "parameter_property";
  readonly receiver_symbol?: SymbolId;
}