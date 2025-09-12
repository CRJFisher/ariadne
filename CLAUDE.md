# Guidelines

- *never* create "extra" functions/functionality that *might* be used one day. Only create functions that will be wired-in to the top-level functionality.
- outside of an index.ts file, never re-export types from other modules

## Universal Symbol System

### Always Use SymbolId for Identifiers

When working with any identifier (variable, function, class, method, property, etc.), use the universal `SymbolId` type instead of individual name types or raw strings:

```typescript
// ❌ BAD - Don't use individual name types or raw strings
function find_function(name: FunctionName): Function;
function resolve_method(class_name: string, method_name: string): Method;
const symbols = new Map<string, Symbol>();

// ✅ GOOD - Use SymbolId
function find_function(symbol: SymbolId): Function;
function resolve_method(class_symbol: SymbolId, method_symbol: SymbolId): Method;
const symbols = new Map<SymbolId, Symbol>();
```

### Creating SymbolIds

Use the factory functions from `symbol_utils.ts`:

```typescript
import { function_symbol, class_symbol, method_symbol } from '@ariadnejs/types';

// Create symbols with proper context
const funcId = function_symbol('processData', 'src/utils.ts', location);
const classId = class_symbol('MyClass', 'src/classes.ts', location);  
const methodId = method_symbol('getValue', 'MyClass', 'src/classes.ts', location);
```

### Why SymbolId?

- **Eliminates ambiguity**: "getValue" could be a function, method, or property - SymbolId encodes the kind
- **Provides context**: Includes file scope and qualification
- **Type safety**: Branded types prevent mixing different identifier types
- **Consistency**: One type for all identifiers instead of 15+ different types

**Always prefer SymbolId over raw strings or individual name types when dealing with identifiers.**

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

## Code Style Guidelines

### Naming Conventions

- **Functions**: `snake_case` (pythonic style)
- **Variables**: `snake_case`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`
- **Files**: `snake_case.ts`

### Code Structure

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

## Documentation

- Write comments etc in a 'timeless' way i.e. don't make reference to the change process / new architecture / old way of doing thing in any way. The documentation is for how to build things going forward, not as a record of what changes have been made. The namings are focussed on the concepts they describe and shouldn't include any sense of the change being made.

## Critical Reminders

- **Query-first approach**: Use tree-sitter queries for all AST analysis
- **Language parity**: Ensure features work across all supported languages
- **Test everything**: No feature is complete without tests
- **Document patterns**: Comment complex query patterns. All documentation, including comments, is timeless
- **Keep it simple**: Prefer declarative queries over imperative code
