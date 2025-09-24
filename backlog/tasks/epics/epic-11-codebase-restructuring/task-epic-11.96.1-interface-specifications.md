# Task Epic 11.96.1: Interface Specifications

**Task ID**: task-epic-11.96.1
**Component**: Interface & Data Contract Definitions
**Status**: In Design
**Created**: 2025-01-24

## Overview

This document provides detailed interface specifications and data contracts for the consolidated type resolution architecture. All interfaces follow TypeScript best practices and maintain backward compatibility during migration.

## 1. Core Type Definitions

### 1.1 Base Types (from @ariadnejs/types)

```typescript
// Location and identification types
export type FilePath = string & { __brand: "FilePath" };
export type SymbolId = string & { __brand: "SymbolId" };
export type TypeId = string & { __brand: "TypeId" };
export type SymbolName = string & { __brand: "SymbolName" };
export type LocationKey = string & { __brand: "LocationKey" };
export type ScopeId = string & { __brand: "ScopeId" };

export interface Location {
  file_path: FilePath;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
}
```

### 1.2 Type Resolution Core Types

```typescript
// packages/core/src/symbol_resolution/type_resolution/types.ts

/**
 * Represents a local type definition extracted from source
 */
export interface LocalTypeDefinition {
  readonly name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly location: Location;
  readonly file_path: FilePath;
  readonly members: readonly TypeMember[];
  readonly extends?: readonly SymbolName[];
  readonly implements?: readonly SymbolName[];
  readonly type_parameters?: readonly TypeParameter[];
  readonly modifiers?: readonly TypeModifier[];
}

/**
 * Type member information
 */
export interface TypeMember {
  readonly name: SymbolName;
  readonly kind: "method" | "property" | "field" | "constructor";
  readonly location: Location;
  readonly visibility?: "public" | "private" | "protected";
  readonly static?: boolean;
  readonly optional?: boolean;
  readonly type_annotation?: TypeAnnotation;
}

/**
 * Type parameter for generics
 */
export interface TypeParameter {
  readonly name: SymbolName;
  readonly constraint?: TypeAnnotation;
  readonly default?: TypeAnnotation;
}

/**
 * Type annotation structure
 */
export interface TypeAnnotation {
  readonly kind: "primitive" | "reference" | "union" | "intersection" | "array" | "tuple" | "function" | "generic";
  readonly value: string;
  readonly type_arguments?: readonly TypeAnnotation[];
}

/**
 * Type modifiers
 */
export type TypeModifier = "abstract" | "readonly" | "async" | "const";
```

## 2. Module Input Interfaces

### 2.1 Main Orchestrator Input

```typescript
// packages/core/src/symbol_resolution/type_resolution/index.ts

/**
 * Complete input for type resolution pipeline
 */
export interface TypeResolutionInput {
  /**
   * Semantic indices for all files
   */
  readonly indices: ReadonlyMap<FilePath, SemanticIndex>;

  /**
   * Resolved imports from phase 1
   */
  readonly imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;

  /**
   * Resolved functions from phase 2
   */
  readonly functions: FunctionResolutionMap;
}

/**
 * Function resolution data from phase 2
 */
export interface FunctionResolutionMap {
  readonly function_signatures: ReadonlyMap<SymbolId, FunctionSignature>;
  readonly call_sites: ReadonlyMap<LocationKey, SymbolId>;
}

/**
 * Function signature information
 */
export interface FunctionSignature {
  readonly symbol_id: SymbolId;
  readonly parameters: readonly ParameterInfo[];
  readonly return_type?: TypeAnnotation;
  readonly type_parameters?: readonly TypeParameter[];
  readonly is_async?: boolean;
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  readonly name: SymbolName;
  readonly type_annotation?: TypeAnnotation;
  readonly optional?: boolean;
  readonly default_value?: string;
}
```

### 2.2 Type Registry Input

```typescript
// packages/core/src/symbol_resolution/type_resolution/type_registry/index.ts

export interface TypeRegistryInput {
  /**
   * Type definitions organized by file
   */
  readonly type_definitions: ReadonlyMap<FilePath, readonly LocalTypeDefinition[]>;

  /**
   * Import mappings for resolving cross-file types
   */
  readonly imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}
```

### 2.3 Inheritance Resolution Input

```typescript
// packages/core/src/symbol_resolution/type_resolution/inheritance/index.ts

export interface InheritanceInput {
  /**
   * Type definitions to analyze
   */
  readonly type_definitions: ReadonlyMap<FilePath, readonly LocalTypeDefinition[]>;

  /**
   * Import mappings for resolving parent types
   */
  readonly imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;

  /**
   * Type registry for type lookup
   */
  readonly type_registry: GlobalTypeRegistry;
}
```

### 2.4 Type Annotation Input

```typescript
// packages/core/src/symbol_resolution/type_resolution/type_annotations/index.ts

export interface AnnotationInput {
  /**
   * Type annotations to resolve
   */
  readonly annotations: ReadonlyArray<LocalTypeAnnotation>;

  /**
   * Type registry for type resolution
   */
  readonly type_registry: GlobalTypeRegistry;

  /**
   * Import mappings for cross-file resolution
   */
  readonly imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}

/**
 * Local type annotation from semantic index
 */
export interface LocalTypeAnnotation {
  readonly symbol_id: SymbolId;
  readonly location: Location;
  readonly annotation: TypeAnnotation;
  readonly file_path: FilePath;
}
```

### 2.5 Type Tracking Input

```typescript
// packages/core/src/symbol_resolution/type_resolution/type_tracking/index.ts

export interface TrackingInput {
  /**
   * Type tracking data from semantic index
   */
  readonly type_tracking: ReadonlyMap<FilePath, readonly LocalTypeTracking[]>;

  /**
   * Type registry for type lookup
   */
  readonly type_registry: GlobalTypeRegistry;

  /**
   * Import mappings
   */
  readonly imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}

/**
 * Local type tracking information
 */
export interface LocalTypeTracking {
  readonly symbol_id: SymbolId;
  readonly location: Location;
  readonly tracked_type: TypeId | TypeAnnotation;
  readonly kind: "variable" | "parameter" | "return" | "property";
}
```

### 2.6 Type Flow Input

```typescript
// packages/core/src/symbol_resolution/type_resolution/type_flow/index.ts

export interface TypeFlowInput {
  /**
   * Type flow patterns from semantic index
   */
  readonly type_flows: ReadonlyMap<FilePath, readonly LocalTypeFlowPattern[]>;

  /**
   * Resolved function information
   */
  readonly functions: FunctionResolutionMap;

  /**
   * Type registry for type lookup
   */
  readonly type_registry: GlobalTypeRegistry;

  /**
   * Import mappings
   */
  readonly imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}

/**
 * Type flow pattern
 */
export interface LocalTypeFlowPattern {
  readonly kind: "assignment" | "return" | "call" | "constructor";
  readonly source: FlowSource;
  readonly target: FlowTarget;
  readonly location: Location;
}

export interface FlowSource {
  readonly kind: "variable" | "function" | "literal" | "expression";
  readonly symbol_id?: SymbolId;
  readonly type_id?: TypeId;
}

export interface FlowTarget {
  readonly kind: "variable" | "return" | "parameter";
  readonly symbol_id?: SymbolId;
  readonly location: Location;
}
```

### 2.7 Type Members Input

```typescript
// packages/core/src/symbol_resolution/type_resolution/type_members/index.ts

export interface MembersInput {
  /**
   * Type definitions containing members
   */
  readonly type_definitions: ReadonlyMap<FilePath, readonly LocalTypeDefinition[]>;

  /**
   * Type hierarchy for inheritance resolution
   */
  readonly type_hierarchy: TypeHierarchyGraph;

  /**
   * Type registry for type lookup
   */
  readonly type_registry: GlobalTypeRegistry;
}
```

## 3. Module Output Interfaces

### 3.1 Main Output Structure

```typescript
// packages/core/src/symbol_resolution/type_resolution/index.ts

/**
 * Complete type resolution output
 */
export interface TypeResolutionOutput {
  /**
   * Global registry of all types
   */
  readonly type_registry: GlobalTypeRegistry;

  /**
   * Type inheritance hierarchy
   */
  readonly type_hierarchy: TypeHierarchyGraph;

  /**
   * Location-based type references
   */
  readonly reference_types: ReadonlyMap<LocationKey, TypeId>;

  /**
   * Symbol-based type mappings
   */
  readonly symbol_types: ReadonlyMap<SymbolId, TypeId>;

  /**
   * Resolved type members including inherited
   */
  readonly type_members: ReadonlyMap<TypeId, ReadonlyMap<SymbolName, ResolvedMemberInfo>>;

  /**
   * Type flow analysis results
   */
  readonly type_flow: TypeFlowAnalysis;

  /**
   * Rust-specific type information (optional)
   */
  readonly rust_types?: RustTypeInfo;
}
```

### 3.2 Type Registry Output

```typescript
// packages/core/src/symbol_resolution/type_resolution/type_registry/index.ts

/**
 * Global type registry
 */
export interface GlobalTypeRegistry {
  /**
   * All registered types by ID
   */
  readonly types: ReadonlyMap<TypeId, TypeDefinition>;

  /**
   * Type name to ID mappings by file
   */
  readonly type_names: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, TypeId>>;

  /**
   * Symbol to type mappings
   */
  readonly symbol_types: ReadonlyMap<SymbolId, TypeId>;
}

/**
 * Complete type definition
 */
export interface TypeDefinition {
  readonly id: TypeId;
  readonly name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly file_path: FilePath;
  readonly location: Location;
  readonly members: readonly TypeMember[];
  readonly type_parameters?: readonly TypeParameter[];
  readonly modifiers?: readonly TypeModifier[];
}
```

### 3.3 Type Hierarchy Output

```typescript
// packages/core/src/symbol_resolution/type_resolution/inheritance/index.ts

/**
 * Type hierarchy graph
 */
export interface TypeHierarchyGraph {
  /**
   * Inheritance relationships (child -> parents)
   */
  readonly extends_map: ReadonlyMap<TypeId, readonly TypeId[]>;

  /**
   * Interface implementations (class -> interfaces)
   */
  readonly implements_map: ReadonlyMap<TypeId, readonly TypeId[]>;

  /**
   * Reverse inheritance lookup (parent -> children)
   */
  readonly children_map: ReadonlyMap<TypeId, readonly TypeId[]>;

  /**
   * Topological sort of types (dependency order)
   */
  readonly topological_order: readonly TypeId[];
}
```

### 3.4 Type Flow Output

```typescript
// packages/core/src/symbol_resolution/type_resolution/type_flow/index.ts

/**
 * Type flow analysis results
 */
export interface TypeFlowAnalysis {
  /**
   * Type assignments at locations
   */
  readonly assignment_types: ReadonlyMap<LocationKey, TypeId>;

  /**
   * Flow edges in the type graph
   */
  readonly flow_edges: readonly FlowEdge[];

  /**
   * Inferred types for symbols
   */
  readonly inferred_types: ReadonlyMap<SymbolId, TypeId>;

  /**
   * Type narrowing information
   */
  readonly narrowing: ReadonlyMap<LocationKey, TypeNarrowing>;
}

/**
 * Flow edge in type graph
 */
export interface FlowEdge {
  readonly from: LocationKey | SymbolId;
  readonly to: LocationKey | SymbolId;
  readonly kind: "assignment" | "return" | "parameter" | "call";
  readonly type_id: TypeId;
}

/**
 * Type narrowing at a location
 */
export interface TypeNarrowing {
  readonly original_type: TypeId;
  readonly narrowed_type: TypeId;
  readonly condition: string;
}
```

### 3.5 Resolved Members Output

```typescript
// packages/core/src/symbol_resolution/type_resolution/type_members/index.ts

/**
 * Resolved member information
 */
export interface ResolvedMemberInfo {
  readonly name: SymbolName;
  readonly kind: "method" | "property" | "field" | "constructor";
  readonly declaring_type: TypeId;
  readonly inherited_from?: TypeId;
  readonly location: Location;
  readonly signature?: MemberSignature;
  readonly visibility?: "public" | "private" | "protected";
  readonly static?: boolean;
  readonly abstract?: boolean;
  readonly optional?: boolean;
}

/**
 * Member signature details
 */
export interface MemberSignature {
  readonly parameters?: readonly ParameterInfo[];
  readonly return_type?: TypeAnnotation;
  readonly type_parameters?: readonly TypeParameter[];
  readonly throws?: readonly TypeId[];
}
```

### 3.6 Rust-Specific Output

```typescript
// packages/core/src/symbol_resolution/type_resolution/rust_types/index.ts

/**
 * Rust-specific type information
 */
export interface RustTypeInfo {
  /**
   * Lifetime annotations
   */
  readonly lifetimes: ReadonlyMap<SymbolId, LifetimeInfo>;

  /**
   * Trait implementations
   */
  readonly trait_impls: ReadonlyMap<TypeId, readonly TraitImpl[]>;

  /**
   * Associated types
   */
  readonly associated_types: ReadonlyMap<TypeId, ReadonlyMap<SymbolName, TypeId>>;

  /**
   * Ownership transfers
   */
  readonly ownership: ReadonlyMap<LocationKey, OwnershipInfo>;

  /**
   * Pattern match analysis
   */
  readonly patterns: ReadonlyMap<LocationKey, PatternMatchInfo>;
}

export interface LifetimeInfo {
  readonly name: string;
  readonly scope: ScopeId;
  readonly constraints: readonly string[];
}

export interface TraitImpl {
  readonly trait_id: TypeId;
  readonly type_params: ReadonlyMap<SymbolName, TypeId>;
  readonly methods: ReadonlyMap<SymbolName, SymbolId>;
}

export interface OwnershipInfo {
  readonly kind: "move" | "borrow" | "mut_borrow";
  readonly from: SymbolId;
  readonly to: SymbolId | LocationKey;
}

export interface PatternMatchInfo {
  readonly pattern: string;
  readonly bindings: ReadonlyMap<SymbolName, TypeId>;
  readonly exhaustive: boolean;
}
```

## 4. Error Handling Interfaces

### 4.1 Error Types

```typescript
// packages/core/src/symbol_resolution/type_resolution/errors.ts

/**
 * Base error for type resolution
 */
export class TypeResolutionError extends Error {
  constructor(
    message: string,
    public readonly code: TypeResolutionErrorCode,
    public readonly location?: Location,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "TypeResolutionError";
  }
}

/**
 * Error codes for type resolution
 */
export enum TypeResolutionErrorCode {
  // Registry errors
  DUPLICATE_TYPE = "DUPLICATE_TYPE",
  TYPE_NOT_FOUND = "TYPE_NOT_FOUND",
  CIRCULAR_DEPENDENCY = "CIRCULAR_DEPENDENCY",

  // Inheritance errors
  INVALID_INHERITANCE = "INVALID_INHERITANCE",
  MULTIPLE_INHERITANCE = "MULTIPLE_INHERITANCE",
  INTERFACE_NOT_FOUND = "INTERFACE_NOT_FOUND",

  // Member errors
  DUPLICATE_MEMBER = "DUPLICATE_MEMBER",
  INVALID_OVERRIDE = "INVALID_OVERRIDE",
  ABSTRACT_NOT_IMPLEMENTED = "ABSTRACT_NOT_IMPLEMENTED",

  // Flow errors
  TYPE_MISMATCH = "TYPE_MISMATCH",
  INVALID_ASSIGNMENT = "INVALID_ASSIGNMENT",
  UNRESOLVED_TYPE = "UNRESOLVED_TYPE",

  // Annotation errors
  INVALID_ANNOTATION = "INVALID_ANNOTATION",
  UNKNOWN_TYPE_REFERENCE = "UNKNOWN_TYPE_REFERENCE",
}

/**
 * Result type for error handling
 */
export type Result<T, E = TypeResolutionError> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

### 4.2 Validation Interfaces

```typescript
// packages/core/src/symbol_resolution/type_resolution/validation.ts

/**
 * Input validation interface
 */
export interface InputValidator<T> {
  validate(input: unknown): Result<T>;
}

/**
 * Output validation interface
 */
export interface OutputValidator<T> {
  validate(output: T): Result<T>;
}

/**
 * Validation context
 */
export interface ValidationContext {
  readonly strict_mode: boolean;
  readonly error_recovery: boolean;
  readonly max_errors: number;
}
```

## 5. Utility Interfaces

### 5.1 Factory Functions

```typescript
// packages/core/src/symbol_resolution/type_resolution/factories.ts

/**
 * Factory for creating type IDs
 */
export interface TypeIdFactory {
  create(name: SymbolName, location: Location, kind: string): TypeId;
  parse(id: TypeId): { name: SymbolName; location: Location; kind: string };
}

/**
 * Factory for creating member info
 */
export interface MemberInfoFactory {
  create(member: TypeMember, declaring_type: TypeId): ResolvedMemberInfo;
  merge(base: ResolvedMemberInfo, override: Partial<ResolvedMemberInfo>): ResolvedMemberInfo;
}
```

### 5.2 Builder Interfaces

```typescript
// packages/core/src/symbol_resolution/type_resolution/builders.ts

/**
 * Builder for type registry
 */
export interface TypeRegistryBuilder {
  add_type(definition: LocalTypeDefinition): this;
  add_import(file: FilePath, name: SymbolName, symbol: SymbolId): this;
  build(): GlobalTypeRegistry;
}

/**
 * Builder for type hierarchy
 */
export interface TypeHierarchyBuilder {
  add_extends(child: TypeId, parent: TypeId): this;
  add_implements(type: TypeId, interface: TypeId): this;
  build(): TypeHierarchyGraph;
}
```

### 5.3 Visitor Interfaces

```typescript
// packages/core/src/symbol_resolution/type_resolution/visitors.ts

/**
 * Visitor for type definitions
 */
export interface TypeVisitor<T> {
  visit_class(type: TypeDefinition): T;
  visit_interface(type: TypeDefinition): T;
  visit_type_alias(type: TypeDefinition): T;
  visit_enum(type: TypeDefinition): T;
}

/**
 * Visitor for type members
 */
export interface MemberVisitor<T> {
  visit_method(member: ResolvedMemberInfo): T;
  visit_property(member: ResolvedMemberInfo): T;
  visit_field(member: ResolvedMemberInfo): T;
  visit_constructor(member: ResolvedMemberInfo): T;
}
```

## 6. Configuration Interfaces

### 6.1 Module Configuration

```typescript
// packages/core/src/symbol_resolution/type_resolution/config.ts

/**
 * Configuration for type resolution
 */
export interface TypeResolutionConfig {
  /**
   * Enable Rust-specific type resolution
   */
  readonly enable_rust_types?: boolean;

  /**
   * Maximum inheritance depth
   */
  readonly max_inheritance_depth?: number;

  /**
   * Enable type inference
   */
  readonly enable_type_inference?: boolean;

  /**
   * Strict mode for type checking
   */
  readonly strict_mode?: boolean;

  /**
   * Performance options
   */
  readonly performance?: PerformanceConfig;
}

export interface PerformanceConfig {
  /**
   * Enable caching of resolved types
   */
  readonly cache_enabled?: boolean;

  /**
   * Maximum cache size in MB
   */
  readonly max_cache_size?: number;

  /**
   * Enable parallel processing
   */
  readonly parallel_processing?: boolean;
}
```

### 6.2 Language-Specific Configuration

```typescript
// packages/core/src/symbol_resolution/type_resolution/languages.ts

/**
 * Language-specific type resolution
 */
export interface LanguageTypeResolver {
  /**
   * Language identifier
   */
  readonly language: "typescript" | "javascript" | "python" | "rust";

  /**
   * Resolve language-specific types
   */
  resolve(input: TypeResolutionInput): Partial<TypeResolutionOutput>;

  /**
   * Check if type is language-specific
   */
  is_language_specific(type_id: TypeId): boolean;
}
```

## 7. Testing Interfaces

### 7.1 Test Utilities

```typescript
// packages/core/src/symbol_resolution/type_resolution/testing.ts

/**
 * Test fixture builder
 */
export interface TestFixtureBuilder {
  with_type(definition: LocalTypeDefinition): this;
  with_import(file: FilePath, imports: Map<SymbolName, SymbolId>): this;
  with_function(signature: FunctionSignature): this;
  build(): TypeResolutionInput;
}

/**
 * Test assertion helpers
 */
export interface TypeAssertions {
  assert_type_exists(registry: GlobalTypeRegistry, name: SymbolName): void;
  assert_inheritance(hierarchy: TypeHierarchyGraph, child: TypeId, parent: TypeId): void;
  assert_member_exists(members: Map<SymbolName, ResolvedMemberInfo>, name: SymbolName): void;
  assert_type_flow(flow: TypeFlowAnalysis, from: LocationKey, to: TypeId): void;
}
```

### 7.2 Mock Interfaces

```typescript
// packages/core/src/symbol_resolution/type_resolution/mocks.ts

/**
 * Mock type registry
 */
export interface MockTypeRegistry extends GlobalTypeRegistry {
  add_mock_type(type: TypeDefinition): void;
  clear(): void;
}

/**
 * Mock type hierarchy
 */
export interface MockTypeHierarchy extends TypeHierarchyGraph {
  add_mock_inheritance(child: TypeId, parent: TypeId): void;
  clear(): void;
}
```

## 8. Migration Interfaces

### 8.1 Compatibility Layer

```typescript
// packages/core/src/symbol_resolution/type_resolution/compat.ts

/**
 * Backward compatibility adapter
 */
export interface CompatibilityAdapter {
  /**
   * Convert old format to new
   */
  migrate_input(old_input: any): TypeResolutionInput;

  /**
   * Convert new format to old
   */
  migrate_output(new_output: TypeResolutionOutput): any;

  /**
   * Check if input is old format
   */
  is_legacy_format(input: unknown): boolean;
}
```

### 8.2 Deprecation Warnings

```typescript
// packages/core/src/symbol_resolution/type_resolution/deprecation.ts

/**
 * Deprecation manager
 */
export interface DeprecationManager {
  /**
   * Mark function as deprecated
   */
  deprecate(name: string, replacement: string, removal_version: string): void;

  /**
   * Get deprecation warnings
   */
  get_warnings(): readonly DeprecationWarning[];
}

export interface DeprecationWarning {
  readonly function_name: string;
  readonly replacement: string;
  readonly removal_version: string;
  readonly message: string;
}
```

## 9. Performance Interfaces

### 9.1 Metrics Collection

```typescript
// packages/core/src/symbol_resolution/type_resolution/metrics.ts

/**
 * Performance metrics collector
 */
export interface MetricsCollector {
  /**
   * Start timing an operation
   */
  start_timer(operation: string): TimerHandle;

  /**
   * Record a counter
   */
  increment_counter(name: string, value?: number): void;

  /**
   * Get collected metrics
   */
  get_metrics(): PerformanceMetrics;
}

export interface TimerHandle {
  stop(): number;
}

export interface PerformanceMetrics {
  readonly timings: ReadonlyMap<string, number>;
  readonly counters: ReadonlyMap<string, number>;
  readonly memory_usage: MemoryUsage;
}

export interface MemoryUsage {
  readonly heap_used: number;
  readonly heap_total: number;
  readonly external: number;
}
```

### 9.2 Cache Interfaces

```typescript
// packages/core/src/symbol_resolution/type_resolution/cache.ts

/**
 * Type resolution cache
 */
export interface TypeResolutionCache {
  /**
   * Get cached result
   */
  get<T>(key: string): T | undefined;

  /**
   * Set cached result
   */
  set<T>(key: string, value: T): void;

  /**
   * Clear cache
   */
  clear(): void;

  /**
   * Get cache statistics
   */
  get_stats(): CacheStats;
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
  readonly memory_usage: number;
}
```

## 10. Integration Points

### 10.1 External System Integration

```typescript
// packages/core/src/symbol_resolution/type_resolution/integration.ts

/**
 * Integration with symbol resolution pipeline
 */
export interface SymbolResolutionIntegration {
  /**
   * Extract type information from symbols
   */
  extract_types(symbols: ResolvedSymbols): TypeResolutionInput;

  /**
   * Merge type results back into symbols
   */
  merge_results(symbols: ResolvedSymbols, types: TypeResolutionOutput): ResolvedSymbols;
}

/**
 * Integration with semantic index
 */
export interface SemanticIndexIntegration {
  /**
   * Extract type definitions from index
   */
  extract_type_definitions(index: SemanticIndex): LocalTypeDefinition[];

  /**
   * Extract type annotations
   */
  extract_type_annotations(index: SemanticIndex): LocalTypeAnnotation[];

  /**
   * Extract type flow patterns
   */
  extract_type_flows(index: SemanticIndex): LocalTypeFlowPattern[];
}
```

### 10.2 Plugin System

```typescript
// packages/core/src/symbol_resolution/type_resolution/plugins.ts

/**
 * Type resolution plugin
 */
export interface TypeResolutionPlugin {
  /**
   * Plugin name
   */
  readonly name: string;

  /**
   * Plugin version
   */
  readonly version: string;

  /**
   * Pre-process input
   */
  pre_process?(input: TypeResolutionInput): TypeResolutionInput;

  /**
   * Post-process output
   */
  post_process?(output: TypeResolutionOutput): TypeResolutionOutput;

  /**
   * Extend type registry
   */
  extend_registry?(registry: GlobalTypeRegistry): GlobalTypeRegistry;
}

/**
 * Plugin manager
 */
export interface PluginManager {
  /**
   * Register a plugin
   */
  register(plugin: TypeResolutionPlugin): void;

  /**
   * Apply all plugins
   */
  apply_plugins<T>(phase: "pre" | "post", data: T): T;

  /**
   * Get registered plugins
   */
  get_plugins(): readonly TypeResolutionPlugin[];
}
```

## Summary

This interface specification provides:

1. **Complete type definitions** for all data structures
2. **Clear input/output contracts** for each module
3. **Error handling mechanisms** with typed errors
4. **Utility interfaces** for common operations
5. **Configuration options** for customization
6. **Testing utilities** for comprehensive validation
7. **Migration support** for backward compatibility
8. **Performance monitoring** interfaces
9. **Integration points** with external systems
10. **Plugin system** for extensibility

All interfaces follow TypeScript best practices:
- Readonly properties for immutability
- Branded types for type safety
- Generic types where appropriate
- Clear JSDoc documentation
- Consistent naming conventions

These interfaces form the contract for the new type resolution architecture and ensure clean separation of concerns between modules.