# Task 11.100.3: Transform export_detection to Tree-sitter Queries

## Parent Task
11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.3.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.3.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview
**Location**: `src/import_export/export_detection/`
**Files**: 7+ files (~1,500 lines)
- `export_detection.ts` - Generic processor
- `export_detection.javascript.ts` - ES6/CommonJS
- `export_detection.typescript.ts` - TS-specific
- `export_detection.python.ts` - Python __all__
- `export_detection.rust.ts` - Rust pub
- `export_extraction.ts` - Core logic

## Current Implementation

### Complex Manual Logic
```typescript
function extract_exports(node: SyntaxNode) {
  // ES6 named exports
  if (node.type === 'export_statement') {
    const declaration = node.childForFieldName('declaration');
    const specifiers = node.childForFieldName('specifiers');
    // ... complex extraction
  }
  // CommonJS exports
  else if (node.type === 'assignment_expression') {
    const left = node.childForFieldName('left');
    if (left?.text?.startsWith('exports.') || 
        left?.text === 'module.exports') {
      // ... extract CommonJS
    }
  }
}
```

## New Type Creation Functions

Use these functions from `import_export_types.ts` to create exports:

- `createNamedExport()` - For named exports
- `createDefaultExport()` - For default exports
- `createNamespaceExport()` - For namespace exports
- `createReExport()` - For re-exports
- `createAggregateExport()` - For aggregate exports

Example:
```typescript
const namedExport = createNamedExport(
  [{ name: toSymbolName('foo'), alias: toSymbolName('bar') }],
  location,
  'javascript'
);
```

## Query-Based Implementation

### Tree-sitter Query Pattern
```scheme
;; export_queries/javascript.scm

;; ES6 named export
(export_statement
  (export_specifier
    name: (identifier) @export.named.local
    alias: (identifier)? @export.named.exported))

;; ES6 default export
(export_statement
  (export_default_specifier) @export.default)

;; ES6 export declaration
(export_statement
  declaration: (function_declaration
    name: (identifier) @export.function))

(export_statement
  declaration: (class_declaration
    name: (identifier) @export.class))

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @export.variable)))

;; CommonJS exports.x = 
(assignment_expression
  left: (member_expression
    object: (identifier) @_exports (#eq? @_exports "exports")
    property: (property_identifier) @export.commonjs.name)
  right: (_) @export.commonjs.value)

;; CommonJS module.exports =
(assignment_expression
  left: (member_expression
    object: (identifier) @_module (#eq? @_module "module")
    property: (property_identifier) @_exports (#eq? @_exports "exports"))
  right: (_) @export.commonjs.default)

;; Re-exports
(export_statement
  source: (string) @export.reexport.source
  (export_specifier
    name: (identifier) @export.reexport.name))

;; Python __all__
(assignment
  left: (identifier) @_all (#eq? @_all "__all__")
  right: (list
    (string) @export.python.public))

;; Rust pub items
(function_item
  visibility_modifier: (visibility_modifier) @_pub
  name: (identifier) @export.rust.function)
```

### New Implementation
```typescript
export function extract_exports_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): ExportInfo[] {
  const query = loadExportQuery(language);
  const captures = query.captures(tree.rootNode);
  
  // Group by export statement
  const exportGroups = groupExportCaptures(captures);
  
  return exportGroups.map(group => {
    const type = determineExportType(group);
    
    return {
      name: extractExportName(group),
      type,
      source: extractReexportSource(group),
      isDefault: type === 'default',
      location: group[0].node.startPosition
    };
  });
}
```

## Transformation Steps

### 1. Document Export Patterns
- [ ] ES6 named, default, declaration exports
- [ ] CommonJS exports/module.exports
- [ ] Re-exports patterns
- [ ] Python __all__ exports
- [ ] Rust pub visibility
- [ ] TypeScript export types

### 2. Create Export Queries
- [ ] **Create language-specific .scm files**:
  - `queries/export_detection.javascript.scm` - ES6 exports, CommonJS patterns
  - `queries/export_detection.typescript.scm` - TS export types, interfaces, namespaces
  - `queries/export_detection.python.scm` - Python __all__, module-level exports
  - `queries/export_detection.rust.scm` - Rust pub visibility, use re-exports
- [ ] Cover all export variations
- [ ] Handle edge cases (export * from)
- [ ] Capture metadata (async, const, etc.)

### 3. Build Export Processor
- [ ] Group related captures
- [ ] Determine export types
- [ ] Extract names and aliases
- [ ] Handle re-exports

## Expected Improvements

### Code Reduction
- **Before**: ~1,500 lines
- **After**: ~150 lines + queries
- **Reduction**: 90%

### Accuracy
- Catches complex patterns like destructured exports
- Handles all CommonJS variations

## Success Criteria

### Functional Requirements
- [ ] All export types detected
- [ ] Re-exports properly tracked
- [ ] CommonJS/ES6 both work
- [ ] 90% code reduction

### Quality Gates (MANDATORY)

**All quality gates are defined in the required subtasks:**

- [ ] **100% test coverage achieved** (Task 11.100.X.1)
- [ ] **All tests passing** (Task 11.100.X.1)  
- [ ] **Zero TypeScript compilation errors** (Task 11.100.X.2)
- [ ] **Zero TypeScript warnings** (Task 11.100.X.2)
- [ ] **Performance improvement validated** (queries faster than manual)
- [ ] **Real-world accuracy confirmed** (corpus/ validation passes)
- [ ] **All language-specific .scm files created and tested**
