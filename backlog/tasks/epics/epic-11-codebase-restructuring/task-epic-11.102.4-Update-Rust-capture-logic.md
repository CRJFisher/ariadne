# Task: Update Rust Capture Logic for Reduced Attributes

## Status: Created

## Parent Task
task-epic-11.102 - Audit and Remove Unnecessary Semantic Modifiers and CaptureContext Fields

## Objective
Update Rust language configuration to support the new reduced attribute set (6 modifiers + 9 context fields) and ensure all tests pass.

## ⚠️ CRITICAL: Complete Mapping Plan First

**THIS SECTION MUST BE COMPLETED BEFORE STARTING ANY SUB-TASKS**

Before implementing any changes in sub-tasks, create a comprehensive mapping plan below that documents exactly how every Rust language feature maps to the new reduced attribute structure. All sub-tasks MUST read and follow this plan.

## Rust Feature → NormalizedCapture Mapping Plan

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

| Rust Feature | Modifier Field | Value | Notes |
|--------------|---------------|-------|-------|
| pub | `visibility` | 'public' | Public visibility |
| pub(crate) | `visibility` | 'internal' | Crate visibility |
| pub(super) | `visibility` | 'module' | Parent module visibility |
| Default (no pub) | `visibility` | 'private' | Private by default |
| async fn | `is_async` | true | Async function |
| fn returns Iterator | `is_generator` | true | Returns impl Iterator |
| Trait method no body | `is_abstract` | true | Required trait method |
| Trait method | `trait_type` | 'trait' | In trait definition/impl |
| .await | `is_awaited` | true | At call site only |
| for x in iter | `is_iterated` | true | At iteration site |

**REMOVE ALL**: Lifetimes, borrows, smart pointers, unsafe, const, move semantics
**INFER**: Method vs associated function from self parameter presence

### Context Mapping (9 fields total)

**Import fields (4 fields):**
| Rust Feature | Context Field | Example Value | Notes |
|-------------|--------------|---------------|-------|
| use path::Type | `source` | 'path' | Source module/crate |
| use Type | `imported_symbol` | 'Type' | Imported item |
| use as Alias | `local_name` | 'Alias' | Local alias |
| use style | `import_type` | 'named'/'namespace' | Import pattern |

**Export fields (3 fields):**
| Rust Feature | Context Field | Example Value | Notes |
|-------------|--------------|---------------|-------|
| pub fn/struct/enum | `exported_as` | Item name | Public items |
| pub use | `export_type` | 'reexport' | Re-export |
| pub use from::path | `reexport_source` | 'from::path' | Re-export source |

**Definition fields (2 fields):**
| Rust Feature | Context Field | Example Value | Notes |
|-------------|--------------|---------------|-------|
| impl Trait for Type | `extends` | 'Trait' | Trait implementation |
| -> ReturnType | `type_name` | 'ReturnType' | For return types, parameter types, variable types |

**Note**: Parameter names are captured in the `symbol_name` field of NormalizedCapture, not in context fields.

### Entity Mapping

| Rust Node Type | SemanticEntity | Notes |
|---------------|----------------|-------|
| function_item | FUNCTION | Free function |
| function_item (in impl) | METHOD | Has self parameter |
| function_item (in impl, no self) | FUNCTION | Associated function |
| struct_item | CLASS | Struct definition |
| enum_item | ENUM | Enum definition |
| trait_item | INTERFACE | Trait definition |
| impl_item | CLASS | Implementation block |
| let_declaration | VARIABLE | Variable binding |
| const_item | CONSTANT | Constant |
| mod_item | NAMESPACE | Module |
| use_declaration | IMPORT | Use statement |

### Category Mapping

| Capture Context | SemanticCategory | Notes |
|----------------|------------------|-------|
| Item definition | DEFINITION | fn/struct/enum/trait |
| use statement | IMPORT | Importing items |
| pub item | EXPORT | Public API |
| Function call | REFERENCE | Calling function |
| Method call | REFERENCE | obj.method() |
| Path reference | REFERENCE | Type::method() |
| mod/impl/fn | SCOPE | Scope boundaries |

### Rust-Specific Rules

1. **Method vs Associated Function**:
   ```rust
   impl MyStruct {
       fn new() -> Self {}           // entity: FUNCTION (no self)
       fn method(&self) {}           // entity: METHOD (has &self)
       fn method_mut(&mut self) {}   // entity: METHOD (has &mut self)
       fn consume(self) {}           // entity: METHOD (has self)
   }
   ```

2. **Visibility Mapping**:
   ```rust
   pub fn public_fn() {}             // visibility: 'public'
   pub(crate) fn crate_fn() {}      // visibility: 'internal'
   pub(super) fn parent_fn() {}     // visibility: 'module'
   fn private_fn() {}               // visibility: 'private'
   ```

3. **Trait Implementation**:
   ```rust
   trait MyTrait {
       fn required(&self);          // is_abstract: true, trait_type: 'trait'
       fn provided(&self) { ... }   // is_abstract: false, trait_type: 'trait'
   }

   impl MyTrait for MyType {
       fn required(&self) { ... }   // trait_type: 'trait'
   }
   ```

4. **What to SKIP**:
   - All lifetime parameters ('a, 'static)
   - All borrow types (&, &mut)
   - Smart pointer details (Box, Rc, Arc)
   - unsafe blocks and functions
   - const fn (just treat as regular fn)
   - Generic type parameters (unless needed for basic name)

### Examples of Complete Mappings

```rust
// Input: pub async fn process_data(input: &str) -> Result<Data>

{
  category: DEFINITION,
  entity: FUNCTION,
  node_location: { start: 0, end: 60 },
  modifiers: {
    is_async: true,
    visibility: 'public'
  },
  context: {
    exported_as: 'process_data',
    export_type: 'named',
    type_name: 'Result'
    // Note: parameter 'input' captured separately as symbol_name: 'input'
  }
}

// Input: impl Display for MyType { fn fmt(&self, f: &mut Formatter) -> Result }

{
  category: DEFINITION,
  entity: METHOD,
  node_location: { start: 30, end: 80 },
  modifiers: {
    trait_type: 'trait',
    visibility: 'public'  // Trait methods are public
  },
  context: {
    type_name: 'Result'
    // Note: method parameter 'self' captured separately as symbol_name
  }
}
```

## Implementation Instructions for Sub-tasks

**ALL SUB-TASKS MUST**:
1. Read this complete mapping plan before starting
2. Follow the mappings exactly as specified above
3. REMOVE all Rust-specific complexity (lifetimes, borrows, etc.)
4. Distinguish methods from associated functions via self parameter
5. Ensure context is ALWAYS non-null (use {} if empty)
6. NEVER populate the text field
7. Reference specific rows from the mapping tables when implementing

## Sub-tasks

### 1. [task-epic-11.102.4.1] Update Language Config
- **File**: `packages/core/src/parse_and_query_code/language_configs/rust.ts`
- **Actions**:
  - Remove Rust-specific modifiers (lifetimes, borrows, smart pointers, etc.)
  - Map visibility (pub, pub(crate), pub(super) → visibility enum)
  - Remove unsafe/const (not needed for call graphs)
  - Remove deprecated context fields (parameter_name, return_type, etc.)
  - Replace return_type with generic type_name field
  - Map trait methods to trait_type
  - Add inference for associated functions vs methods
  - Simplify module/use handling

### 2. [task-epic-11.102.4.2] Update Query File
- **File**: `packages/core/src/parse_and_query_code/queries/rust.scm`
- **Actions**:
  - Remove captures for lifetime parameters
  - Remove captures for borrow/move semantics
  - Remove smart pointer specific captures
  - Ensure visibility modifiers captured correctly
  - Capture trait impl context
  - Remove text capture if present

### 3. [task-epic-11.102.4.3] Update Tests
- **File**: `packages/core/src/parse_and_query_code/language_configs/rust.test.ts`
- **Actions**:
  - Update test expectations for new structure
  - Remove tests for Rust-specific type system and deprecated fields (parameter_name, return_type)
  - Add tests for type_name field (return types, parameter types, variable types)
  - Add tests for visibility mapping
  - Add tests for trait method detection
  - Add tests for associated functions vs methods
  - Ensure 100% coverage of new fields
  - Verify context is non-null (9 fields: 4 import + 3 export + 2 definition)
  - Verify parameter names captured in symbol_name, not context

## Rust-Specific Considerations

### Visibility Mapping
- `pub` → 'public'
- `pub(crate)` → 'internal'
- `pub(super)` → 'module'
- Default (no pub) → 'private'

### Import/Export Patterns
```rust
use std::collections::HashMap;        // import_type: 'named'
use std::io::{self, Write};          // Multiple imports
use module::*;                        // import_type: 'namespace'
pub use other::Type;                  // export_type: 'reexport'
pub use other::Type as Alias;        // With alias
```

### Method vs Associated Function
```rust
impl MyStruct {
    fn new() -> Self {}           // Associated function (no self)
    fn method(&self) {}           // Instance method (has &self)
    fn method_mut(&mut self) {}   // Mutable method (has &mut self)
    fn consume(self) {}           // Consuming method (has self)
}

MyStruct::new()                   // Static/associated call
instance.method()                 // Instance call
```

### Trait Implementation
```rust
trait MyTrait {                   // Trait definition
    fn required(&self);           // trait_type: 'trait', is_abstract: true
    fn provided(&self) { ... }    // trait_type: 'trait', is_abstract: false
}

impl MyTrait for MyStruct {       // Implementation
    fn required(&self) { ... }    // trait_type: 'trait'
}
```

### Async/Iterator Detection
```rust
async fn async_func() {}          // is_async: true
fn returns_iter() -> impl Iterator<Item=i32> {} // is_generator: true

async_func().await                // is_awaited: true
for item in iter {}               // is_iterated: true
```

### Remove Rust Complexity
Remove all:
- Lifetime parameters (`'a`, `'static`)
- Borrow types (`&`, `&mut`)
- Smart pointers (Box, Rc, Arc)
- Move semantics
- unsafe blocks/functions
- const functions
- Generic parameters (unless needed for basic resolution)

### Module System
```rust
mod submodule;                    // Module declaration
pub mod public_module;            // Public module
use crate::module::Type;          // Crate-relative import
use super::parent::Type;          // Parent module import
```

## Expected Outcome
- Rust captures use only the 6 essential modifiers
- Complex type system removed
- Visibility mapping works correctly
- Trait methods detected with trait_type
- Associated functions vs methods distinguished
- Context contains only the 9 essential fields (4 import + 3 export + 2 definition)
- All tests pass

## Dependencies
- Parent task task-epic-11.102 must define final interface structure
- May need to coordinate with rust_core.ts, rust_functions.ts, rust_patterns.ts

## Testing Checklist
- [ ] Visibility mapping works (pub, pub(crate), etc.)
- [ ] Associated functions detected correctly
- [ ] Instance methods detected correctly
- [ ] Trait methods have trait_type
- [ ] async fn detected
- [ ] Iterator returns detected as generators
- [ ] Module imports/exports work
- [ ] Context is always non-null
- [ ] No Rust-specific fields remain
- [ ] Lifetimes/borrows/smart pointers removed