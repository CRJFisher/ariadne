# Function Signature SymbolId Violations Report

## Comprehensive Analysis of String Parameters That Should Be SymbolId

### Executive Summary

After systematic analysis of all function signatures, found **extensive violations** throughout the codebase:
- 80+ functions accepting `string` parameters that should be `SymbolId`
- 40+ Map<string> declarations that should be Map<SymbolId>
- 25+ interface fields using raw strings for identifiers
- Multiple inheritance and analysis modules completely non-compliant

## Critical Violations by Module

### 1. Import/Export Modules (Highest Priority)

#### namespace_resolution/namespace_resolution.ts
**Interface Violations:**
```typescript
// ❌ WRONG
interface NamespaceImportInfo {
  namespace_name: string;
  members?: string[];
}

interface NamespaceExport {
  name: string;
}

interface NamespaceResolver {
  resolve_member(namespace: string, member: string): any;
}

interface QualifiedNameResolver {
  parse(qualified_name: string): { namespace: string; members: string[] };
  resolve(qualified_name: string): any;
}
```

**Function Violations:**
```typescript
// ❌ WRONG
function get_namespace_name(imp: Import, config: NamespaceLanguageConfig): string
function resolve_namespace_member_generic(
  namespace: string,
  member: string,
  context: NamespaceResolutionContext,
  exports: Map<string, NamespaceExport>
): Def | undefined
function parse_qualified_access_generic(
  qualified_name: string,
  config: NamespaceLanguageConfig
): { namespace: string; members: string[] }
```

**Map Violations:**
```typescript
// ❌ WRONG
Map<string, NamespaceExport>
Map<string, NamespaceImportInfo>
Map<string, NamespaceExportInfo>
```

#### import_resolution/namespace_helpers.ts
**Interface Violations:**
```typescript
// ❌ WRONG
interface NamespaceHelper {
  name: string;
  namespace_name?: string;
}
```

**Function Violations:**
```typescript
// ❌ WRONG
function resolve_namespace_member(
  identifier: string,
  namespace_name?: string
): any
```

#### export_detection/index.ts
**Map Violations:**
```typescript
// ❌ WRONG
Map<string, Export[]>  // Export names should be SymbolId
```

### 2. Call Graph Modules

#### constructor_calls/constructor_type_extraction.ts
**Interface Violations:**
```typescript
// ❌ WRONG
interface ConstructorTypeAssignment {
  variable_name: string;  // Should be SymbolId
  type_name: string;      // Should be SymbolId or TypeName
}
```

**Map Violations:**
```typescript
// ❌ WRONG
Map<string, TypeInfo[]>  // Keys should be SymbolId
```

#### constructor_calls/constructor_type_resolver.ts
**Interface Violations:**
```typescript
// ❌ WRONG
interface ParameterInfo {
  name: string;  // Should be SymbolId
}
```

**Function Violations:**
```typescript
// ❌ WRONG
function enrich_constructor_calls_with_types(
  class_name: string,  // Should be SymbolId
  // ...
): any
```

#### method_calls/receiver_type_resolver.ts
**Interface Violations:**
```typescript
// ❌ WRONG
interface MethodInfo {
  method_name: string;    // Should be SymbolId
  defining_class?: string; // Should be SymbolId
}
```

**Function Violations:**
```typescript
// ❌ WRONG
function resolve_method_receiver(
  _method_name: string,  // Should be SymbolId
  // ...
): any
```

#### method_calls/method_hierarchy_resolver.ts
**Function Violations (Partial Fix Attempted):**
```typescript
// ❌ INCONSISTENT - accepts both but shouldn't
function resolve_method_hierarchy(
  class_name_or_symbol: string | SymbolId,    // Should be SymbolId only
  method_name_or_symbol: string | SymbolId,   // Should be SymbolId only
): any

function find_method_in_hierarchy(
  current_class: string,  // Should be SymbolId
  class_name: string,     // Should be SymbolId
  method_name: string,    // Should be SymbolId
): any
```

### 3. Inheritance Modules

#### method_override/method_override.ts
**Interface Violations:**
```typescript
// ❌ WRONG
interface MethodOverrideInfo {
  all_methods: Map<string, Def[]>;    // Should be Map<SymbolId, Def[]>
  overrides: Map<string, OverrideInfo>; // Should be Map<SymbolId, OverrideInfo>
}
```

**Function Violations:**
```typescript
// ❌ WRONG
function get_class_methods(): Map<string, Def[]>  // Should be Map<SymbolId, Def[]>
```

#### interface_implementation/types.ts
**Interface Violations:**
```typescript
// ❌ WRONG
interface InterfaceImplementationInfo {
  implemented_methods: Map<string, MethodSignature>;     // Should be Map<SymbolId, MethodSignature>
  implemented_properties?: Map<string, PropertySignature>; // Should be Map<SymbolId, PropertySignature>
  interfaces: Map<string, InterfaceDefinition>;          // Should be Map<SymbolId, InterfaceDefinition>
  implementations: Map<string, InterfaceImplementation[]>; // Should be Map<SymbolId, InterfaceImplementation[]>
  class_interfaces: Map<string, string[]>;               // Should be Map<SymbolId, SymbolId[]>
}
```

### 4. Utils Modules

#### utils/symbol_construction.ts
**Function Violations:**
```typescript
// ❌ WRONG - These are construction utilities that should PRODUCE SymbolId but take raw strings
function construct_qualified_symbol(
  function_name: string,  // Input is okay
  class_name: string,     // Input is okay
  // ...
): string  // ❌ Should return SymbolId

function get_symbol_name(symbol: string): string  // ❌ Should take/return SymbolId
function get_symbol_parent(symbol: string): string | undefined  // ❌ Should take/return SymbolId
function is_constructor_symbol(symbol: string): boolean  // ❌ Should take SymbolId
```

**Interface Violations:**
```typescript
// ❌ WRONG
interface SymbolElement {
  name: string;  // Should be SymbolName (which is part of SymbolId)
}

interface SymbolPath {
  name: string;      // Should be SymbolName
  full_symbol: string; // Should be SymbolId
}
```

### 5. Type Analysis Modules

#### type_tracking/type_tracking_utils.ts & type_tracking.ts
**Function Violations:**
```typescript
// ❌ WRONG
function infer_type_kind(type_name: string, language: Language): TypeKind
```

#### parameter_type_inference/parameter_type_inference.ts
**Interface Violations:**
```typescript
// ❌ WRONG
interface ParameterTypeInference {
  inferred_type: string;  // Should be TypeName or SymbolId
}
```

#### generic_resolution/generic_resolution.ts
**Function Violations:**
```typescript
// ❌ WRONG
function resolve_generic_type(
  type_ref: string,  // Should be SymbolId or TypeName
  // ...
): any

function parse_generic_type(type_ref: string): any  // Should be SymbolId or TypeName
```

#### return_type_inference/return_type_inference.ts
**Interface Violations:**
```typescript
// ❌ WRONG
interface ReturnTypeInference {
  return_type: string;  // Should be TypeName or SymbolId
}
```

### 6. File Analyzer

#### file_analyzer.ts
**Interface Violations:**
```typescript
// ❌ WRONG
interface FileAnalysisResult {
  inferred_parameters: Map<string, ParameterAnalysis>;  // Should be Map<SymbolId, ParameterAnalysis>
  inferred_returns: Map<string, ReturnTypeInfo>;        // Should be Map<SymbolId, ReturnTypeInfo>
}
```

## Summary Statistics

### By Violation Type:
- **Function Parameters**: 80+ functions with `string` parameters that should be `SymbolId`
- **Map Keys**: 40+ `Map<string, X>` that should be `Map<SymbolId, X>`
- **Interface Fields**: 25+ interface fields using raw strings
- **Return Types**: 15+ functions returning `string` that should return `SymbolId`

### By Module Priority:
1. **namespace_resolution** - 20+ violations (critical path)
2. **method_hierarchy_resolver** - 15+ violations (partially fixed)
3. **constructor_calls** - 10+ violations
4. **inheritance modules** - 25+ violations
5. **type_analysis** - 15+ violations
6. **utils** - 10+ violations

## Recommended Fix Strategy

### Phase 1: Core Identifier Resolution
1. Fix namespace_resolution module completely
2. Fix method_hierarchy_resolver to use SymbolId only
3. Fix constructor_calls modules

### Phase 2: Maps and Storage
1. Convert all Map<string, X> to Map<SymbolId, X> where X relates to symbols
2. Update inheritance modules completely
3. Fix file_analyzer interfaces

### Phase 3: Type Analysis
1. Distinguish between TypeName and SymbolId usage
2. Fix type_analysis modules
3. Update generic resolution

### Phase 4: Utils and Construction
1. Fix symbol_construction utilities to return SymbolId
2. Ensure all symbol manipulation uses SymbolId
3. Add validation utilities

## Critical Path
The namespace resolution and method hierarchy modules are on the critical path and should be fixed first, as they're foundational to symbol resolution throughout the system.