# Task: Update TypeScript Capture Logic for Reduced Attributes

## Status: Created

## Parent Task
task-epic-11.102 - Audit and Remove Unnecessary Semantic Modifiers and CaptureContext Fields

## Objective
Update TypeScript language configuration to support the new reduced attribute set (6 modifiers + 9 context fields) and ensure all tests pass.

## ⚠️ CRITICAL: Complete Mapping Plan First

**THIS SECTION MUST BE COMPLETED BEFORE STARTING ANY SUB-TASKS**

Before implementing any changes in sub-tasks, create a comprehensive mapping plan below that documents exactly how every TypeScript language feature maps to the new reduced attribute structure. All sub-tasks MUST read and follow this plan.

## TypeScript Feature → NormalizedCapture Mapping Plan

### Core Structure Mapping
```typescript
interface NormalizedCapture {
  category: SemanticCategory;    // From capture type
  entity: SemanticEntity;        // From AST node type
  node_location: Location;       // From node position
  // text: REMOVED - do not populate
  modifiers: SemanticModifiers;  // See modifiers mapping below
  context: CaptureContext;       // ALWAYS non-null, see context mapping below
}
```

### Modifiers Mapping (Max 6 fields)

| TypeScript Feature | Modifier Field | Value | Notes |
|--------------------|---------------|-------|-------|
| public keyword/default | `visibility` | 'public' | Default or explicit |
| private keyword | `visibility` | 'private' | Class members only |
| protected keyword | `visibility` | 'protected' | Class members only |
| No export | `visibility` | 'internal' | Module-scoped |
| async function/method | `is_async` | true | From async keyword |
| function*/generator | `is_generator` | true | From function* or * |
| abstract method | `is_abstract` | true | In abstract class |
| interface method | `trait_type` | 'interface' | In interface block |
| abstract class method | `trait_type` | 'abstract_base' | Abstract class context |
| await expression | `is_awaited` | true | At call site only |
| for await...of | `is_iterated` | true | At usage site only |

**IGNORE**: All type-only features (generics, type parameters, conditional types, etc.)
**REMOVE**: Type-only imports/exports (`import type`, `export type`)
**INFER**: Static methods from receiver, not from static keyword

### Context Mapping (9 fields total)

**Import fields (4 fields):**
| TypeScript Feature | Context Field | Example Value | Notes |
|--------------------|--------------|---------------|-------|
| import from 'module' | `source` | 'module' | Source module path |
| import { name } | `imported_symbol` | 'name' | Original export name |
| import as alias | `local_name` | 'alias' | Local alias if different |
| import style | `import_type` | 'default'/'named'/'namespace' | Import pattern |

**Export fields (3 fields):**
| TypeScript Feature | Context Field | Example Value | Notes |
|--------------------|--------------|---------------|-------|
| export { name } | `exported_as` | 'name' | Export name |
| export default | `export_type` | 'default' | Export style |
| export { x } from 'y' | `reexport_source` | 'y' | For reexports only |

**Definition fields (2 fields):**
| TypeScript Feature | Context Field | Example Value | Notes |
|--------------------|--------------|---------------|-------|
| extends BaseClass | `extends` | 'BaseClass' | Base class/interface |
| : ReturnType | `type_name` | 'ReturnType' | For return types, parameter types, variable types |

**Note**: Parameter names are captured in the `symbol_name` field of NormalizedCapture, not in context fields.

### Entity Mapping

| TypeScript Node Type | SemanticEntity | Notes |
|--------------------|----------------|-------|
| function_declaration | FUNCTION | Top-level function |
| arrow_function | FUNCTION | Arrow function |
| method_definition | METHOD | Class method |
| method_signature | METHOD | Interface method |
| constructor | CONSTRUCTOR | Class constructor |
| class_declaration | CLASS | Class definition |
| interface_declaration | INTERFACE | Interface definition |
| enum_declaration | ENUM | Enum definition |
| namespace_declaration | NAMESPACE | Namespace block |
| type_alias_declaration | TYPE_ALIAS | Skip if type-only context |
| variable_statement | VARIABLE | let/const/var |

### Category Mapping

| Capture Context | SemanticCategory | Notes |
|----------------|------------------|-------|
| Definition node | DEFINITION | Declaring symbol |
| Import statement | IMPORT | Importing symbol |
| Export statement | EXPORT | Exporting symbol |
| Function call | REFERENCE | Using symbol |
| Type reference | TYPE | Skip in most cases |
| new expression | REFERENCE | Constructor call |

### TypeScript-Specific Rules

1. **Type-Only Filtering**:
   - Skip `import type` and `export type` completely
   - Skip pure type references unless needed for resolution
   - Keep runtime type assertions (as operator)

2. **Visibility Inference**:
   ```typescript
   class MyClass {
     method() {}          // visibility: 'public' (default)
     public method2() {}  // visibility: 'public' (explicit)
     private method3() {} // visibility: 'private'
     protected method4() {} // visibility: 'protected'
   }
   ```

3. **Abstract & Interface Detection**:
   ```typescript
   abstract class Base {
     abstract method();   // is_abstract: true, trait_type: 'abstract_base'
   }

   interface IFace {
     method();           // trait_type: 'interface'
   }
   ```

### Examples of Complete Mappings

```typescript
// Input: export abstract class DataProcessor { abstract process(): Promise<Result> }
{
  category: DEFINITION,
  entity: CLASS,
  node_location: { start: 0, end: 80 },
  modifiers: {
    is_abstract: true,
    visibility: 'public'
  },
  context: {
    exported_as: 'DataProcessor',
    export_type: 'named'
  }
}

// Method in abstract class
{
  category: DEFINITION,
  entity: METHOD,
  node_location: { start: 40, end: 78 },
  modifiers: {
    is_abstract: true,
    trait_type: 'abstract_base'
  },
  context: {
    type_name: 'Promise'
    // Note: method parameters captured separately as symbol_name
  }
}
```

## Implementation Instructions for Sub-tasks

**ALL SUB-TASKS MUST**:
1. Read this complete mapping plan before starting
2. Follow the mappings exactly as specified above
3. NOT add any fields not listed in the plan
4. Filter out type-only imports/exports
5. Ensure context is ALWAYS non-null (use {} if empty)
6. NEVER populate the text field
7. Reference specific rows from the mapping tables when implementing

## Sub-tasks

### 1. [task-epic-11.102.2.1] Update Language Config
- **File**: `packages/core/src/parse_and_query_code/language_configs/typescript.ts`
- **Actions**:
  - Remove mappings for deprecated modifiers (is_static, is_method, is_generic, etc.)
  - Update visibility mapping (public/private/protected keywords → visibility enum)
  - Remove type-specific fields (type_parameters, is_type_only, etc.)
  - Remove unused context fields (annotation_type, type_params, parameter_name, return_type, etc.)
  - Replace return_type with generic type_name field
  - Add inference logic for static method detection
  - Map abstract keyword to is_abstract
  - Map interface/abstract class methods to trait_type

### 2. [task-epic-11.102.2.2] Update Query File
- **File**: `packages/core/src/parse_and_query_code/queries/typescript.scm`
- **Actions**:
  - Remove captures for type system details
  - Remove captures for deprecated modifiers
  - Ensure visibility modifiers are captured
  - Verify abstract keyword capture
  - Ensure export/import captures align with new structure
  - Remove text capture if present

### 3. [task-epic-11.102.2.3] Update Tests
- **File**: `packages/core/src/parse_and_query_code/language_configs/typescript.test.ts`
- **Actions**:
  - Update test expectations for new structure
  - Remove tests for type system fields and deprecated fields (parameter_name, return_type)
  - Add tests for type_name field (return types, parameter types, variable types)
  - Add tests for visibility enum (public/private/protected)
  - Add tests for abstract detection
  - Add tests for interface method detection (trait_type)
  - Ensure 100% coverage of new fields
  - Verify context is non-null
  - Verify parameter names captured in symbol_name, not context

## TypeScript-Specific Considerations

### Visibility Mapping
- `public` keyword or default → 'public'
- `private` keyword → 'private'
- `protected` keyword → 'protected'
- No export → 'internal'

### Export/Import Types
- `export default` → export_type: 'default'
- `export { name }` → export_type: 'named'
- `export * from` → export_type: 'reexport'
- `export type` → Remove (type-only, no runtime)
- `import type` → Remove (type-only, no runtime)

### Abstract & Interface Detection
- `abstract class` methods → is_abstract: true
- `interface` methods → trait_type: 'interface'
- Abstract class → is_abstract: true

### Async/Generator Detection
- `async` methods/functions → is_async: true
- `function*` and `*methodName()` → is_generator: true
- `await` expressions → is_awaited: true
- `for await...of` → is_iterated: true

### Static Method Inference
```typescript
class MyClass {
  static method() {} // Used to capture is_static: true
  method() {}        // Now inferred from context
}

MyClass.method()     // Infer static from receiver
instance.method()    // Infer instance from receiver
```

### Remove Type System Complexity
- Remove: generics (`<T>`), type parameters, constraints
- Remove: conditional types, mapped types, utility types
- Remove: type assertions, type guards
- Keep only: basic return_type annotation for functions

## Expected Outcome
- TypeScript captures use only the 6 essential modifiers
- Type-only imports/exports are filtered out
- Abstract and interface detection works
- Context contains only the 9 essential fields (4 import + 3 export + 2 definition)
- All tests pass

## Dependencies
- Parent task task-epic-11.102 must define final interface structure
- Should align with JavaScript implementation where overlapping

## Testing Checklist
- [ ] Visibility modifiers work correctly
- [ ] Abstract methods detected
- [ ] Interface methods have correct trait_type
- [ ] Type-only imports/exports filtered
- [ ] Static vs instance inference works
- [ ] Async/generator detection works
- [ ] Context is always non-null
- [ ] No type system fields remain