# Task 11.74.12: Wire Error Collection Throughout Pipeline

## Status: Created
**Priority**: LOW
**Parent**: Task 11.74 - Wire and Consolidate Unwired Modules
**Type**: Infrastructure Enhancement

## Summary

Wire the complete but unused `error_collection/analysis_errors` module throughout the processing pipeline to capture and report analysis errors systematically rather than silently failing or logging to console.

## Context

The error collection infrastructure exists but is completely disconnected:
- `ErrorCollector` class is implemented
- Error types are defined
- No errors are actually collected during analysis
- Errors are logged to console or silently ignored

This means we miss:
- Parse errors
- Type resolution failures
- Import resolution problems
- Invalid code constructs

## Problem Statement

Current error handling is ad-hoc:
```typescript
// Current: Errors lost or logged
if (!resolved) {
  console.warn(`Could not resolve type ${name}`);
  return undefined;
}

// Should be: Errors collected
if (!resolved) {
  error_collector.add({
    type: 'type_resolution',
    message: `Could not resolve type ${name}`,
    location,
    severity: 'warning'
  });
  return undefined;
}
```

## Success Criteria

- [ ] Error collector created at pipeline start
- [ ] Errors collected during all analysis phases
- [ ] Errors aggregated and returned in CodeGraph
- [ ] Error reporting utilities implemented
- [ ] Tests verify error collection

## Technical Approach

### Integration Strategy

1. **Create collector** at analysis start
2. **Thread through** all analysis layers
3. **Collect errors** at failure points
4. **Aggregate** in final output
5. **Provide reporting** utilities

### Implementation Steps

1. **Initialize error collector in code_graph.ts**:
```typescript
import { 
  create_error_collector,
  ErrorCollector,
  AnalysisError
} from "./error_collection/analysis_errors";

export async function generate_code_graph(
  options: CodeGraphOptions
): Promise<CodeGraph> {
  // Create global error collector
  const error_collector = create_error_collector({
    max_errors: options.max_errors || 1000,
    severity_threshold: options.error_severity || 'info'
  });
  
  // ... rest of analysis ...
  
  // Return errors in result
  return {
    files,
    modules,
    calls,
    classes,
    types,
    symbols,
    errors: error_collector.get_errors(),  // NEW
    metadata: {
      // ...
      error_count: error_collector.count(),
      has_errors: error_collector.has_errors()
    }
  };
}
```

2. **Thread through file_analyzer.ts layers**:
```typescript
function analyze_file(
  file: CodeFile,
  error_collector: ErrorCollector  // NEW parameter
): Promise<{ analysis: FileAnalysis; tree: Parser.Tree }> {
  
  // Parse with error handling
  const { tree, parser } = parse_file(file, error_collector);
  
  // Pass to each layer
  const layer1 = analyze_scopes(tree, source_code, language, file_path, error_collector);
  const layer2 = detect_local_structures(root_node, source_code, language, file_path, error_collector);
  // ... etc
}

function parse_file(
  file: CodeFile,
  error_collector: ErrorCollector
): ParseResult {
  try {
    const tree = parser.parse(file.source_code);
    
    // Check for parse errors
    if (tree.rootNode.hasError()) {
      error_collector.add({
        type: 'parse_error',
        file: file.file_path,
        message: 'File contains syntax errors',
        severity: 'error',
        location: find_error_location(tree.rootNode)
      });
    }
    
    return { tree, parser };
  } catch (error) {
    error_collector.add({
      type: 'parse_failure',
      file: file.file_path,
      message: error.message,
      severity: 'critical'
    });
    throw error;
  }
}
```

3. **Collect errors in each module**:
```typescript
// In import_resolution
export function extract_imports(
  node: SyntaxNode,
  source: string,
  language: Language,
  file_path: string,
  error_collector: ErrorCollector
): ImportInfo[] {
  const imports = [];
  
  // ... extraction logic ...
  
  if (!resolved_path) {
    error_collector.add({
      type: 'import_resolution',
      file: file_path,
      message: `Cannot resolve import '${import_path}'`,
      location: node_to_location(import_node),
      severity: 'warning'
    });
  }
  
  return imports;
}
```

4. **Add error collection points**:
```typescript
// Key error collection points:

// Type resolution failures
if (!type_found) {
  error_collector.add({
    type: 'type_not_found',
    message: `Type '${type_name}' not found`,
    location,
    severity: 'warning'
  });
}

// Method not found in class
if (!method_exists) {
  error_collector.add({
    type: 'method_not_found',
    message: `Method '${method_name}' not found in class '${class_name}'`,
    location,
    severity: 'error'
  });
}

// Circular dependency detected
if (is_circular) {
  error_collector.add({
    type: 'circular_dependency',
    message: `Circular dependency: ${path.join(' -> ')}`,
    severity: 'warning'
  });
}
```

5. **Create error reporting utilities**:
```typescript
// error_collection/reporter.ts

export function format_errors(
  errors: AnalysisError[],
  options?: ReportOptions
): string {
  const grouped = group_by_file(errors);
  const sorted = sort_by_severity(grouped);
  
  return sorted.map(error => 
    `${error.file}:${error.location?.line}:${error.location?.column} ` +
    `${error.severity}: ${error.message}`
  ).join('\n');
}

export function write_error_report(
  errors: AnalysisError[],
  output_path: string
): void {
  const report = {
    timestamp: new Date().toISOString(),
    error_count: errors.length,
    by_severity: group_by_severity(errors),
    by_type: group_by_type(errors),
    errors: errors
  };
  
  fs.writeFileSync(output_path, JSON.stringify(report, null, 2));
}
```

## Dependencies

- All analysis modules need error_collector parameter
- CodeGraph type needs errors field
- May affect performance if too many errors collected

## Testing Requirements

### Error Collection Tests
```typescript
test("collects parse errors", () => {
  const code = "function broken(";  // Syntax error
  const result = analyze_file(create_file(code), error_collector);
  
  expect(error_collector.has_errors()).toBe(true);
  expect(error_collector.get_errors()).toContainEqual(
    expect.objectContaining({
      type: 'parse_error',
      severity: 'error'
    })
  );
});

test("collects type resolution errors", () => {
  const code = "const x: UnknownType = 5;";
  const result = analyze_file(create_file(code), error_collector);
  
  expect(error_collector.get_errors()).toContainEqual(
    expect.objectContaining({
      type: 'type_not_found',
      message: expect.stringContaining('UnknownType')
    })
  );
});
```

## Risks

1. **Performance**: Collecting many errors could slow analysis
2. **Memory**: Large error collections could consume memory
3. **Breaking Change**: Adding parameter to all functions

## Implementation Notes

### Error Categories

- **Parse Errors**: Syntax errors in source
- **Type Errors**: Type resolution failures
- **Import Errors**: Module resolution failures
- **Semantic Errors**: Invalid code constructs
- **Consistency Errors**: Cross-file inconsistencies

### Error Severities

1. **info**: Informational, not a problem
2. **warning**: Potential issue, analysis continues
3. **error**: Definite problem, partial results
4. **critical**: Severe issue, analysis may fail

### Benefits

1. **Diagnostics**: Better debugging of analysis failures
2. **Reporting**: Can generate error reports
3. **IDE Integration**: Can show errors in editor
4. **Quality**: Track codebase health metrics

## Estimated Effort

- Add to pipeline: 1 day
- Thread through modules: 1 day
- Add collection points: 1 day
- Testing: 0.5 days
- **Total**: 3.5 days

## Notes

This is important for production use where silent failures are unacceptable. The infrastructure exists but needs to be wired throughout the pipeline. This will also enable better IDE integration by providing diagnostic information that can be displayed to users.