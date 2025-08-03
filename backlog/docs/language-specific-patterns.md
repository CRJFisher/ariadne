# Language-Specific Patterns

This document describes how Ariadne handles language-specific patterns for implicit instance parameters and method calls.

## Overview

Different programming languages have different conventions for accessing the current instance within methods:
- Python: `self` parameter (and `cls` for classmethods)
- JavaScript/TypeScript: `this` context
- Rust: `self`, `&self`, or `&mut self` parameters

Ariadne tracks these implicit parameters to enable accurate method-to-method call resolution within classes.

## Implementation

### LocalTypeTracker

The `LocalTypeTracker` class (in `project_call_graph.ts`) is responsible for tracking implicit instance parameters within method scopes. It inherits from `FileTypeTracker` and adds method-specific type tracking.

```typescript
class LocalTypeTracker {
  private localTypes = new Map<string, { className: string; classDef?: Def }>();
  
  setVariableType(varName: string, typeInfo: { className: string; classDef?: Def }) {
    this.localTypes.set(varName, typeInfo);
  }
  
  getVariableType(varName: string) {
    return this.localTypes.get(varName) || this.parent.getVariableType(varName);
  }
}
```

### Language-Specific Tracking

#### Python

For Python methods, we track both `self` and `cls` parameters:

```typescript
if (methodDef.file_path.endsWith('.py')) {
  localTypeTracker.setVariableType('self', {
    className: classDef.name,
    classDef: classDefWithRange
  });
  localTypeTracker.setVariableType('cls', {
    className: classDef.name,
    classDef: classDefWithRange
  });
}
```

Python's scope rules (`scopes.scm`) capture:
- Regular methods: `(function_definition)` inside `(class_definition)`
- Decorated methods: `(decorated_definition)` for `@classmethod` and `@staticmethod`

#### JavaScript/TypeScript

For JavaScript and TypeScript, we track the `this` context:

```typescript
if (methodDef.file_path.endsWith('.js') || methodDef.file_path.endsWith('.ts')) {
  localTypeTracker.setVariableType('this', {
    className: classDef.name,
    classDef: classDefWithRange
  });
}
```

Method calls are captured with:
```scm
(call_expression
  function: (member_expression
    object: [(this) (identifier)]
    property: (property_identifier) @local.reference.method))
```

#### Rust

For Rust, we track `self` in its various forms:

```typescript
if (methodDef.file_path.endsWith('.rs')) {
  localTypeTracker.setVariableType('self', {
    className: classDef.name,
    classDef: classDefWithRange
  });
}
```

Rust's scope rules capture impl block methods:
```scm
(impl_item
  (declaration_list
    (function_item
      (identifier) @hoist.definition.method)))
```

And method calls:
```scm
(call_expression 
  function: (field_expression
    value: (self)
    field: (field_identifier) @local.reference.method))
```

## Method Resolution

When resolving method calls, the system:

1. Checks if the call is on an implicit instance parameter (`self`, `this`, `cls`)
2. Looks up the type of that parameter from the LocalTypeTracker
3. Resolves the method within the containing class
4. Creates a proper method call edge in the call graph

## Testing

Each language has specific tests to verify implicit parameter tracking:

- **Python**: Tests for `self` parameter in regular methods and `cls` in classmethods
- **JavaScript/TypeScript**: Tests for `this` context in methods
- **Rust**: Tests for `self` parameter in impl block methods

Example test structure:
```typescript
test("tracks Python self parameter in methods", () => {
  const code = `
class MyClass:
    def helper(self):
        return 42
    
    def main(self):
        result = self.helper()
        return result
`;
  // ... test implementation
});
```

## Known Limitations

1. **Rust**: Method calls through `self` are captured but may require additional resolution logic
2. **Type inference**: The system currently tracks explicit type assignments but doesn't perform full type inference
3. **Cross-file resolution**: Method resolution across files requires import-aware type tracking

## Future Enhancements

1. Support for more language patterns (e.g., Ruby's implicit self, Go's receiver methods)
2. Better handling of method calls through type aliases and generic types
3. Integration with language-specific type systems for more accurate resolution