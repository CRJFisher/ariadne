# Language Configuration Guide

This guide explains how to add support for new programming languages to the tree-sitter scope resolution system.

## Table of Contents

1. [Overview](#overview)
2. [Language Configuration Structure](#language-configuration-structure)
3. [Step-by-Step Guide](#step-by-step-guide)
4. [Configuration Reference](#configuration-reference)
5. [Testing Your Language](#testing-your-language)
6. [Examples](#examples)

## Overview

Adding a new language requires:

1. A tree-sitter parser for the language
2. Scope queries (`.scm` file) defining what to capture
3. Language configuration mapping symbol kinds
4. Tests to verify the implementation

### File Structure

Per the [Architecture](./Architecture.md) document, language support follows feature-based organization:

```
src/[feature]/[sub-feature]/
├── index.ts                      # Feature dispatcher with language routing
├── common.ts                     # Shared logic across languages
├── [feature].javascript.ts      # JavaScript implementation
├── [feature].python.ts           # Python implementation
├── [feature].rust.ts            # Rust implementation
├── test.contract.ts             # Test contract all languages must implement
└── [feature].[language].test.ts # Language-specific tests
```

## Language Configuration Structure

### LanguageConfig Interface

```typescript
interface LanguageConfig {
  name: string;              // Language identifier
  parser: Parser.Language;   // Tree-sitter parser
  scope_query: string;       // Query string from .scm file
  namespaces: string[][];    // Symbol kind mappings
}
```

### Namespaces

Namespaces define the valid symbol kinds for the language:

```typescript
namespaces: [
  // Namespace 0: Type-like symbols
  ["class", "interface", "type", "enum"],
  
  // Namespace 1: Value-like symbols
  ["function", "variable", "constant", "parameter"],
  
  // Namespace 2: Member-like symbols
  ["method", "property", "field"]
]
```

## Step-by-Step Guide

### Step 1: Install Tree-sitter Parser

```bash
npm install tree-sitter-python
```

### Step 2: Add Language to Feature Implementations

For each feature that should support the new language, add a language-specific implementation file following the Architecture patterns:

```bash
# Example: Adding Python support to function_calls feature
touch src/call_graph/function_calls/function_calls.python.ts
touch src/call_graph/function_calls/function_calls.python.test.ts
```

### Step 3: Write Language Adapter

Create `src/languages/python/scopes.scm`:

```scheme
;; Scopes
[
  (block)
  (function_definition)
  (class_definition)
  (for_statement)
  (while_statement)
  (with_statement)
] @local.scope

;; Function definitions
(function_definition
  name: (identifier) @local.definition.function)

;; Class definitions
(class_definition
  name: (identifier) @local.definition.class)

;; Variable assignments
(assignment
  left: (identifier) @local.definition.variable)

;; Parameters
(parameters
  (identifier) @local.definition.parameter)

;; Imports
(import_statement
  name: (dotted_name
    (identifier) @local.import))

(import_from_statement
  name: (dotted_name
    (identifier) @local.import))

;; References
(call
  function: (identifier) @local.reference)

(identifier) @local.reference
```

### Step 4: Implement Language Adapter

Following the Architecture's functional paradigm, create the language adapter:

```typescript
// src/call_graph/function_calls/function_calls.python.ts
export function find_python_calls(
  ast: ASTNode,
  metadata: { language: Language, file_path: string },
  common_calls: CallInfo[]
): CallInfo[] {
  // Python-specific call detection
  const python_calls = detect_decorator_calls(ast);
  const method_calls = detect_method_calls(ast);
  
  return [...common_calls, ...python_calls, ...method_calls];
}

function detect_decorator_calls(ast: ASTNode): CallInfo[] {
  // Python decorators are function calls
  // Implementation here
}
```

### Step 5: Register in Feature Dispatcher

Update the feature's `index.ts` to include the new language:

```typescript
// src/call_graph/function_calls/index.ts
import { find_python_calls } from './function_calls.python';

const call_finders = {
  javascript: find_javascript_calls,
  typescript: find_javascript_calls,
  python: find_python_calls,  // Add new language
  rust: find_rust_calls
};

export function find_function_calls(
  ast: ASTNode,
  metadata: { language: Language, file_path: string }
): CallInfo[] {
  const common_calls = find_common_calls(ast, metadata);
  const finder = call_finders[metadata.language];
  return finder ? finder(ast, metadata, common_calls) : common_calls;
}
```

### Step 6: Write Tests

Create `src/languages/python/python.test.ts`:

```typescript
import { Project } from '../../index';

describe('Python language support', () => {
  let project: Project;
  
  beforeEach(() => {
    project = new Project();
  });
  
  test('function definitions and calls', () => {
    const code = `
def greet(name):
    return f"Hello, {name}"

message = greet("World")
`;
    
    project.add_or_update_file('test.py', code);
    
    // Test function definition
    const greetDef = project.go_to_definition('test.py', { row: 4, column: 10 });
    expect(greetDef?.name).toBe('greet');
    expect(greetDef?.symbol_kind).toBe('function');
    
    // Test function reference
    const greetRefs = project.find_references('test.py', { row: 1, column: 4 });
    expect(greetRefs.length).toBe(1);
  });
  
  test('class definitions', () => {
    const code = `
class Animal:
    def __init__(self, name):
        self.name = name
    
    def speak(self):
        pass

dog = Animal("Rex")
`;
    
    project.add_or_update_file('test.py', code);
    
    // Test class definition
    const animalDef = project.go_to_definition('test.py', { row: 8, column: 6 });
    expect(animalDef?.name).toBe('Animal');
    expect(animalDef?.symbol_kind).toBe('class');
  });
});
```

## Configuration Reference

### Parser Requirements

The tree-sitter parser must be compatible:

```typescript
import Parser from 'tree-sitter';

const parser = new Parser();
parser.setLanguage(YourLanguage as Parser.Language);
```

### Query Patterns

Common patterns to implement:

#### Scopes
- Function/method bodies
- Class bodies
- Block statements
- Loop bodies
- Conditional blocks

#### Definitions
- Function/method declarations
- Variable declarations/assignments
- Class declarations
- Import statements
- Parameter declarations

#### References
- Function calls
- Variable usage
- Property access
- Type references

### Symbol Kinds

Common symbol kinds across languages:

```typescript
// Types
'class', 'interface', 'struct', 'enum', 'type', 'trait'

// Values  
'function', 'variable', 'constant', 'parameter', 'field'

// Members
'method', 'property', 'getter', 'setter'

// Modules
'module', 'namespace', 'package'

// Other
'label', 'macro', 'decorator'
```

## Testing Your Language

### Unit Tests

Test core functionality:

```typescript
describe('Language basics', () => {
  test('creates scopes correctly', () => {
    // Test that scopes are created for functions, classes, etc.
  });
  
  test('captures definitions', () => {
    // Test that all definition types are captured
  });
  
  test('resolves references', () => {
    // Test that references resolve to correct definitions
  });
  
  test('handles imports', () => {
    // Test import resolution if applicable
  });
});
```

### Integration Tests

Test real-world patterns:

```typescript
test('complex nested scopes', () => {
  const code = `
class Outer:
    def method(self):
        def inner():
            x = 1
            def innermost():
                return x  # Should resolve to inner's x
            return innermost
        return inner
`;
  // Test resolution across multiple scope levels
});
```

### Edge Cases

Test language-specific edge cases:

```typescript
test('Python-specific: nonlocal and global', () => {
  const code = `
x = 1  # Global

def outer():
    x = 2  # Outer scope
    
    def inner():
        nonlocal x
        x = 3  # Modifies outer x
    
    inner()
    return x  # Should be 3
`;
  // Test nonlocal resolution
});
```

## Examples

### JavaScript/TypeScript Differences

When similar languages share grammar:

```typescript
// Both use same parser but different configs
const jsConfig: LanguageConfig = {
  name: 'javascript',
  parser: JavaScript,
  scope_query: jsScopes,
  namespaces: [
    ['class'],  // Fewer type kinds than TS
    ['function', 'variable', 'constant', 'parameter'],
    ['method', 'property']
  ]
};

const tsConfig: LanguageConfig = {
  name: 'typescript',
  parser: TypeScript.tsx,
  scope_query: tsScopes,
  namespaces: [
    ['class', 'interface', 'type', 'enum'],  // More type kinds
    ['function', 'variable', 'constant', 'parameter'],
    ['method', 'property']
  ]
};
```

### Language-Specific Features

#### Python: Decorators

```scheme
;; Decorated function
(decorated_definition
  (decorator) @local.reference
  (function_definition
    name: (identifier) @local.definition.function))
```

#### Ruby: Symbols and Methods

```scheme
;; Method definition with symbol
(method
  name: (identifier) @local.definition.method)

;; Symbol literal
(symbol) @local.reference.symbol
```

#### Go: Goroutines and Channels

```scheme
;; Goroutine
(go_statement
  (call_expression
    function: (identifier) @local.reference))

;; Channel operations
(send_statement
  channel: (identifier) @local.reference)
```

### Multi-file Support

For languages with explicit exports:

```typescript
// Python doesn't have explicit exports
// All top-level definitions are implicitly exported
function is_exported(def: Def, graph: ScopeGraph): boolean {
  // Check if definition is at module level
  return graph.get_scope_depth(def) === 1;
}
```

## Troubleshooting

### Common Issues

1. **No matches found**
   - Verify node types match the grammar
   - Use tree-sitter CLI to inspect AST
   - Check query syntax

2. **Wrong scope hierarchy**
   - Ensure scope nodes are ordered correctly
   - Check scope stack management

3. **Missing definitions**
   - Verify all definition patterns are captured
   - Check for language-specific declaration syntax

4. **Failed resolution**
   - Debug scope chain traversal
   - Verify symbol kinds match

### Debugging Tools

```typescript
// Add to scope-resolution.ts for debugging
function debug_language_config(config: LanguageConfig) {
  console.log(`Language: ${config.name}`);
  console.log(`Namespaces: ${config.namespaces.length}`);
  console.log(`Query length: ${config.scope_query.length}`);
  
  // Test parse
  const parser = new Parser();
  parser.setLanguage(config.parser);
  const tree = parser.parse('test code');
  console.log(`Parse successful: ${tree.rootNode.type}`);
}
```

## Best Practices

1. **Start Simple**: Begin with basic functions and variables
2. **Incremental Testing**: Add features one at a time
3. **Study the Grammar**: Understand the AST structure
4. **Reference Existing Languages**: Learn from similar implementations
5. **Document Quirks**: Note language-specific behaviors

## Resources

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [Grammar Development](https://tree-sitter.github.io/tree-sitter/creating-parsers)
- [Query Syntax Guide](tree-sitter-queries.md)
- [Example Languages](../src/languages/)

## Further Reading

- [Scope Mechanism](scope-mechanism.md)
- [Tree-sitter Queries](tree-sitter-queries.md)
- [API Reference](api-reference.md)