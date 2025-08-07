# Method Resolution Implementation Details

This document provides a technical deep-dive into the method resolution implementation in Ariadne's call graph system.

## Code Flow

### 1. Method Reference Capture (scope_resolution.ts)

Method references are captured by tree-sitter queries with `symbol_kind: 'method'`:

```typescript
// In build_scope_graph()
else if (node_type === "reference") {
  const symbol_kind = parts[2];  // e.g., "method" from "@local.reference.method"
  ref_captures.push({ node, symbol_kind });
}
```

### 2. Reference Storage (graph.ts)

**Key Change**: References are now always stored, even if unresolved:

```typescript
// In insert_ref() - OLD behavior:
if (possible_defs.length > 0 || possible_imports.length > 0) {
  this.nodes.push(ref);
  // ...
}

// NEW behavior:
// Always add the reference node, even if we can't resolve it yet
this.nodes.push(ref);
```

This ensures method references are available for later resolution attempts.

### 3. Method Resolution (project_call_graph.ts)

The resolution happens in `get_calls_from_definition()`:

```typescript
// Two-pass approach within each function:

// First pass: Track constructor calls and variable types
const variableTypes = new Map<string, { className: string; classDef?: Def }>();

for (const ref of definitionRefs) {
  // Check for new expressions
  if (astNode?.parent?.type === 'new_expression') {
    // Track: variableTypes.set("graph", { className: "ScopeGraph", classDef: ... })
  }
}

// Second pass: Resolve method calls using type information
for (const ref of definitionRefs) {
  if (!resolved && ref.symbol_kind === 'method') {
    // Look up the object's type
    const typeInfo = variableTypes.get(objName);
    if (typeInfo?.classDef) {
      // Search for method in the class definition
    }
  }
}
```

## Key Data Structures

### Variable Type Tracking

```typescript
interface VariableTypeInfo {
  className: string;
  classDef?: Def & { enclosing_range?: SimpleRange };
}

const variableTypes = new Map<string, VariableTypeInfo>();
```

### Method Resolution Logic

```typescript
// For method call: obj.method()
1. Extract object name from AST (e.g., "obj")
2. Look up type: variableTypes.get("obj")
3. Get class definition from type info
4. Search methods within class enclosing range
5. Create function call link if found
```

## Language-Specific Patterns

### TypeScript/JavaScript

Tree-sitter query pattern:
```scheme
(call_expression
  function: (member_expression
    object: (identifier) @object
    property: (property_identifier) @local.reference.method))
```

Method detection:
```typescript
// Check for . or ?. before method name
if (beforeRef.endsWith('.') || beforeRef.endsWith('?.')) {
  is_method_call = true;
}
```

### Python

Method detection:
```typescript
// Check for . before method name
if (file_path.endsWith('.py') && beforeRef.endsWith('.')) {
  is_method_call = true;
}
```

### Rust

Method detection:
```typescript
// Check for . or :: before method name
if (file_path.endsWith('.rs') && 
    (beforeRef.endsWith('.') || beforeRef.endsWith('::'))) {
  is_method_call = true;
}
```

## Current Limitations - Technical Details

### 1. Scope Isolation

The `variableTypes` map is created fresh for each function:

```typescript
get_calls_from_definition(def: Def): FunctionCall[] {
  // This map is local to this function call
  const variableTypes = new Map<string, { className: string; classDef?: Def }>();
  // ... type tracking happens here ...
  // Map is discarded when function returns
}
```

### 2. Import Resolution Gap

Import resolution works separately:

```typescript
// In get_imports_with_definitions()
for (const imp of imports) {
  const exportedDef = otherGraph.findExportedDef(export_name);
  if (exportedDef) {
    importInfos.push({
      imported_function: exportedDef,  // This is the class definition
      import_statement: imp,
      local_name: imp.name
    });
  }
}
```

But this information isn't connected to type tracking.

### 3. Missing Type Propagation

No mechanism to track types through:
- Function returns
- Parameter passing
- Module boundaries
- Assignment chains

## Edge Cases and Gotchas

### 1. Method Chaining
```typescript
obj.method1().method2().method3()
```
Currently only `method1` might be resolved if `obj` has type information.

### 2. Destructured Imports
```typescript
import { Class1, Class2 } from "./module";
```
Both classes are resolved as imports, but instances aren't tracked.

### 3. Dynamic Method Calls
```typescript
const methodName = "process";
obj[methodName]();  // Not captured as method reference
```

### 4. Renamed Imports
```typescript
import { Database as DB } from "./database";
const db = new DB();  // Should work but requires import resolution
```

## Performance Considerations

1. **AST Traversal**: Each method reference requires AST traversal to find the object name
2. **Class Range Computation**: Dynamic computation of class enclosing ranges when not set during parsing
3. **No Caching**: Type information is recomputed for each function

## Testing Strategy

Tests are organized by capability:

1. **Working Tests**: Same-file method resolution
2. **Skipped Tests**: Cross-file scenarios that require architectural changes
3. **Edge Case Tests**: Method chaining, renamed imports, multiple instances

Example test structure:
```typescript
test("detects method calls on local variable instances within same file", () => {
  // Tests the working same-file scenario
});

test.skip("cross-file method resolution for TypeScript", () => {
  // Documents desired behavior for cross-file resolution
});
```

## Future Implementation Path

### Phase 1: File-Level Type Tracking (Task 65)
- Move `variableTypes` to file level
- Persist across function boundaries within same file
- Foundation for more advanced type tracking

### Phase 2: Import-Aware Types (Task 66)
- Connect import resolution with constructor tracking
- Track that `new ImportedClass()` creates instance of imported type
- Handle renamed imports and aliasing

### Phase 3: Cross-File Type Registry (Task 67)
- Global type registry accessible across files
- Core infrastructure for cross-file method resolution
- Memory-efficient storage of type information

### Phase 4: Type Inference (Task 68)
- Type inference for function returns
- Parameter type tracking
- Handle assignment chains and method chaining

### Alternative: Two-Pass Analysis (Task 69)
- First pass: Collect all type information
- Second pass: Resolve using collected data
- More comprehensive but potentially slower

### Phase 5: Advanced Features (Task 43)
- Polymorphic call resolution
- Interface/trait resolution
- Generic type tracking