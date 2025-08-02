# Cross-File Method Resolution in Ariadne

This document explains the current state of cross-file method resolution in Ariadne, including what works, what doesn't, and the technical reasons behind current limitations.

## Overview

Cross-file method resolution refers to the ability to track method calls on objects whose classes are defined in different files. For example:

```typescript
// file: graph.ts
export class ScopeGraph {
  insert_global_def(def: string) {
    console.log("Inserting", def);
  }
}

// file: builder.ts
import { ScopeGraph } from "./graph";

export function build_scope_graph() {
  const graph = new ScopeGraph();
  graph.insert_global_def("def");  // This method call should be linked to the definition in graph.ts
}
```

## Current Implementation

### What Works ✅

1. **Method Reference Capture**: The tree-sitter queries successfully capture method references in all supported languages (TypeScript, JavaScript, Python, Rust).

2. **Same-File Method Resolution**: When a class and its method calls are in the same file, the resolution works correctly:

```typescript
class Calculator {
  add(a: number, b: number) {
    return a + b;
  }
}

function compute() {
  const calc = new Calculator();
  const result = calc.add(5, 3);  // This is correctly resolved
}
```

3. **Reference Storage**: All references, including unresolved method references, are now stored in the scope graph for potential future resolution.

4. **Import-Aware Constructor Tracking** (NEW): The system now tracks types for imported class instances:

```typescript
// file: logger.ts
export class Logger {
  log(message: string) { /* ... */ }
}

// file: app.ts
import { Logger } from "./logger";
// or with rename:
import { Logger as Log } from "./logger";

function useLogger() {
  const logger = new Logger();  // Type tracked across files
  logger.log("Hello");          // ✅ Now resolved correctly
}
```

### What Doesn't Work ❌

1. **Type Tracking Through Function Returns**: Type information is not preserved when objects are returned from functions:

```typescript
function createLogger() {
  return new Logger();  // Return type not tracked
}

function useLogger() {
  const logger = createLogger();
  logger.log("Hello");  // ❌ Not resolved
}
```

2. **Parameter Type Tracking**: Type information for function parameters is not tracked:

```typescript
function processLogger(logger: Logger) {
  logger.log("Processing");  // ❌ Not resolved
}
```

3. **Language-Specific Type Tracking**: Some language-specific patterns like Python's `self` parameter are not yet handled.

## Technical Architecture

### How Method Resolution Works

1. **Method Reference Capture**: Tree-sitter queries identify method calls using patterns like:
   ```
   (call_expression
     function: (member_expression
       object: (identifier) @object
       property: (property_identifier) @local.reference.method))
   ```

2. **Type Tracking**: When processing a function, the system tracks variable types:
   ```typescript
   // When we see: const calc = new Calculator()
   // We track: variableTypes.set("calc", { className: "Calculator", classDef: ... })
   ```

3. **Method Resolution**: When encountering a method call:
   - First attempts direct resolution (for local definitions)
   - If that fails, checks if it's a method call on a typed variable
   - Looks up the variable's type and searches for the method in the class

### Why Cross-File Resolution Fails

The current implementation has several architectural limitations:

1. **Function-Scoped Type Tracking**: The `variableTypes` map is local to the `get_calls_from_definition` function, meaning type information is lost between function calls.

2. **Sequential Processing**: Files and functions are processed independently without sharing type information.

3. **No Persistent Type State**: There's no mechanism to store and retrieve type information across file boundaries.

## Example Scenarios

### Scenario 1: Same File (Works ✅)

```typescript
// All in one file
class Logger {
  log(message: string) {
    console.log(message);
  }
}

function useLogger() {
  const logger = new Logger();
  logger.log("Hello");  // ✅ Resolved correctly
}
```

**Result**: The `log` method is correctly linked to its definition, and it doesn't appear as a top-level node.

### Scenario 2: Cross-File Import (Doesn't Work ❌)

```typescript
// logger.ts
export class Logger {
  log(message: string) {
    console.log(message);
  }
}

// app.ts
import { Logger } from "./logger";

function useLogger() {
  const logger = new Logger();
  logger.log("Hello");  // ❌ Not resolved
}
```

**Result**: The `log` method appears as a top-level node because the system can't track that `logger` is an instance of the imported `Logger` class.

### Scenario 3: Variable Passed Between Functions (Doesn't Work ❌)

```typescript
// Even in the same file
class Database {
  query(sql: string) { /* ... */ }
}

function createDb() {
  return new Database();
}

function useDb() {
  const db = createDb();
  db.query("SELECT *");  // ❌ Not resolved
}
```

**Result**: Type information is lost when the instance is created in one function and used in another.

## Proposed Solutions

### Short-term Improvements

1. **File-Level Type Cache**: Maintain type information at the file level rather than function level.

2. **Import-Aware Constructor Tracking**: When resolving constructors, check if the class is imported and maintain that connection.

### Long-term Architecture Changes

1. **Two-Pass Analysis**:
   - First pass: Collect all type information and imports
   - Second pass: Resolve method calls using collected type data

2. **Global Type Registry**: Maintain a project-wide registry of variable types that can be queried across file boundaries.

3. **Type Inference Engine**: Implement basic type inference to track variables through assignments and function returns.

## Impact on Users

### Current Limitations Users Will Experience

1. **Incomplete Call Graphs**: Methods on imported classes appear as top-level nodes (never called).

2. **Missing Dependencies**: The call graph won't show connections between functions that call methods on imported objects.

3. **Inaccurate Metrics**: "Unused function" detection will have false positives for methods on exported classes.

### Workarounds

Currently, there are no user-facing workarounds. The limitation is architectural and requires code changes to fix.

## Related Tasks

### Type Tracking Implementation Tasks

- **Task 65**: Implement file-level variable type tracking
  - First step: Move type tracking from function scope to file scope
  - Enables type persistence across function boundaries

- **Task 66**: Connect import resolution with constructor type tracking
  - Integrate import system with type tracking
  - Enable tracking of imported class instances

- **Task 67**: Implement cross-file type registry for method resolution
  - Create project-wide type registry
  - Core task for enabling cross-file method resolution

- **Task 68**: Add type inference for function returns and parameters
  - Track types through function calls and returns
  - Enables method chaining and parameter type flow

- **Task 69**: Implement two-pass analysis for comprehensive type resolution
  - Architectural change to collect types first, then resolve
  - Alternative approach to incremental type tracking

### Related Infrastructure Tasks

- **Task 28**: Implement proper module path resolution for imports
  - Would improve import resolution but doesn't solve the type tracking issue
  - Not a blocker for cross-file method resolution

- **Task 30**: Implement proper export detection
  - Related to identifying which functions are truly exported
  - Complementary but separate concern

- **Task 43**: Add polymorphic call resolution to call graph API
  - Builds on top of basic type tracking (tasks 65-68)
  - Handles interface/abstract class resolution

## Testing

The codebase includes comprehensive tests demonstrating both working and non-working scenarios:

- `test("detects method calls on local variable instances within same file")` - Passes ✅
- `test.skip("cross-file method resolution for TypeScript")` - Skipped ❌
- `test.skip("cross-file method resolution for JavaScript")` - Skipped ❌
- `test.skip("cross-file method resolution for Python")` - Skipped ❌
- `test.skip("cross-file method resolution for Rust")` - Skipped ❌

## Future Development

To fully implement cross-file method resolution, we need:

1. Refactor type tracking to persist beyond function boundaries
2. Integrate import resolution with type tracking
3. Implement a more sophisticated symbol resolution system
4. Consider adopting language-specific type inference strategies

The current implementation provides a solid foundation by correctly capturing method references and handling same-file scenarios. The architecture is extensible and can be enhanced incrementally.