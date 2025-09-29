# Type Resolution Test Fixtures

This directory contains test fixtures for the type resolution module. These files provide real-world code examples for testing type extraction, inheritance resolution, and cross-file type tracking.

## Fixture Files

### typescript_classes.ts
TypeScript test fixture with:
- Interface definitions (IService, ILogger)
- Class inheritance chain (BaseClass → DerivedClass → GrandchildClass)
- Multiple interface implementation
- Generic classes (GenericContainer<T>)
- Type aliases and union types
- Method overrides and static methods

### python_classes.py
Python test fixture with:
- Class inheritance with type hints
- Abstract base classes (ABC)
- Multiple inheritance
- Property decorators (@property, @setter)
- Class methods and static methods
- Generic classes (Generic[T])
- Complex type annotations (List, Dict, Optional, Union)

### javascript_classes.js
JavaScript test fixture with:
- JSDoc type annotations
- Class inheritance (ES6 classes)
- Mixin patterns
- Getters and setters
- Async methods with Promise returns
- Template/generic functions
- Factory functions with union return types

### rust_types.rs
Rust test fixture with:
- Trait definitions with associated types
- Generic structs with multiple type parameters
- Trait implementations
- Lifetime parameters
- Enums with variants
- Type aliases
- Associated functions and constants
- Macro-generated types

## Usage in Tests

These fixtures should be parsed to create `LocalTypeExtraction` data that can be fed into the type resolution pipeline:

```typescript
import { parse_typescript } from "../../../parsers";
import { extract_local_types } from "../extract_local_types"; // future implementation

const code = await readFile("fixtures/typescript_classes.ts");
const tree = parse_typescript(code);
const localTypes = extract_local_types(tree, "typescript");
```

## Test Scenarios

Each fixture is designed to test specific type resolution scenarios:

1. **Inheritance Chain Resolution**: Base → Derived → Grandchild
2. **Interface Implementation**: Classes implementing multiple interfaces
3. **Member Resolution**: Inherited vs. own members
4. **Override Detection**: Methods that override parent implementations
5. **Static Members**: Class-level methods and properties
6. **Generic Type Resolution**: Classes and functions with type parameters
7. **Type Aliases**: Resolving type aliases to their definitions
8. **Cross-File References**: Types imported from other modules