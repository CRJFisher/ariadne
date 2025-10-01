# MetadataExtractors Interface Guide

## Overview

The `MetadataExtractors` interface provides a standardized way to extract metadata from tree-sitter AST nodes across different programming languages. Each language implements these extractors to handle its specific syntax while maintaining a consistent API.

## Interface Definition

```typescript
export interface MetadataExtractors {
  extract_type_from_annotation(node: SyntaxNode): TypeInfo | undefined;
  extract_call_receiver(node: SyntaxNode): Location | undefined;
  extract_property_chain(node: SyntaxNode): SymbolId[] | undefined;
  extract_assignment_parts(node: SyntaxNode): {
    source: Location | undefined;
    target: Location | undefined;
  };
  extract_construct_target(node: SyntaxNode): Location | undefined;
  extract_type_arguments(node: SyntaxNode): string[] | undefined;
}
```

## Method Documentation

### `extract_type_from_annotation`

Extracts type information from type annotation nodes.

**Purpose:** Captures type hints, type annotations, and type references to understand variable and parameter types.

**Returns:** `TypeInfo` object containing:
- `name`: The type name or expression
- `kind`: Type kind (primitive, class, generic, union, etc.)
- `type_arguments`: Generic type parameters if present

#### JavaScript/TypeScript Example
```typescript
// Input: let x: string
extract_type_from_annotation(type_annotation_node)
// Returns: { name: "string", kind: "primitive" }

// Input: const items: Array<User>
extract_type_from_annotation(type_annotation_node)
// Returns: { name: "Array", kind: "generic", type_arguments: ["User"] }
```

#### Python Example
```python
# Input: def process(data: List[str]) -> None:
extract_type_from_annotation(type_node)
# Returns: { name: "List", kind: "generic", type_arguments: ["str"] }

# Input: x: int | None = 5
extract_type_from_annotation(type_node)
# Returns: { name: "int | None", kind: "union" }
```

#### Rust Example
```rust
// Input: let x: Vec<String>
extract_type_from_annotation(type_node)
// Returns: { name: "Vec", kind: "generic", type_arguments: ["String"] }

// Input: fn process(data: &'a str) -> Result<(), Error>
extract_type_from_annotation(type_node)
// Returns: { name: "Result", kind: "generic", type_arguments: ["()", "Error"] }
```

---

### `extract_call_receiver`

Extracts the receiver/object from method call expressions.

**Purpose:** Identifies the object on which a method is being called for method resolution.

**Returns:** `Location` of the receiver object

#### JavaScript/TypeScript Example
```javascript
// Input: user.getName()
extract_call_receiver(call_expression_node)
// Returns: Location of "user"

// Input: this.initialize()
extract_call_receiver(call_expression_node)
// Returns: Location of "this"
```

#### Python Example
```python
# Input: self.process_data()
extract_call_receiver(call_node)
# Returns: Location of "self"

# Input: manager.get_employee(id)
extract_call_receiver(call_node)
# Returns: Location of "manager"
```

#### Rust Example
```rust
// Input: vec.push(item)
extract_call_receiver(call_expression_node)
// Returns: Location of "vec"

// Input: self.validate()
extract_call_receiver(call_expression_node)
// Returns: Location of "self"
```

---

### `extract_property_chain`

Extracts the complete property access chain from member expressions.

**Purpose:** Captures nested property access patterns for deep object navigation.

**Returns:** Array of `SymbolId` representing the chain

#### JavaScript/TypeScript Example
```javascript
// Input: config.database.connection.host
extract_property_chain(member_expression_node)
// Returns: [symbol("config"), symbol("database"), symbol("connection"), symbol("host")]

// Input: window.document.body.style
extract_property_chain(member_expression_node)
// Returns: [symbol("window"), symbol("document"), symbol("body"), symbol("style")]
```

#### Python Example
```python
# Input: app.config.database.url
extract_property_chain(attribute_node)
# Returns: [symbol("app"), symbol("config"), symbol("database"), symbol("url")]

# Input: self.parent.children[0].name
extract_property_chain(attribute_node)
# Returns: [symbol("self"), symbol("parent"), symbol("children"), symbol("name")]
```

#### Rust Example
```rust
// Input: config.server.port
extract_property_chain(field_expression_node)
// Returns: [symbol("config"), symbol("server"), symbol("port")]

// Input: self.inner.data
extract_property_chain(field_expression_node)
// Returns: [symbol("self"), symbol("inner"), symbol("data")]
```

---

### `extract_assignment_parts`

Extracts source and target locations from assignment expressions.

**Purpose:** Tracks data flow through assignments for type inference and usage analysis.

**Returns:** Object with `source` and `target` locations

#### JavaScript/TypeScript Example
```javascript
// Input: const user = getUserById(123)
extract_assignment_parts(variable_declarator_node)
// Returns: {
//   target: Location of "user",
//   source: Location of "getUserById(123)"
// }

// Input: this.name = value
extract_assignment_parts(assignment_expression_node)
// Returns: {
//   target: Location of "this.name",
//   source: Location of "value"
// }
```

#### Python Example
```python
# Input: result = process_data(input)
extract_assignment_parts(assignment_node)
# Returns: {
#   target: Location of "result",
#   source: Location of "process_data(input)"
# }

# Input: x, y = get_coordinates()
extract_assignment_parts(assignment_node)
# Returns: {
#   target: Location of "x, y",
#   source: Location of "get_coordinates()"
# }
```

#### Rust Example
```rust
// Input: let mut count = 0
extract_assignment_parts(let_declaration_node)
// Returns: {
//   target: Location of "count",
//   source: Location of "0"
// }

// Input: self.value = new_value
extract_assignment_parts(assignment_expression_node)
// Returns: {
//   target: Location of "self.value",
//   source: Location of "new_value"
// }
```

---

### `extract_construct_target`

Extracts the target variable from constructor/instantiation expressions.

**Purpose:** Links constructor calls to the variables they initialize.

**Returns:** `Location` of the target variable

#### JavaScript/TypeScript Example
```javascript
// Input: const app = new Application()
extract_construct_target(variable_declarator_node)
// Returns: Location of "app"

// Input: this.logger = new Logger(config)
extract_construct_target(assignment_expression_node)
// Returns: Location of "this.logger"
```

#### Python Example
```python
# Input: manager = EmployeeManager()
extract_construct_target(assignment_node)
# Returns: Location of "manager"

# Input: self.db = Database(connection_string)
extract_construct_target(assignment_node)
# Returns: Location of "self.db"
```

#### Rust Example
```rust
// Input: let server = Server::new()
extract_construct_target(let_declaration_node)
// Returns: Location of "server"

// Input: let mut vec = Vec::with_capacity(100)
extract_construct_target(let_declaration_node)
// Returns: Location of "vec"
```

---

### `extract_type_arguments`

Extracts generic type arguments from parameterized types.

**Purpose:** Captures generic type parameters for proper type resolution.

**Returns:** Array of strings representing type arguments

#### JavaScript/TypeScript Example
```typescript
// Input: Map<string, User>
extract_type_arguments(generic_type_node)
// Returns: ["string", "User"]

// Input: Promise<Array<number>>
extract_type_arguments(generic_type_node)
// Returns: ["Array<number>"]
```

#### Python Example
```python
# Input: Dict[str, List[int]]
extract_type_arguments(subscript_node)
# Returns: ["str", "List[int]"]

# Input: Optional[User]
extract_type_arguments(subscript_node)
# Returns: ["User"]
```

#### Rust Example
```rust
// Input: HashMap<String, Vec<i32>>
extract_type_arguments(type_arguments_node)
// Returns: ["String", "Vec<i32>"]

// Input: Result<T, E>
extract_type_arguments(type_arguments_node)
// Returns: ["T", "E"]
```

## Language Implementations

### JavaScript/TypeScript
- **File:** `packages/core/src/query_code_tree/language_configs/javascript_metadata.ts`
- **Special Features:**
  - JSDoc type extraction
  - TypeScript type annotations
  - Optional chaining support
  - Destructuring patterns

### Python
- **File:** `packages/core/src/query_code_tree/language_configs/python_metadata.ts`
- **Special Features:**
  - Type hints (PEP 484)
  - Union types with `|` operator (Python 3.10+)
  - `self` and `cls` handling
  - Decorator preservation

### Rust
- **File:** `packages/core/src/query_code_tree/language_configs/rust_metadata.ts`
- **Special Features:**
  - Lifetime annotations
  - Trait bounds
  - Turbofish syntax (`::<T>`)
  - Reference and mutable reference types

## Integration Example

```typescript
import { get_metadata_extractors } from './language_configs';
import { ReferenceBuilder } from '@ariadnejs/types';

function process_references(
  context: ProcessingContext,
  language: Language
): SymbolReference[] {
  const extractors = get_metadata_extractors(language);

  if (!extractors) {
    // Fallback to basic extraction without metadata
    return new ReferenceBuilder(context).process_all().build();
  }

  // Full metadata extraction
  return new ReferenceBuilder(context, extractors)
    .process_all()
    .build();
}
```

## Testing

Each language implementation includes comprehensive test suites:

- **JavaScript:** 57 tests covering all extractor methods
- **TypeScript:** 11 tests for TypeScript-specific features
- **Python:** 69 tests (most comprehensive coverage)
- **Rust:** 51 tests including lifetime and generic handling

Test files follow the pattern: `{language}_metadata.test.ts`

## Extending for New Languages

To add metadata extraction for a new language:

1. Create `{language}_metadata.ts` in `language_configs/`
2. Implement all 6 extractor methods
3. Handle language-specific AST node types
4. Add comprehensive tests
5. Register in `get_metadata_extractors()` function

## Performance Considerations

- Extractors operate on already-parsed AST nodes (no re-parsing)
- Methods return `undefined` for unsupported node types (fail gracefully)
- Minimal memory allocation (reuse existing node references)
- Average extraction time: <1ms per reference

## Common Patterns

### Null Safety
All extractors safely handle null/undefined inputs:
```typescript
if (!node) return undefined;
```

### Node Type Checking
Verify node types before extraction:
```typescript
if (node.type !== 'call_expression') return undefined;
```

### Recursive Traversal
Handle nested structures recursively:
```typescript
function extract_chain(node: SyntaxNode): SymbolId[] {
  if (node.type === 'member_expression') {
    const object_chain = extract_chain(node.childForFieldName('object'));
    // ... continue building chain
  }
}
```

## Future Enhancements

Potential areas for expansion:
- Async/await context extraction
- Exception handling metadata
- Import/export relationship tracking
- Cross-file type resolution hints
- IDE-specific metadata (hover info, quick fixes)