# Guidelines

## Tree-sitter Query Development

### Query File Structure

All modules use tree-sitter queries for extracting information from code:

```text
module_name/
├── index.ts              # Public API
├── module_name.ts        # Query execution logic
└── queries/              # Tree-sitter patterns
    ├── javascript.scm    # JavaScript queries
    ├── typescript.scm    # TypeScript queries
    ├── python.scm        # Python queries
    └── rust.scm          # Rust queries
```

### Writing Query Patterns

Use S-expression syntax to match AST patterns:

```scheme
; Capture function declarations
(function_declaration
  name: (identifier) @function.name
  parameters: (formal_parameters) @function.params)

; Capture method calls
(call_expression
  function: (member_expression
    property: (property_identifier) @method.name))
```

### Query Guidelines

- **Capture Names**: Use dot notation for hierarchy (`@function.name`, `@class.body`)
- **Comments**: Document complex patterns with `;` comments
- **Testing**: Test queries against fixtures in all supported languages
- **Performance**: Keep queries focused and specific
- **Language Parity**: Ensure equivalent features across languages

### Query Development Process

1. **Explore AST**: Use `tree-sitter parse` to understand node structure
2. **Write Patterns**: Create .scm files with capture patterns
3. **Test Queries**: Verify against fixtures
4. **Process Results**: Transform captures into structured data

## Code Style Guidelines

### Naming Conventions

- **Functions**: `snake_case` (pythonic style)
- **Variables**: `snake_case`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`
- **Files**: `snake_case.ts`

### Code Structure

- **File Size**: Keep files under 32KB (tree-sitter parsing limit)
- **Functional Style**: Prefer pure functions over stateful classes
- **Exports**: Only export what is actually used by external modules
- **Dependencies**: Check existing libraries before adding new ones

### TypeScript Patterns

```typescript
// Good: Pure function with clear types
export function process_ast(node: SyntaxNode, language: Language): Result {
  // Implementation
}

// Avoid: Stateful, mutable classes
class Processor {
  private state: any;
  process() {
    /* ... */
  }
}
```

## Backlog Workflow

### Task Management

1. **Find Task**: `backlog task list --plain`
2. **Start Work**: `backlog task edit <id> -s "In Progress"`
3. **Update Task**: Add implementation notes to task file
4. **Complete**: `backlog task edit <id> -s "Completed"`

### Important Reminders

- **Always use `--plain` flag** for AI-friendly output
- **Read task file first** before starting implementation
- **Create sub-tasks** for follow-up work
- **Document test gaps** in implementation notes

## Testing Requirements

### Coverage

- Write tests for all supported languages (JavaScript, TypeScript, Python, Rust)
- Test query patterns against real code samples
- Verify cross-language consistency

### Test Structure

```text
module_name/
├── module_name.test.ts      # Core functionality
├── fixtures/
│   ├── javascript/          # JS test cases
│   ├── typescript/          # TS test cases
│   ├── python/              # Python test cases
│   └── rust/                # Rust test cases
```

### Testing Approach

- **Fix issues, don't hide them** - Never modify tests to pass
- **Test real scenarios** - Use realistic code samples
- **Document gaps** - Note any untested edge cases

## Module Organization

### Standard Structure

Every module follows this pattern:

```text
src/[category]/[feature]/
├── index.ts              # Exports only
├── [feature].ts          # Core logic with queries
├── queries/              # Language-specific patterns
│   ├── javascript.scm
│   ├── typescript.scm
│   ├── python.scm
│   └── rust.scm
└── [feature].test.ts     # Comprehensive tests
```

### Query Integration

```typescript
// Load and execute queries
const queryText = readFileSync(`queries/${language}.scm`);
const query = new Query(getLanguage(language), queryText);
const matches = query.matches(ast.rootNode);

// Process results
const results = processMatches(matches);
```

## Development Best Practices

### Query Development

- Start with common patterns across languages
- Add language-specific patterns as needed
- Test queries incrementally
- Cache compiled queries for performance

### Code Quality

- Keep modules focused on single responsibility
- Write self-documenting code
- Add tests before marking tasks complete
- Review changes for consistency with architecture

### Documentation

- Write comments etc in a 'timeless' way i.e. don't make reference to the change process / new architecture / old way of doing thing in any way. The documentation is for how to build things going forward, not as a record of what changes have been made.

## Critical Reminders

- **Query-first approach**: Use tree-sitter queries for all AST analysis
- **Language parity**: Ensure features work across all supported languages
- **Test everything**: No feature is complete without tests
- **Document patterns**: Comment complex query patterns. All documentation, including comments, is timeless
- **Keep it simple**: Prefer declarative queries over imperative code
