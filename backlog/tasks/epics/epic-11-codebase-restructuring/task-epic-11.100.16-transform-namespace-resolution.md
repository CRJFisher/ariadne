# Task 11.100.16: Transform namespace_resolution to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.16.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.16.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/import_export/namespace_resolution/`
**Files**: 5+ files (~1,000 lines)

- `namespace_resolution.ts` - Core namespace resolver
- Recently refactored to configuration pattern
- Still uses manual traversal
- 100% test coverage achieved

## Current Implementation

### Manual Namespace Resolution

```typescript
function resolve_namespace_imports(node: SyntaxNode) {
  // Namespace imports (import * as ns)
  if (node.type === "import_statement") {
    const importClause = node.childForFieldName("import_clause");
    if (importClause) {
      const namespaceImport = findNamespaceImport(importClause);
      if (namespaceImport) {
        const alias = namespaceImport.childForFieldName("name");
        const source = node.childForFieldName("source");

        return {
          namespace: alias.text,
          source: source.text,
          members: resolveNamespaceMembers(source.text),
        };
      }
    }
  }

  // Namespace member access
  else if (node.type === "member_expression") {
    const object = node.childForFieldName("object");
    if (isNamespaceIdentifier(object)) {
      const property = node.childForFieldName("property");
      return {
        namespace: object.text,
        member: property.text,
        resolved: resolveToExport(object.text, property.text),
      };
    }
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; namespace_resolution_queries.scm

;; JavaScript/TypeScript namespace imports
(import_statement
  (import_clause
    (namespace_import
      (identifier) @namespace.alias))
  source: (string) @namespace.source) @namespace.import

;; TypeScript namespace declarations
(module
  name: (identifier) @namespace.name
  body: (statement_block
    (export_statement
      declaration: (_) @namespace.export))) @namespace.declaration

;; Namespace member access
(member_expression
  object: (identifier) @namespace.ref
  property: (property_identifier) @namespace.member) @namespace.access

;; Python module imports
(import_from_statement
  module_name: (dotted_name) @namespace.module
  (import_alias
    name: (dotted_name) @namespace.import
    alias: (identifier) @namespace.alias)) @namespace.python

;; Python namespace packages
(import_statement
  name: (dotted_name) @namespace.package) @namespace.python.package

;; Python __all__ exports
(assignment
  left: (identifier) @namespace.all
  (#eq? @namespace.all "__all__")
  right: (list
    (string) @namespace.export)) @namespace.python.exports

;; Rust use statements with wildcards
(use_declaration
  argument: (use_wildcard
    (scoped_identifier
      path: (_) @namespace.path))) @namespace.rust.wildcard

;; Rust module declarations
(mod_item
  name: (identifier) @namespace.module
  body: (declaration_list
    (use_declaration) @namespace.use
    (function_item) @namespace.function)) @namespace.rust.module

;; Rust pub use re-exports
(use_declaration
  visibility: (visibility_modifier) @namespace.pub
  argument: (scoped_use_list
    path: (_) @namespace.reexport.path
    list: (use_list
      (scoped_identifier
        name: (identifier) @namespace.reexport.item)))) @namespace.rust.reexport

;; Nested namespace access
(member_expression
  object: (member_expression
    object: (identifier) @namespace.root
    property: (property_identifier) @namespace.nested)
  property: (property_identifier) @namespace.member) @namespace.nested.access

;; Namespace type references
(type_reference
  (qualified_name
    (identifier) @namespace.type.ns
    (type_identifier) @namespace.type.name)) @namespace.type

;; CommonJS namespace patterns
(assignment_expression
  left: (member_expression
    object: (identifier) @namespace.exports
    (#eq? @namespace.exports "exports"))
  right: (call_expression
    function: (identifier) @namespace.require
    (#eq? @namespace.require "require")
    arguments: (arguments
      (string) @namespace.commonjs.source))) @namespace.commonjs
```

### New Implementation

```typescript
export function resolve_namespaces_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): NamespaceResolution {
  const query = loadNamespaceQuery(language);
  const captures = query.captures(tree.rootNode);

  const resolution: NamespaceResolution = {
    imports: new Map(),
    declarations: new Map(),
    accesses: [],
    exports: new Map(),
  };

  // Process namespace imports
  const imports = captures.filter((c) => c.name.includes("namespace.import"));

  for (const importGroup of groupByImport(imports)) {
    const nsImport = extractNamespaceImport(importGroup);
    resolution.imports.set(nsImport.alias, nsImport);
  }

  // Process namespace declarations
  const declarations = captures.filter(
    (c) =>
      c.name.includes("namespace.declaration") ||
      c.name.includes("namespace.module")
  );

  for (const declGroup of groupByDeclaration(declarations)) {
    const nsDecl = extractNamespaceDeclaration(declGroup);
    resolution.declarations.set(nsDecl.name, nsDecl);
  }

  // Process namespace member accesses
  const accesses = captures.filter((c) => c.name.includes("namespace.access"));

  for (const accessGroup of groupByAccess(accesses)) {
    const access = extractNamespaceAccess(accessGroup);

    // Resolve to actual export
    access.resolved = resolveAccess(
      access,
      resolution.imports,
      resolution.exports
    );

    resolution.accesses.push(access);
  }

  return resolution;
}

function extractNamespaceImport(group: QueryCapture[]): NamespaceImport {
  const alias =
    group.find((c) => c.name.includes(".alias"))?.node.text || "unknown";

  const source =
    group.find((c) => c.name.includes(".source"))?.node.text.slice(1, -1) || ""; // Remove quotes

  return {
    alias,
    source,
    isWildcard: true,
    location: group[0].node.startPosition,
  };
}

function resolveAccess(
  access: NamespaceAccess,
  imports: Map<string, NamespaceImport>,
  exports: Map<string, Export[]>
): ResolvedSymbol | null {
  // Find the namespace import
  const nsImport = imports.get(access.namespace);
  if (!nsImport) return null;

  // Find exports from that module
  const moduleExports = exports.get(nsImport.source) || [];

  // Find matching export
  const matchingExport = moduleExports.find(
    (e) => e.name === access.member || e.exportedAs === access.member
  );

  if (matchingExport) {
    return {
      originalName: matchingExport.name,
      exportedAs: matchingExport.exportedAs,
      source: nsImport.source,
      type: matchingExport.type,
    };
  }

  return null;
}
```

## Transformation Steps

### 1. Document Namespace Patterns

- [ ] Namespace imports (\* as)
- [ ] Namespace declarations
- [ ] Member access through namespaces
- [ ] Nested namespaces
- [ ] Re-exports
- [ ] Module patterns

### 2. Create Namespace Queries

- [ ] **Create language-specific .scm files**:
  - `queries/namespace_resolution.javascript.scm` - JS modules, import * as, CommonJS
  - `queries/namespace_resolution.typescript.scm` - TS namespaces, module declarations
  - `queries/namespace_resolution.python.scm` - Python modules, packages, __all__
  - `queries/namespace_resolution.rust.scm` - Rust modules, use wildcards, pub use
- [ ] Import patterns
- [ ] Declaration patterns
- [ ] Access patterns
- [ ] Export patterns
- [ ] Language-specific forms

### 3. Build Resolution System

- [ ] Track namespace imports
- [ ] Map namespace members
- [ ] Resolve member access
- [ ] Handle nested namespaces

### 4. Special Cases

- [ ] Wildcard imports
- [ ] Namespace merging (TS)
- [ ] Module augmentation
- [ ] Dynamic imports
- [ ] CommonJS patterns

## Expected Improvements

### Code Reduction

- **Before**: ~1,000 lines
- **After**: ~100 lines + queries
- **Reduction**: 90%

### Accuracy

- Complete namespace tracking
- Accurate member resolution
- Re-export handling

### Performance

- Single-pass namespace collection
- Efficient member lookup
- Fast resolution

## Success Criteria

### Functional Requirements
- [ ] All namespaces tracked
- [ ] Member access resolved
- [ ] Re-exports handled
- [ ] 90% code reduction
- [ ] 100% test coverage maintained

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

- Related to import_resolution for imports
- Related to export_detection for exports
- Used by symbol_resolution for namespace symbols

## Notes

- Recently achieved 100% test coverage
- Already uses configuration pattern
- TypeScript has complex namespace features
- Python uses module system as namespaces
- Must maintain current test coverage
