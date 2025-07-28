# Ariadne API Enhancement Proposal for Code Charter

## Overview

This document outlines proposed API enhancements for the Ariadne library specifically to support Code Charter's call graph visualization and code summarization features. Code Charter generates interactive visualizations of code structure by analyzing call relationships between functions and summarizing their purposes using LLMs.

## Code Charter's Specific Requirements

Code Charter needs to:
1. Generate call graphs showing which functions call which other functions
2. Extract function source code for LLM summarization
3. Filter out test code and focus on business logic
4. Support Python initially, with TypeScript/JavaScript as secondary targets
5. Provide hierarchical views of code organization

## Proposed API Enhancements

### 1. Public Access to ScopeGraph

**Current State**: The `ScopeGraph` class is created internally for each file but is not accessible through the public API.

**Proposed Enhancement**:
```typescript
class Project {
    // New method to get the scope graph for a specific file
    get_scope_graph(file_path: string): ScopeGraph | null;
    
    // Alternative: get all scope graphs
    get_all_scope_graphs(): Map<string, ScopeGraph>;
}
```

**Code Charter Use Cases**:
- **Call Graph Generation**: Use `graph.getNodes('definition')` to find all functions, then `graph.getRefsForDef()` to trace what each function calls
- **Function Boundary Detection**: Use the enclosing range from definitions to extract exact function source code for summarization
- **Scope Analysis**: Determine which references are within a function's body vs module-level code

### 2. Function-Focused Definition Discovery

**Current State**: No direct way to get all function/method definitions for call graph building.

**Proposed Enhancement**:
```typescript
class Project {
    // Get all function and method definitions in a file
    get_functions_in_file(file_path: string): Def[];
    
    // Get all functions across the project with filtering
    get_all_functions(options?: {
        include_private?: boolean;  // Include _private functions
        include_tests?: boolean;     // Include test_* functions
        symbol_kinds?: string[];     // ['function', 'method']
    }): Map<string, Def[]>;
}
```

**Code Charter Use Cases**:
- **Entry Point Detection**: Find top-level functions to show as starting points in the visualization
- **Test Filtering**: Exclude test functions from production code analysis
- **API Surface Detection**: Focus on public functions for documentation

### 3. Call Graph Extraction

**Current State**: No direct way to extract call relationships between functions.

**Proposed Enhancement**:
```typescript
interface FunctionCall {
    caller_def: Def;           // The function making the call
    called_def: Def;           // The function being called
    call_location: Point;      // Where in the caller the call happens
    is_method_call: boolean;   // true for self.method() or this.method()
}

class Project {
    // Get all function calls made by a specific function
    get_function_calls(def: Def): FunctionCall[];
    
    // Get all calls between functions in the project
    extract_call_graph(): {
        functions: Def[];
        calls: FunctionCall[];
    };
}
```

**Code Charter Use Cases**:
- **Direct Call Graph Building**: Get complete call relationships without manual AST traversal
- **Call Context**: Know exactly where each call happens for accurate source extraction
- **Method vs Function Calls**: Distinguish between different call types for better visualization

### 4. Source Code Extraction

**Current State**: Need to read files separately and calculate line ranges manually.

**Proposed Enhancement**:
```typescript
class Project {
    // Get source code for a definition
    get_source_code(def: Def): string;
    
    // Get source with context (includes docstring before function)
    get_source_with_context(def: Def, context_lines?: number): {
        source: string;
        docstring?: string;
        decorators?: string[];
    };
}
```

**Code Charter Use Cases**:
- **LLM Summarization**: Extract exact function implementations to send to language models
- **Docstring Extraction**: Get documentation to provide context for summarization
- **Decorator Analysis**: In Python, understand function behavior modifications

### 5. Function Metadata for Visualization

**Current State**: Limited information about function characteristics for visualization and filtering.

**Proposed Enhancement**:
```typescript
interface FunctionMetadata {
    is_async?: boolean;
    is_test?: boolean;         // Detected test function
    is_private?: boolean;       // Starts with _ in Python
    complexity?: number;        // Cyclomatic complexity
    line_count: number;         // Size of function
    parameter_names?: string[]; // For signature display
    has_decorator?: boolean;    // Python decorators
    class_name?: string;        // For methods, the containing class
}

interface FunctionDef extends Def {
    metadata: FunctionMetadata;
}
```

**Code Charter Use Cases**:
- **Visualization Styling**: Show async functions differently, size nodes by complexity
- **Smart Filtering**: Hide test/private functions by default in visualizations
- **Rich Tooltips**: Display function signatures and metadata on hover

### 6. Cross-File Import Resolution

**Current State**: Import relationships between files need manual resolution.

**Proposed Enhancement**:
```typescript
interface ImportInfo {
    imported_function: Def;     // The actual function definition
    import_statement: Import;   // The import node
    local_name: string;         // Name used in importing file
}

class Project {
    // Get all imports in a file with resolved definitions
    get_imports_with_definitions(file_path: string): ImportInfo[];
    
    // Get all functions imported from a specific module
    get_exported_functions(module_path: string): Def[];
}
```

**Code Charter Use Cases**:
- **Cross-Module Call Graphs**: Track calls across file boundaries accurately
- **Module Dependency Visualization**: Show which modules depend on which functions
- **Public API Analysis**: Identify which functions are used outside their module

## Implementation Priority for Code Charter

Based on Code Charter's immediate needs:

1. **Critical - Call Graph Building**:
   - Public access to ScopeGraph (#1) 
   - Call graph extraction (#3)
   - Function-focused definition discovery (#2)

2. **Important - Code Analysis**:
   - Source code extraction (#4)
   - Function metadata (#5)
   - Cross-file import resolution (#6)

## Example Usage with Proposed APIs

Here's how Code Charter would use these enhancements:

```typescript
// Build complete call graph for visualization
const project = new Project();
// Add all Python files
for (const file of python_files) {
    project.add_or_update_file(file, content);
}

// Get all functions (excluding tests)
const all_functions = project.get_all_functions({
    include_tests: false,
    include_private: false
});

// Build call graph
const call_graph = project.extract_call_graph();

// For each function, get source for LLM summarization
for (const func of call_graph.functions) {
    const source = project.get_source_with_context(func);
    // Send to LLM for summarization
}

// Generate visualization data
const viz_nodes = call_graph.functions.map(f => ({
    id: `${f.file}#${f.name}`,
    label: f.name,
    size: f.metadata.line_count,
    is_async: f.metadata.is_async
}));

const viz_edges = call_graph.calls.map(c => ({
    source: `${c.caller_def.file}#${c.caller_def.name}`,
    target: `${c.called_def.file}#${c.called_def.name}`
}));
```

## Benefits for Code Charter

1. **Accuracy**: No more regex-based function detection
2. **Performance**: Leverage tree-sitter's incremental parsing
3. **Completeness**: Handle all edge cases Ariadne already handles
4. **Maintainability**: Less code to maintain in Code Charter
5. **Language Support**: Easily add new languages as Ariadne supports them

## Conclusion

These enhancements would allow Code Charter to focus on its core value proposition - visualizing and summarizing code relationships - rather than reimplementing code parsing. The proposed APIs are specifically designed around Code Charter's workflow of finding functions, extracting their relationships, and preparing them for visualization and LLM analysis.