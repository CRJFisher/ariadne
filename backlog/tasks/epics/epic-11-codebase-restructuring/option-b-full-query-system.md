# Option B: Full Query-Based System Architecture

## Executive Summary

Transform the entire codebase from manual AST traversal to Tree-sitter queries. This would reduce code by ~85% (from ~22,000 to ~3,000 lines) while improving performance 10-100x and accuracy.

## Current vs Future Architecture

### Current: Module-by-Module Manual Traversal
```
file_analyzer.ts
├── build_scope_tree()      → 2,000+ lines manual traversal
├── extract_imports()        → 1,500+ lines manual traversal  
├── extract_exports()        → 1,200+ lines manual traversal
├── find_class_definitions() → 800+ lines manual traversal
├── find_function_calls()    → 1,000+ lines manual traversal
├── find_method_calls()      → 1,200+ lines manual traversal
└── find_constructor_calls() → 900+ lines manual traversal
```

### Future: Unified Query System
```
file_analyzer.ts
└── analyze_with_queries()
    ├── load_unified_query()     → 1 query file per language
    ├── execute_query()          → 50 lines
    └── build_structures()       → 200 lines per structure type
```

## The Transformation

### Step 1: Create Unified Query Files

Instead of scattered `.scm` files, create comprehensive queries:

```scheme
;; queries/javascript-complete.scm

;; ============= SCOPES =============
(function_declaration) @scope.function
(arrow_function) @scope.arrow
(class_body) @scope.class
(block_statement) @scope.block

;; ============= IMPORTS =============
(import_statement 
  source: (string) @import.source
  (import_specifier
    imported: (identifier) @import.named.source
    local: (identifier) @import.named.local))

(import_statement
  (namespace_import (identifier) @import.namespace))

(call_expression
  function: (identifier) @_require (#eq? @_require "require")
  arguments: (arguments (string) @import.commonjs))

;; ============= EXPORTS =============  
(export_statement
  declaration: (function_declaration
    name: (identifier) @export.function))

(export_statement
  (export_specifier
    name: (identifier) @export.named))

;; ============= CLASSES =============
(class_declaration
  name: (identifier) @class.name
  superclass: (identifier)? @class.extends
  body: (class_body
    (method_definition
      key: (property_identifier) @class.method)))

;; ============= FUNCTION CALLS =============
(call_expression
  function: (identifier) @call.function
  arguments: (arguments) @call.args)

;; ============= METHOD CALLS =============
(call_expression
  function: (member_expression
    object: (_) @call.method.receiver
    property: (property_identifier) @call.method.name))

;; ============= VARIABLES =============
(variable_declarator
  name: (identifier) @variable.name
  value: (_)? @variable.init)

;; ============= TYPES (TypeScript) =============
(type_annotation
  (type_identifier) @type.annotation)
```

### Step 2: Single Extraction Function

```typescript
// src/analysis/query_analyzer.ts

export async function analyze_file_with_queries(
  file: { source_code: string; language: Language; file_path: string }
): Promise<FileAnalysis> {
  // Parse once
  const parser = getParser(file.language);
  const tree = parser.parse(file.source_code);
  
  // Load unified query
  const querySource = await loadUnifiedQuery(file.language);
  const query = new Parser.Query(parser.getLanguage(), querySource);
  
  // Execute query once
  const captures = query.captures(tree.rootNode);
  
  // Build all structures from captures
  return {
    scopes: buildScopes(captures.filter(c => c.name.startsWith('scope'))),
    imports: buildImports(captures.filter(c => c.name.startsWith('import'))),
    exports: buildExports(captures.filter(c => c.name.startsWith('export'))),
    classes: buildClasses(captures.filter(c => c.name.startsWith('class'))),
    functions: buildFunctions(captures.filter(c => c.name.startsWith('function'))),
    calls: buildCalls(captures.filter(c => c.name.startsWith('call'))),
    variables: buildVariables(captures.filter(c => c.name.startsWith('variable'))),
    types: buildTypes(captures.filter(c => c.name.startsWith('type')))
  };
}
```

### Step 3: Structure Builders (Simple!)

```typescript
// Each builder is now trivial
function buildImports(captures: QueryCapture[]): ImportInfo[] {
  const imports = new Map<number, ImportInfo>();
  
  for (const capture of captures) {
    const [_, type, field] = capture.name.split('.');
    const importId = capture.node.parent?.id || capture.node.id;
    
    if (!imports.has(importId)) {
      imports.set(importId, {
        source: '',
        imported: [],
        location: nodeToLocation(capture.node)
      });
    }
    
    const imp = imports.get(importId)!;
    
    switch(field) {
      case 'source':
        imp.source = getText(capture.node);
        break;
      case 'namespace':
        imp.imported.push({ name: getText(capture.node), isNamespace: true });
        break;
      case 'named':
        imp.imported.push({ name: getText(capture.node), isNamed: true });
        break;
    }
  }
  
  return Array.from(imports.values());
}
```

## Code Reduction Analysis

### Current Codebase
- `scope_tree/`: ~2,500 lines
- `import_resolution/`: ~2,000 lines  
- `export_detection/`: ~1,500 lines
- `class_detection/`: ~1,000 lines
- `function_calls/`: ~1,500 lines
- `method_calls/`: ~1,800 lines
- `constructor_calls/`: ~1,200 lines
- `symbol_resolution/`: ~2,000 lines
- `type_tracking/`: ~3,000 lines
- Configuration files: ~2,000 lines
- **Total: ~20,000+ lines**

### Query-Based System
- Query files (4 languages): ~2,000 lines
- Query executor: ~200 lines
- Structure builders: ~800 lines (100-200 each)
- File analyzer: ~200 lines
- **Total: ~3,200 lines**

### Reduction: 85% less code!

## Additional Benefits

### 1. Single Source of Truth
- ALL patterns in `.scm` files
- No scattered node type checks
- Easy to see what's being extracted

### 2. Performance
- Parse tree once
- Execute query once  
- Build all structures in single pass
- 10-100x faster than recursive traversal

### 3. Consistency
- Same patterns everywhere
- No module-specific bugs
- Uniform extraction logic

### 4. Extensibility
- Add new pattern: Edit `.scm` file
- Add new capture: Add builder case
- No code changes needed

### 5. Language Parity
- Each language has complete query file
- Easy to ensure feature parity
- Clear what each language supports

## Migration Path

### Phase 1: Parallel Implementation (1-2 weeks)
1. Create unified query files
2. Build query analyzer
3. Run alongside current system
4. Compare outputs

### Phase 2: Validation (1 week)
1. Test on large codebases
2. Fix pattern differences
3. Benchmark performance
4. Verify accuracy

### Phase 3: Replacement (1 week)
1. Replace file_analyzer internals
2. Remove old modules
3. Clean up unused code
4. Update tests

### Phase 4: Optimization (ongoing)
1. Optimize query patterns
2. Add caching layer
3. Incremental updates
4. Stream processing

## Risks and Mitigations

### Risk 1: Pattern Differences
**Mitigation**: Extensive testing, gradual rollout

### Risk 2: Query Complexity
**Mitigation**: Start simple, add patterns gradually

### Risk 3: Debugging Difficulty
**Mitigation**: Query visualization tools, capture logging

### Risk 4: Language Differences  
**Mitigation**: Language-specific query sections

## Conclusion

Option B represents a fundamental architectural shift that would:
- Reduce codebase by 85%
- Improve performance 10-100x
- Increase accuracy and consistency
- Make the system vastly more maintainable

This is not just an optimization - it's a complete reimagining of how code analysis should work.