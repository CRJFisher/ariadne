# Task 11.100.17: Transform usage_finder to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.17.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.17.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/scope_analysis/usage_finder/`
**Files**: 2+ files (~500 lines)

- `index.ts` - Main usage finding logic
- Simple module that finds all usages of a symbol

## Current Implementation

### Manual Usage Finding

```typescript
function find_usages(node: SyntaxNode, symbolName: string): Usage[] {
  const usages: Usage[] = [];

  function traverse(n: SyntaxNode) {
    // Check if this is an identifier matching our symbol
    if (n.type === "identifier" && n.text === symbolName) {
      // Determine usage type based on parent
      const parent = n.parent;
      let usageType: UsageType;

      if (parent.type === "variable_declarator") {
        usageType = "definition";
      } else if (
        parent.type === "assignment_expression" &&
        parent.childForFieldName("left") === n
      ) {
        usageType = "write";
      } else if (parent.type === "update_expression") {
        usageType = "update";
      } else {
        usageType = "read";
      }

      usages.push({
        symbol: symbolName,
        type: usageType,
        location: n.startPosition,
        context: getUsageContext(n),
      });
    }

    // Recurse through children
    for (const child of n.children) {
      traverse(child);
    }
  }

  traverse(node);
  return usages;
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; usage_finder_queries.scm

;; Variable definitions
(variable_declarator
  name: (identifier) @usage.definition) @usage.def

;; Function/method definitions
(function_declaration
  name: (identifier) @usage.definition) @usage.def.function

(method_definition
  name: (property_identifier) @usage.definition) @usage.def.method

;; Class definitions
(class_declaration
  name: (identifier) @usage.definition) @usage.def.class

;; Variable assignments (writes)
(assignment_expression
  left: (identifier) @usage.write
  right: (_) @usage.write.value) @usage.assignment

(assignment_expression
  left: (member_expression
    property: (property_identifier) @usage.write)) @usage.member.write

;; Variable updates
(update_expression
  argument: (identifier) @usage.update
  operator: (_) @usage.update.op) @usage.update.expr

;; Variable reads
(identifier) @usage.read
  (#not-parent-type? @usage.read variable_declarator)
  (#not-parent-type? @usage.read function_declaration)
  (#not-parent-type? @usage.read class_declaration)
  (#not-field? @usage.read left)

;; Member access reads
(member_expression
  property: (property_identifier) @usage.member.read) @usage.member

;; Function/method calls
(call_expression
  function: (identifier) @usage.call) @usage.call.direct

(call_expression
  function: (member_expression
    property: (property_identifier) @usage.call)) @usage.call.method

;; Import usage
(import_specifier
  (identifier) @usage.import) @usage.import.spec

;; Export usage
(export_specifier
  (identifier) @usage.export) @usage.export.spec

;; Type usage (TypeScript)
(type_reference
  (type_identifier) @usage.type) @usage.type.ref

;; Parameter usage
(formal_parameters
  (identifier) @usage.parameter) @usage.param

;; Return statement usage
(return_statement
  (identifier) @usage.return) @usage.return.value

;; Conditional usage
(if_statement
  condition: (identifier) @usage.condition) @usage.conditional

;; Loop usage
(for_statement
  init: (variable_declaration
    (variable_declarator
      name: (identifier) @usage.loop.init))) @usage.loop

;; Python-specific usages
(assignment
  left: (identifier) @usage.write) @usage.python.assign

(call
  function: (identifier) @usage.call) @usage.python.call

;; Rust-specific usages
(let_declaration
  pattern: (identifier) @usage.definition) @usage.rust.let

(reference_expression
  value: (identifier) @usage.reference) @usage.rust.ref
```

### New Implementation

```typescript
export function find_usages_with_queries(
  tree: Parser.Tree,
  source_code: string,
  symbolName: string,
  language: Language
): Usage[] {
  const query = loadUsageQuery(language);

  // Add predicate to match specific symbol
  const symbolQuery = query.withPredicate(`(#eq? @usage.* "${symbolName}")`);

  const captures = symbolQuery.captures(tree.rootNode);
  const usages: Usage[] = [];

  for (const capture of captures) {
    // Skip if not matching our symbol
    if (capture.node.text !== symbolName) continue;

    const usageType = determineUsageType(capture);
    const context = extractUsageContext(capture);

    usages.push({
      symbol: symbolName,
      type: usageType,
      location: capture.node.startPosition,
      context: context,
      scope: findEnclosingScope(capture.node),
      isExported: isExportedUsage(capture),
      isImported: isImportedUsage(capture),
    });
  }

  // Sort by position
  return usages.sort(
    (a, b) =>
      a.location.row - b.location.row || a.location.column - b.location.column
  );
}

function determineUsageType(capture: QueryCapture): UsageType {
  const name = capture.name;

  if (name.includes(".definition") || name.includes(".def")) {
    return "definition";
  } else if (name.includes(".write")) {
    return "write";
  } else if (name.includes(".update")) {
    return "update";
  } else if (name.includes(".call")) {
    return "call";
  } else if (name.includes(".import")) {
    return "import";
  } else if (name.includes(".export")) {
    return "export";
  } else if (name.includes(".type")) {
    return "type";
  } else if (name.includes(".parameter")) {
    return "parameter";
  } else {
    return "read";
  }
}

function extractUsageContext(capture: QueryCapture): UsageContext {
  const parent = capture.node.parent;

  return {
    parentType: parent?.type || "unknown",
    inFunction: isInFunction(capture.node),
    inClass: isInClass(capture.node),
    inLoop: isInLoop(capture.node),
    inCondition: isInCondition(capture.node),
    inReturn: capture.name.includes(".return"),
    inAssignment: capture.name.includes(".assign"),
    inCall: capture.name.includes(".call"),
  };
}

// Find all usages across multiple files
export function find_all_usages_with_queries(
  trees: Map<string, Parser.Tree>,
  symbolName: string,
  language: Language
): Map<string, Usage[]> {
  const allUsages = new Map<string, Usage[]>();

  for (const [filePath, tree] of trees) {
    const source = readFileSync(filePath, "utf8");
    const usages = find_usages_with_queries(tree, source, symbolName, language);

    if (usages.length > 0) {
      allUsages.set(filePath, usages);
    }
  }

  return allUsages;
}
```

## Transformation Steps

### 1. Document Usage Patterns

- [ ] Definitions (variable, function, class)
- [ ] Writes (assignments, updates)
- [ ] Reads (references)
- [ ] Calls (function, method)
- [ ] Imports/exports
- [ ] Type references

### 2. Create Usage Queries

- [ ] **Create language-specific .scm files**:
  - `queries/usage_finder.javascript.scm` - JS identifiers, scopes, destructuring
  - `queries/usage_finder.typescript.scm` - TS identifiers, types, namespaces
  - `queries/usage_finder.python.scm` - Python names, imports, scopes
  - `queries/usage_finder.rust.scm` - Rust identifiers, modules, lifetimes
- [ ] All identifier contexts
- [ ] Usage type detection
- [ ] Context extraction
- [ ] Scope awareness

### 3. Build Usage Finder

- [ ] Symbol matching
- [ ] Usage classification
- [ ] Context extraction
- [ ] Multi-file search

### 4. Special Cases

- [ ] Destructured usages
- [ ] Renamed imports
- [ ] Aliased exports
- [ ] Type vs value usage
- [ ] Shadow definitions

## Expected Improvements

### Code Reduction

- **Before**: ~500 lines
- **After**: ~80 lines + queries
- **Reduction**: 84%

### Accuracy

- All usage types detected
- Context properly extracted
- No false positives

### Performance

- Single-pass search
- No recursive traversal
- Efficient filtering

## Success Criteria

### Functional Requirements
- [ ] All usages found
- [ ] Usage types classified
- [ ] Context extracted
- [ ] 80%+ code reduction
- [ ] Multi-file support

### Quality Gates (MANDATORY)

**All quality gates are defined in the required subtasks:**

- [ ] **100% test coverage achieved** (Task 11.100.X.1)
- [ ] **All tests passing** (Task 11.100.X.1)  
- [ ] **Zero TypeScript compilation errors** (Task 11.100.X.2)
- [ ] **Zero TypeScript warnings** (Task 11.100.X.2)
- [ ] **Performance improvement validated** (queries faster than manual)
- [ ] **Real-world accuracy confirmed** (corpus/ validation passes)
- [ ] **All language-specific .scm files created and tested**
## Dependencies

- Uses scope_tree for scope information
- Related to symbol_resolution for definitions
- Simple standalone module

## Notes

- Critical for refactoring support
- Must handle all usage contexts
- Performance important for large codebases
- Should support incremental updates
- Simple module but widely used
