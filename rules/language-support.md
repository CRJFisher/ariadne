# Language Support

## Overview

This tool parses multiple programming languages using tree-sitter. Language-specific features are handled through tree-sitter query patterns.

## Supported Languages

- JavaScript (ES6+)
- TypeScript
- Python
- Rust

## Query-Based Language Handling

### Query Files

Each language has dedicated query files that define patterns for extracting information:

```text
module/queries/
├── javascript.scm    # JavaScript patterns
├── typescript.scm    # TypeScript patterns (extends JS)
├── python.scm        # Python patterns
└── rust.scm          # Rust patterns
```

### Query Pattern Structure

Query patterns use tree-sitter's S-expression syntax to match AST nodes:

```scheme
; Example: Capturing function calls
(call_expression
  function: (identifier) @function.name
  arguments: (arguments) @function.args)
```

## Language-Specific Features

### JavaScript/TypeScript

```scheme
; Arrow functions
(arrow_function
  parameters: (formal_parameters) @params
  body: [(expression) (statement_block)] @body)

; Template literals
(template_string) @template

; Destructuring
(object_pattern) @destructure
```

### Python

```scheme
; Decorators
(decorated_definition
  (decorator) @decorator
  definition: (_) @definition)

; List comprehensions
(list_comprehension
  element: (_) @element
  (for_in_clause) @iteration)

; Type hints
(type
  (identifier) @type.name)
```

### Rust

```scheme
; Macros
(macro_invocation
  macro: (identifier) @macro.name
  (token_tree) @macro.args)

; Lifetime parameters
(lifetime
  "'" @lifetime.tick
  (identifier) @lifetime.name)

; Pattern matching
(match_expression
  (match_block
    (match_arm) @arm))
```

## Adding Language Support

To add support for a new language:

1. **Install tree-sitter parser**

   ```bash
   npm install tree-sitter-[language]
   ```

2. **Create query files**

   ```text
   module/queries/[language].scm
   ```

3. **Define patterns**
   - Study the language's AST structure
   - Write query patterns for required features
   - Test against real code samples

4. **Add fixtures**

   ```text
   module/fixtures/[language]/
   ```

## Query Development Process

### 1. Explore AST Structure

Use tree-sitter playground or CLI to understand node types:

```bash
tree-sitter parse example.js
```

### 2. Write Query Patterns

Create patterns that capture required information:

```scheme
; Capture class definitions
(class_declaration
  name: (identifier) @class.name
  body: (class_body) @class.body)
```

### 3. Test Patterns

Verify patterns against language fixtures:

- Edge cases
- Common patterns
- Language-specific features

## Language Configuration

Modules load and execute queries dynamically:

```typescript
// module_name.ts
const queries = loadQueries(language);
const matches = executeQuery(ast, queries);
const results = processMatches(matches);
```

## Query Best Practices

### Pattern Design

- **Specific**: Target exact node types
- **Flexible**: Handle optional fields with `?`
- **Captured**: Use meaningful capture names

### Performance

- **Focused**: Keep queries narrow in scope
- **Combined**: Merge related patterns
- **Cached**: Reuse compiled queries

### Maintenance

- **Documented**: Comment complex patterns
- **Versioned**: Track parser version compatibility
- **Tested**: Comprehensive fixture coverage

## Language Parity

Ensure consistent feature extraction across languages:

| Feature | JavaScript | TypeScript | Python | Rust |
|---------|------------|------------|--------|------|
| Functions | ✓ | ✓ | ✓ | ✓ |
| Classes | ✓ | ✓ | ✓ | ✓ |
| Methods | ✓ | ✓ | ✓ | ✓ |
| Imports | ✓ | ✓ | ✓ | ✓ |
| Exports | ✓ | ✓ | ✓ | ✓ |
| Types | - | ✓ | ✓ | ✓ |
| Generics | - | ✓ | ✓ | ✓ |

## Testing Requirements

### Query Testing

- Test each query pattern independently
- Verify capture names and values
- Check edge cases and variations

### Cross-Language Testing

- Ensure equivalent features work consistently
- Test language-specific features thoroughly
- Validate against real-world code

## Query File Organization

### Structure

```scheme
; queries/javascript.scm

; ============================================
; Functions
; ============================================

(function_declaration) @function.declaration
(arrow_function) @function.arrow
(function_expression) @function.expression

; ============================================
; Classes
; ============================================

(class_declaration) @class.declaration
(class_expression) @class.expression

; ============================================
; Imports/Exports
; ============================================

(import_statement) @import
(export_statement) @export
```

### Naming Conventions

- Use dot notation for hierarchical captures: `@function.name`
- Group related patterns with comments
- Maintain consistent naming across languages

## Troubleshooting

### Common Issues

1. **Parser version mismatch**: Ensure tree-sitter parser matches query syntax
2. **Missing captures**: Verify node field names in AST
3. **Performance issues**: Optimize query complexity

### Debugging

- Use tree-sitter CLI to test queries
- Log captured nodes during development
- Compare AST structure across languages
