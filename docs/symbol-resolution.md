# Symbol Resolution

This document explains how the consolidated symbol and type resolution system works across files, including finding definitions, references, and type relationships.

## Table of Contents

1. [Overview](#overview)
2. [Consolidated Architecture](#consolidated-architecture)
3. [Single File Resolution](#single-file-resolution)
4. [Cross-file Resolution](#cross-file-resolution)
5. [Type Resolution Pipeline](#type-resolution-pipeline)
6. [Import/Export Handling](#importexport-handling)
7. [Special Cases](#special-cases)
8. [API Functions](#api-functions)
9. [Examples](#examples)

## Overview

Symbol resolution is the process of connecting references to their definitions and resolving type relationships. The consolidated system supports:

- **Local resolution**: Finding symbols within the same file
- **Cross-file resolution**: Following imports to find symbols in other files
- **Type resolution**: Resolving type relationships, inheritance, and member access
- **Bidirectional search**: Finding all references to a definition or the definition of a reference

### Resolution Flow

```text
User clicks on symbol
         ↓
Find node at position
         ↓
Determine node type
         ↓
    ┌────┴────┐
    │         │
Reference  Definition
    │         │
    ▼         ▼
Find Def   Find Refs
    │         │
    ▼         ▼
Check local graph
    │         │
    ▼         ▼
Check imports/exports
    │         │
    ▼         ▼
Search other files
```

## Consolidated Architecture

### Four-Phase Pipeline

The symbol resolution system processes code through four coordinated phases:

```text
Phase 1: Import/Export Resolution → Cross-file symbol mapping
Phase 2: Function Call Resolution → Direct function calls via lexical scope
Phase 3: Type Resolution → Unified type system processing
Phase 4: Method/Constructor Resolution → Object-oriented call resolution
```

### Phase 3: Consolidated Type Resolution

Phase 3 now handles all type-related resolution in a unified pipeline:

```typescript
function phase3_resolve_types(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  functions: FunctionResolutionMap
): TypeResolutionMap
```

**8 Integrated Features:**

1. **Data Collection**: Extract local type information from semantic indices
2. **Type Registry**: Build global registry with unique TypeIds for all types
3. **Inheritance Resolution**: Construct complete type hierarchy graphs
4. **Type Members**: Resolve all members including inherited ones
5. **Type Annotations**: Map type annotations to concrete TypeIds
6. **Type Tracking**: Track variable types across scopes and assignments
7. **Type Flow Analysis**: Analyze type flow through assignments, calls, and returns
8. **Constructor Discovery**: Map constructor calls to their corresponding types

**Key Benefits:**

- **Consistency**: All type features use the same TypeId system and registry
- **Completeness**: Inheritance data enhances member resolution
- **Performance**: Single-pass processing reduces redundant work
- **Maintainability**: Unified pipeline is easier to test and debug

### Testing Infrastructure

The consolidated system includes comprehensive testing:

- **End-to-end validation**: Tests all 8 features working together
- **Cross-language consistency**: Validates behavior across JavaScript, TypeScript, Python, and Rust
- **Edge case coverage**: Handles circular dependencies, diamond inheritance, and malformed input
- **Integration testing**: Verifies proper data flow between modules

## Single File Resolution

### Reference to Definition

When a reference is clicked, the system follows the `RefToDef` or `RefToImport` edges:

```typescript
function find_definition_local(ref: Ref, graph: ScopeGraph): Def | Import | null {
  // Check direct RefToDef edges
  const def_edges = graph.getOutgoingEdges(ref.id)
    .filter(e => e.kind === EdgeKind.RefToDef);
  
  if (def_edges.length > 0) {
    const def_id = def_edges[0].target;
    return graph.nodes.get(def_id) as Def;
  }
  
  // Check RefToImport edges
  const import_edges = graph.getOutgoingEdges(ref.id)
    .filter(e => e.kind === EdgeKind.RefToImport);
  
  if (import_edges.length > 0) {
    const import_id = import_edges[0].target;
    return graph.nodes.get(import_id) as Import;
  }
  
  return null;
}
```

### Definition to References

Finding all references to a definition within the same file:

```typescript
function find_references_local(def: Def, graph: ScopeGraph): Ref[] {
  const refs: Ref[] = [];
  
  // Find all RefToDef edges pointing to this definition
  const ref_edges = graph.getIncomingEdges(def.id)
    .filter(e => e.kind === EdgeKind.RefToDef);
  
  for (const edge of ref_edges) {
    const ref = graph.nodes.get(edge.source) as Ref;
    if (ref) {
      refs.push(ref);
    }
  }
  
  return refs;
}
```

## Cross-file Resolution

### Following Imports

When a reference points to an import, the resolver needs to find the actual definition in another file:

```typescript
function resolve_import(
  imp: Import, 
  current_file: string,
  file_graphs: Map<string, ScopeGraph>
): Def | null {
  // Use source_name for renamed imports
  const export_name = imp.source_name || imp.name;
  
  // If we have module path, try to resolve it
  if (imp.source_module) {
    const target_file = resolve_module_path(current_file, imp.source_module);
    const target_graph = file_graphs.get(target_file);
    
    if (target_graph) {
      return target_graph.findExportedDef(export_name);
    }
  }
  
  // Fallback: search all files
  for (const [file, graph] of file_graphs) {
    if (file === current_file) continue;
    
    const exported_def = graph.findExportedDef(export_name);
    if (exported_def) {
      return exported_def;
    }
  }
  
  return null;
}
```

### Finding Cross-file References

To find all references to an exported symbol:

```typescript
function find_all_references(
  def: Def,
  source_file: string,
  file_graphs: Map<string, ScopeGraph>
): { file: string; ref: Ref }[] {
  const all_refs: { file: string; ref: Ref }[] = [];
  
  // 1. Find local references
  const local_graph = file_graphs.get(source_file)!;
  const local_refs = find_references_local(def, local_graph);
  
  for (const ref of local_refs) {
    all_refs.push({ file: source_file, ref });
  }
  
  // 2. Check if definition is exported
  const is_exported = local_graph.findExportedDef(def.name)?.id === def.id;
  
  if (is_exported) {
    // 3. Search for imports in other files
    for (const [file, graph] of file_graphs) {
      if (file === source_file) continue;
      
      // Find imports with matching name
      const imports = graph.getAllImports();
      for (const imp of imports) {
        // Check both renamed and regular imports
        const matches = imp.source_name === def.name || 
                       (!imp.source_name && imp.name === def.name);
        
        if (matches) {
          // Find references to this import
          const import_refs = find_references_to_import(imp, graph);
          for (const ref of import_refs) {
            all_refs.push({ file, ref });
          }
        }
      }
    }
  }
  
  return all_refs;
}
```

## Type Resolution Pipeline

### Unified Processing Flow

The consolidated type resolution pipeline processes all type-related information in a coordinated sequence:

```text
Input: SemanticIndex + Imports + Functions
         │
         ▼
┌──────────────────┐
│ Data Extraction  │ → LocalTypeExtraction
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Type Registry    │ → GlobalTypeRegistry
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Inheritance      │ → TypeHierarchyGraph
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Type Members     │ → ResolvedMemberInfo
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Annotations      │ → LocationKey → TypeId
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Type Tracking    │ → SymbolId → TypeId
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Flow Analysis    │ → TypeFlowAnalysis
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Result           │ → TypeResolutionMap
│ Consolidation    │
└──────────────────┘
```

### Data Dependencies

Each phase depends on previous phases' outputs:

- **Type Registry**: No dependencies (first phase)
- **Inheritance**: Uses Type Registry for TypeId lookup
- **Type Members**: Uses Type Registry + Inheritance hierarchy
- **Annotations**: Uses Type Registry for type name resolution
- **Type Tracking**: Uses Type Registry for TypeId mapping
- **Flow Analysis**: Uses Type Registry + Function resolution data
- **Consolidation**: Uses outputs from all phases

### Error Handling

The pipeline handles errors gracefully:

```typescript
// Example error recovery in type registry
try {
  const type_registry = build_global_type_registry(definitions, imports);
} catch (error) {
  if (error instanceof CircularDependencyError) {
    // Continue with partial registry, log warning
    return build_partial_registry(definitions);
  }
  throw error; // Re-throw unrecoverable errors
}
```

### Cross-Language Support

The unified pipeline ensures consistent behavior across languages:

- **TypeScript**: Full type support including conditional and mapped types
- **JavaScript**: Inferred types with JSDoc annotation support
- **Python**: Class hierarchy with multiple inheritance support
- **Rust**: Trait implementations, lifetimes, and associated types

## Import/Export Handling

### Export Detection

Exports are definitions in the root scope (scope ID 0):

```typescript
function is_exported(def: Def, graph: ScopeGraph): boolean {
  // Get the scope containing this definition
  const scope_edges = graph.getOutgoingEdges(def.id)
    .filter(e => e.kind === EdgeKind.DefToScope);
  
  if (scope_edges.length === 0) return false;
  
  const scope_id = scope_edges[0].target;
  return scope_id === 0; // Root scope
}
```

### Import Types

The system handles various import styles:

```typescript
// Named import
import { foo } from './module';

// Renamed import
import { foo as bar } from './module';

// Default import
import foo from './module';

// Namespace import (partial support)
import * as foo from './module';
```

### Module Path Resolution

Module paths need to be resolved relative to the importing file:

```typescript
function resolve_module_path(current_file: string, module_path: string): string {
  // Handle relative paths
  if (module_path.startsWith('./') || module_path.startsWith('../')) {
    const dir = path.dirname(current_file);
    const resolved = path.resolve(dir, module_path);
    
    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      const with_ext = resolved + ext;
      if (file_exists(with_ext)) {
        return with_ext;
      }
    }
    
    // Try index file
    const index_path = path.join(resolved, 'index.ts');
    if (file_exists(index_path)) {
      return index_path;
    }
  }
  
  // Handle node_modules (simplified)
  return module_path;
}
```

## Special Cases

### Renamed Imports

Renamed imports require special handling to map the local name to the original export:

```typescript
// File: utils.ts
export function originalName() {}

// File: main.ts
import { originalName as renamed } from './utils';
renamed(); // Should resolve to originalName in utils.ts
```

Resolution process:
1. Reference "renamed" resolves to import with `name: "renamed"`, `source_name: "originalName"`
2. Search for export "originalName" (not "renamed") in other files
3. Return the definition of "originalName"

### Circular Imports

The system handles circular imports by tracking visited files:

```typescript
function resolve_with_cycle_detection(
  ref: Ref,
  file: string,
  file_graphs: Map<string, ScopeGraph>,
  visited: Set<string> = new Set()
): Def | null {
  if (visited.has(file)) {
    return null; // Cycle detected
  }
  
  visited.add(file);
  
  // ... resolution logic ...
  
  visited.delete(file);
  return result;
}
```

### Re-exports

Re-exports require following the chain:

```typescript
// File: core.ts
export function helper() {}

// File: index.ts
export { helper } from './core';

// File: app.ts
import { helper } from './index'; // Should resolve to core.ts
```

## API Functions

### find_definition

Main entry point for go-to-definition:

```typescript
export function find_definition(
  file_path: string,
  position: Point,
  file_graphs: Map<string, ScopeGraph>
): Def | null {
  const graph = file_graphs.get(file_path);
  if (!graph) return null;
  
  const node = graph.findNodeAtPosition(position);
  if (!node) return null;
  
  switch (node.kind) {
    case 'reference':
      return resolve_reference(node, file_path, file_graphs);
      
    case 'import':
      return resolve_import(node, file_path, file_graphs);
      
    case 'definition':
      return node; // Already at definition
      
    default:
      return null;
  }
}
```

### find_all_references

Main entry point for find-all-references:

```typescript
export function find_all_references(
  file_path: string,
  position: Point,
  file_graphs: Map<string, ScopeGraph>
): Ref[] {
  const graph = file_graphs.get(file_path);
  if (!graph) return [];
  
  const node = graph.findNodeAtPosition(position);
  if (!node) return [];
  
  // If on a reference, find its definition first
  let def: Def | null = null;
  let def_file = file_path;
  
  if (node.kind === 'reference') {
    const result = find_definition_with_file(node, file_path, file_graphs);
    if (result) {
      def = result.def;
      def_file = result.file;
    }
  } else if (node.kind === 'definition') {
    def = node;
  }
  
  if (!def) return [];
  
  // Find all references to this definition
  return find_all_references_to_def(def, def_file, file_graphs);
}
```

## Examples

### Example 1: Simple Function Call

```typescript
// File: math.ts
export function add(a: number, b: number) {
  return a + b;
}

// File: app.ts
import { add } from './math';
const result = add(1, 2);
```

Resolution flow for clicking on `add` in `app.ts`:
1. Find reference node at position
2. Reference has `RefToImport` edge to import node
3. Import has `name: "add"`, `source_module: "./math"`
4. Resolve "./math" to "math.ts"
5. Find exported definition "add" in math.ts
6. Return definition with position in math.ts

### Example 2: Renamed Import

```typescript
// File: utils.ts
export function formatDate(date: Date) {
  return date.toISOString();
}

// File: app.ts
import { formatDate as format } from './utils';
const formatted = format(new Date());
```

Resolution flow for clicking on `format` in `app.ts`:
1. Find reference node "format"
2. Reference has `RefToImport` edge to import node
3. Import has `name: "format"`, `source_name: "formatDate"`
4. Search for export "formatDate" (using source_name)
5. Return definition of "formatDate" in utils.ts

### Example 3: Find All References

```typescript
// File: shared.ts
export interface User {
  id: number;
  name: string;
}

// File: api.ts
import { User } from './shared';
function getUser(): User { ... }

// File: ui.ts
import { User } from './shared';
function displayUser(user: User) { ... }
```

Finding all references to `User` interface:
1. Start with definition in shared.ts
2. Find local references in shared.ts (if any)
3. Check that User is exported (in root scope)
4. Search all files for imports of "User"
5. For each import found:
   - Find references to that import
   - Add to results with file information
6. Return all references across all files

## Performance Considerations

### Caching

Consider caching resolution results:

```typescript
class ResolutionCache {
  private cache = new Map<string, Def | null>();
  
  getCacheKey(file: string, position: Point): string {
    return `${file}:${position.row}:${position.column}`;
  }
  
  get(file: string, position: Point): Def | null | undefined {
    return this.cache.get(this.getCacheKey(file, position));
  }
  
  set(file: string, position: Point, result: Def | null): void {
    this.cache.set(this.getCacheKey(file, position), result);
  }
  
  invalidate(file: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(file + ':')) {
        this.cache.delete(key);
      }
    }
  }
}
```

### Early Termination

Stop searching once a match is found:

```typescript
for (const [file, graph] of file_graphs) {
  const def = graph.findExportedDef(name);
  if (def) {
    return def; // Early termination
  }
}
```

### Parallel Search

For large projects, consider parallel searching:

```typescript
async function find_definition_parallel(
  name: string,
  file_graphs: Map<string, ScopeGraph>
): Promise<Def | null> {
  const promises = Array.from(file_graphs.entries()).map(
    async ([file, graph]) => {
      const def = graph.findExportedDef(name);
      return def ? { file, def } : null;
    }
  );
  
  const results = await Promise.all(promises);
  return results.find(r => r !== null)?.def || null;
}
```

## Debugging

### Logging Resolution Steps

```typescript
function debug_resolution(ref: Ref, graph: ScopeGraph) {
  console.log(`Resolving reference: ${ref.name}`);
  
  // Check edges
  const edges = graph.getOutgoingEdges(ref.id);
  console.log(`Outgoing edges: ${edges.map(e => e.kind).join(', ')}`);
  
  // Check local resolution
  const local_def = find_definition_local(ref, graph);
  console.log(`Local resolution: ${local_def?.name || 'none'}`);
  
  // Check if it's an import
  if (local_def?.kind === 'import') {
    console.log(`Import details: source_name=${local_def.source_name}, module=${local_def.source_module}`);
  }
}
```

### Common Issues

1. **Missing edges**: Reference not connected to definition
   - Check that queries capture both definition and reference
   - Verify scoping rules are correct

2. **Wrong resolution**: Reference resolves to wrong definition
   - Check scope hierarchy
   - Verify symbol kinds match

3. **Cross-file failures**: Can't find exported symbols
   - Verify exports are in root scope
   - Check module path resolution

## Further Reading

- [Scope Mechanism Documentation](scope-mechanism.md)
- [Graph Structure Documentation](graph-structure.md)
- [API Reference](api-reference.md)