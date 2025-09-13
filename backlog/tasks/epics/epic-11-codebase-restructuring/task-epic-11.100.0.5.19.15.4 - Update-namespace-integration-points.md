---
id: task-epic-11.100.0.5.19.15.4
title: Update integration points for extract_namespaces function
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['integration', 'documentation', 'api-updates']
dependencies: ['task-epic-11.100.0.5.19.15.1', 'task-epic-11.100.0.5.19.15.2']
parent_task_id: task-epic-11.100.0.5.19.15
priority: low
---

## Description

Update integration points, documentation, and API usage for the new `extract_namespaces` function once it's implemented and compilation errors are fixed.

## Integration Points to Update

### 1. File Analyzer Integration

Update `file_analyzer.ts` to use the new function:

```typescript
// OLD - manual approach or missing functionality
// No namespace extraction or scattered logic

// NEW - integrated approach
import { extract_namespaces } from './import_export/namespace_resolution';

export function analyze_file(
  file_path: FilePath,
  source_code: string,
  language: Language,
  tree: Parser.Tree
): FileAnalysis {
  // ... existing analysis

  // Add namespace extraction
  const namespace_imports = extract_namespaces(
    tree.rootNode,
    source_code,
    language,
    file_path
  );

  return {
    // ... existing properties
    namespace_imports, // Add to FileAnalysis type
  };
}
```

### 2. Import Resolution Integration

Connect with import resolution pipeline:

```typescript
// In import_resolution module
import { extract_namespaces } from '../namespace_resolution';

export function resolve_imports(analysis: FileAnalysis): ResolvedImports {
  const namespace_imports = extract_namespaces(/* ... */);

  // Process namespace imports alongside regular imports
  return {
    regular_imports: resolve_regular_imports(analysis.imports),
    namespace_imports: resolve_namespace_imports(namespace_imports),
  };
}
```

### 3. Module Graph Integration

Update module graph to track namespace dependencies:

```typescript
// In module_graph or project_manager
export function build_module_graph(analyses: FileAnalysis[]): ModuleGraph {
  for (const analysis of analyses) {
    const namespaces = extract_namespaces(/* ... */);

    // Add namespace edges to module graph
    for (const ns of namespaces) {
      graph.add_namespace_dependency(analysis.file_path, ns.source);
    }
  }
}
```

### 4. Symbol Resolution Integration

Connect with symbol resolution for namespace member access:

```typescript
// In scope_analysis/symbol_resolution
import { extract_namespaces } from '../../import_export/namespace_resolution';

export function resolve_symbols(analysis: FileAnalysis): SymbolTable {
  const namespaces = extract_namespaces(/* ... */);

  // Add namespace symbols to symbol table
  const symbol_table = new SymbolTable();

  for (const ns of namespaces) {
    symbol_table.add_namespace(ns.namespace_name, ns.source);
  }

  return symbol_table;
}
```

## API Updates Required

### 1. FileAnalysis Type Extension

```typescript
// In @ariadnejs/types
export interface FileAnalysis {
  // ... existing properties
  namespace_imports?: NamespaceImport[]; // Add this field
}
```

### 2. Analysis Configuration

```typescript
// Add configuration option
export interface AnalysisConfig {
  // ... existing options
  extract_namespaces?: boolean; // Default: true
}
```

### 3. Results Integration

```typescript
// Update analysis results to include namespace information
export interface AnalysisResults {
  // ... existing results
  namespace_count: number;
  namespace_dependencies: Map<ModulePath, NamespaceImport[]>;
}
```

## Documentation Updates

### 1. README Updates

Update main README with namespace extraction capabilities:

```markdown
## Features

- Function and method call tracking
- **Namespace import resolution** ✨ NEW
- Cross-language symbol analysis
- Tree-sitter based parsing
```

### 2. API Documentation

```typescript
/**
 * Extract namespace imports from source code
 *
 * @param root_node - Tree-sitter root node
 * @param source_code - Source code string
 * @param language - Programming language
 * @param file_path - File path for location info
 * @returns Array of namespace import statements
 *
 * @example
 * ```typescript
 * const namespaces = extract_namespaces(
 *   tree.rootNode,
 *   'import * as utils from "./utils";',
 *   'javascript',
 *   'src/app.js'
 * );
 *
 * console.log(namespaces[0].namespace_name); // 'utils'
 * console.log(namespaces[0].source); // './utils'
 * ```
 */
```

### 3. Usage Examples

```typescript
// Example: Basic usage
const parser = new Parser();
parser.setLanguage(JavaScript);
const tree = parser.parse(sourceCode);

const namespaces = extract_namespaces(
  tree.rootNode,
  sourceCode,
  'javascript',
  'src/app.js'
);

// Example: Integration with existing analysis
const analysis = analyze_file(filePath, sourceCode, 'javascript', tree);
const namespaces = analysis.namespace_imports || [];

// Example: Cross-module resolution
for (const ns of namespaces) {
  const resolved = resolve_module_path(ns.source, analysis.file_path);
  console.log(`${ns.namespace_name} -> ${resolved}`);
}
```

## Backwards Compatibility

### Migration Guide

```typescript
// OLD: Manual namespace detection (if it existed)
const namespaces = detect_namespace_imports_manual(node);

// NEW: Tree-sitter based extraction
const namespaces = extract_namespaces(node, code, language, filePath);

// The return type is now standardized Import[] instead of custom types
```

### Deprecation Strategy

- Mark any old namespace detection functions as deprecated
- Provide migration path in JSDoc comments
- Keep old functions for 1-2 versions before removal

## Performance Monitoring

### Metrics to Track

```typescript
// Add performance monitoring
export interface NamespaceExtractionMetrics {
  extraction_time_ms: number;
  namespaces_found: number;
  file_size_bytes: number;
  language: Language;
}

// Integration with performance monitoring
const start = performance.now();
const namespaces = extract_namespaces(/* ... */);
const duration = performance.now() - start;

metrics.record_namespace_extraction({
  extraction_time_ms: duration,
  namespaces_found: namespaces.length,
  file_size_bytes: source_code.length,
  language
});
```

## Error Handling Integration

```typescript
// Graceful error handling in integrations
export function safe_extract_namespaces(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): NamespaceImport[] {
  try {
    return extract_namespaces(root_node, source_code, language, file_path);
  } catch (error) {
    console.warn(`Failed to extract namespaces from ${file_path}:`, error);
    return [];
  }
}
```

## Tasks Breakdown

### Phase 1: Core Integration
- [ ] Update FileAnalysis type to include namespace_imports
- [ ] Integrate with file_analyzer.ts
- [ ] Update project_manager.ts to call extract_namespaces

### Phase 2: Advanced Integration
- [ ] Connect with import_resolution pipeline
- [ ] Integrate with module graph construction
- [ ] Connect with symbol resolution

### Phase 3: Documentation & Examples
- [ ] Update README with new capabilities
- [ ] Add comprehensive API documentation
- [ ] Create usage examples and guides

### Phase 4: Performance & Monitoring
- [ ] Add performance metrics
- [ ] Create benchmarks
- [ ] Set up monitoring dashboards

### Phase 5: Backwards Compatibility
- [ ] Create migration guide
- [ ] Add deprecation warnings to old APIs
- [ ] Plan removal timeline

## Success Criteria

- [ ] All integration points updated and tested
- [ ] Performance impact measured and acceptable
- [ ] Documentation comprehensive and clear
- [ ] Migration path provided for existing users
- [ ] No breaking changes to public APIs
- [ ] Integration tests pass across all modules

## Dependencies

- Requires successful completion of implementation (15.1)
- Requires compilation error fixes (15.2)
- May require updates to @ariadnejs/types package
- Should coordinate with ongoing refactoring efforts