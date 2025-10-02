# Guidelines

## Project Layout / Intention Tree

- the top of the intention tree (the actual purpose of this codebase) is to detect call graphs and thereby find the entry point to the codebase.
- every change to the code needs to be justified in terms of its contribution to the top-level intention tree.
- the module layout is the instantiation of the intention tree.
- we _never_ add 'extra' functionality outside of this intention tree, even if it is 'well-meaning' and 'might' be used one day. 'extra', surplus code reduces our longterm velocity. it is much better to spend effort reviewing narrow, focussed code and its integration, rather than trying to cover a wide surface area.
- all namings and documentation should _only_ reflect the trunk and branches of the intention tree, not the 'differential' changes we make to the codebase. E.g. if we're changing 'method_resolution.ts', we don't just create a file like 'enhanced_method_resolution.ts', we just improve 'method_resolution.ts', leaving the core intention tree intact.

### Core

- `packages/core/src/index_single_file`
  - builds the semantic index for a single file
  - build definitions including symbol-ids which are globally unique
  - builds references including symbol-names which are unique within a scope
  - builds scopes including lexical scope relationships
  - build type information including type bindings and type members TODO: verify these details
- `packages/core/src/resolve_references`
  - resolves references to symbols, matching symbol-names to symbol-ids
  - resolves symbols by name and scope - start at the bottom of the scope tree and work up i.e. lexical scope resolution
  - .... on-demand resolution
- `packages/core/src/trace_call_graph`
  - detects the call graph of a codebase
  - uses the semantic index and resolve_references to find the entry points to the codebase caller scopes that are never called (internally)

## Universal Symbol System

### Always Use SymbolId for Identifiers

When working with any identifier (variable, function, class, method, property, etc.), use the universal `SymbolId` type instead of individual name types or raw strings:

### Creating SymbolIds

Use the factory functions from `symbol.ts`:

```typescript
import { function_symbol, class_symbol, method_symbol } from '@ariadnejs/types';

// Create symbols with proper context
const funcId = function_symbol('processData', 'src/utils.ts', location);
const classId = class_symbol('MyClass', 'src/classes.ts', location);
const methodId = method_symbol('getValue', 'MyClass', 'src/classes.ts', location);
...
```

## Code Style Guidelines

### Naming Convention - pythonic

- **Functions**: `snake_case`
- **Variables**: `snake_case`
- **Constants**: `UPPER_SNAKE_CASE`
- **Classes/Interfaces**: `PascalCase`
- **Files**: `snake_case.ts`

### Code Structure

- **Functional Style**: Prefer pure functions over stateful classes
- **Exports**: Only export what is actually used by external modules
- **Dependencies**: Check existing libraries before adding new ones

## Backlog Workflow

USE BACKLOG WHENEVER 'TASK's ARE MENTIONED.

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

### Test Structure

```text
module_name/
├── module_name.ts      # Core functionality
├── module_name.test.ts # Core functionality tests
```

### Testing Approach

- **Fix issues, don't hide them** - Never modify tests to pass
- **Test real scenarios** - Use realistic code samples
- **Document gaps** - Note any untested edge cases
