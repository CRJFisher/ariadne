# MCP Research Findings for Ariadne Integration

## Overview

The Model Context Protocol (MCP) is an open standard developed by Anthropic that provides a universal way for AI applications to connect with external tools and data sources. This document outlines how MCP can be leveraged to expose Ariadne's code intelligence capabilities to AI agents, particularly during architecture and planning phases.

## MCP Core Concepts

### Architecture

MCP uses a client-server architecture:

- **Hosts**: Applications that integrate AI (e.g., Claude Desktop, IDEs)
- **Clients**: Intermediaries managing connections between hosts and servers
- **Servers**: External programs exposing Tools, Resources, and Prompts via standard APIs

### Core Components

1. **Tools (Model-controlled)**: Functions that LLMs can call to perform actions

   ```python
   @mcp.tool()
   def analyze_code(file_path: str) -> dict:
       """Analyze code structure and dependencies"""
       return analysis_results
   ```

2. **Resources (Application-controlled)**: Data sources LLMs can access

   ```python
   @mcp.resource("codebase://{path}")
   def get_code_tree(path: str) -> str:
       """Get hierarchical code structure"""
       return tree_representation
   ```

3. **Prompts (User-controlled)**: Pre-defined templates for optimal tool usage

   ```python
   @mcp.prompt()
   def refactor_suggestion(code: str) -> str:
       return f"Analyze this code for refactoring:\n\n{code}"
   ```

### Technical Implementation

- **Protocol**: JSON-RPC 2.0 messaging format
- **Transport**: stdio (Standard I/O) or HTTP with Server-Sent Events
- **SDKs**: TypeScript and Python (official), with Java and C# community SDKs
- **Security**: OAuth 2.0/2.1 based authentication, HTTPS enforcement

## Architecture Phase Use Cases for Ariadne

### 1. Code Structure Visualization

- **Tool**: `get_code_tree` - Returns hierarchical representation of codebase
- **Tool**: `get_module_dependencies` - Visualizes module-level dependencies
- **Resource**: `architecture://{module}` - Access architecture diagrams and documentation

### 2. Dependency Analysis

- **Tool**: `analyze_dependencies` - Identifies all dependencies for a component
- **Tool**: `find_circular_dependencies` - Detects circular import patterns
- **Tool**: `get_dependency_graph` - Returns visual dependency graph

### 3. Symbol Exploration

- **Tool**: `find_all_definitions` - Lists all functions, classes, and variables
- **Tool**: `get_symbol_hierarchy` - Shows inheritance and composition relationships
- **Resource**: `symbols://{file_path}` - Access symbol table for specific files

### 4. Cross-File Intelligence

- **Tool**: `trace_symbol_usage` - Shows how a symbol is used across the codebase
- **Tool**: `find_unused_code` - Identifies dead code and unused exports
- **Tool**: `get_api_surface` - Lists all public APIs exposed by modules

## Planning Phase Use Cases for Ariadne

### 1. Refactoring Preview

- **Tool**: `preview_rename_symbol` - Shows diff of renaming a symbol across files
- **Tool**: `preview_extract_function` - Shows diff of extracting code into a function
- **Tool**: `preview_move_module` - Shows impact of moving a module

### 2. Impact Analysis

- **Tool**: `analyze_change_impact` - Predicts which files will be affected by a change
- **Tool**: `get_test_coverage_impact` - Shows which tests need to run for a change
- **Tool**: `estimate_refactoring_risk` - Provides risk assessment for proposed changes

### 3. Code Quality Assessment

- **Tool**: `analyze_complexity` - Returns complexity metrics for functions/modules
- **Tool**: `find_code_smells` - Identifies potential issues in code structure
- **Tool**: `suggest_improvements` - Provides actionable improvement suggestions

### 4. Call Graph Analysis

- **Tool**: `get_call_graph` - Returns complete or filtered call graph
- **Tool**: `find_call_paths` - Traces execution paths between functions
- **Tool**: `identify_hotspots` - Finds frequently called functions

## Code Tree Visualization Approach

### Resource-Based Approach

```typescript
// Expose code tree as browseable resources
@mcp.resource("tree://{path}")
async function getCodeTree(path: string): Promise<CodeTree> {
  const project = getProject();
  return {
    path,
    type: "directory",
    children: await project.getTreeStructure(path),
    metadata: {
      file_count: await project.getFileCount(path),
      total_lines: await project.getLineCount(path),
      languages: await project.getLanguages(path)
    }
  };
}
```

### Tool-Based Approach

```typescript
@mcp.tool()
async function visualizeCodeStructure(options: {
  path: string;
  depth?: number;
  include_metrics?: boolean;
  filter?: string;
}): Promise<string> {
  const tree = await project.generateTreeVisualization(options);
  return formatAsAsciiTree(tree);
}
```

## Refactoring Diff Preview Approach

### Unified Diff Tool

```typescript
@mcp.tool()
async function previewRefactoring(params: {
  type: "rename" | "extract" | "move" | "inline";
  target: SymbolReference;
  options: RefactoringOptions;
}): Promise<RefactoringPreview> {
  const changes = await project.calculateRefactoring(params);
  return {
    affected_files: changes.files.length,
    total_changes: changes.edits.length,
    diff: generateUnifiedDiff(changes),
    warnings: changes.warnings,
    estimated_risk: calculateRisk(changes)
  };
}
```

### Interactive Preview Resource

```typescript
@mcp.resource("refactoring://{id}")
async function getRefactoringDetails(id: string): Promise<RefactoringDetails> {
  const refactoring = await getStoredRefactoring(id);
  return {
    id,
    type: refactoring.type,
    status: "preview",
    changes: refactoring.changes,
    file_diffs: refactoring.diffs,
    can_apply: refactoring.isValid,
    conflicts: refactoring.conflicts
  };
}
```

## Integration Patterns with AI Agents

### 1. Stateless Tool Pattern

Best for simple queries and analyses:

```typescript
// Agent can call without maintaining state
const dependencies = await mcp.call("analyze_dependencies", {
  module: "src/core/auth"
});
```

### 2. Session-Based Pattern

For complex, multi-step operations:

```typescript
// Start a refactoring session
const session = await mcp.call("start_refactoring_session", {
  type: "extract_component"
});

// Preview changes incrementally
const preview = await mcp.call("add_to_refactoring", {
  session_id: session.id,
  file: "src/components/Button.tsx",
  selection: { start: 10, end: 50 }
});
```

### 3. Resource Navigation Pattern

For exploring code structure:

```typescript
// Browse code tree like a filesystem
const root = await mcp.get("tree://src");
const authModule = await mcp.get("tree://src/auth");
const symbols = await mcp.get("symbols://src/auth/login.ts");
```

### 4. Prompt-Guided Pattern

For complex analyses with AI assistance:

```typescript
const analysis = await mcp.prompt("architecture_review", {
  module: "src/core",
  focus_areas: ["scalability", "testability", "coupling"]
});
```

## Implementation Recommendations

### Server Structure

```text
@ariadnejs/mcp/
├── src/
│   ├── server.ts           # MCP server implementation
│   ├── tools/              # Tool implementations
│   │   ├── analysis.ts     # Code analysis tools
│   │   ├── refactoring.ts  # Refactoring preview tools
│   │   └── visualization.ts # Tree/graph visualization
│   ├── resources/          # Resource providers
│   │   ├── code_tree.ts    # File tree resources
│   │   └── symbols.ts      # Symbol table resources
│   └── prompts/            # Prompt templates
└── package.json
```

### Key Features to Expose

1. **Core Ariadne APIs**
   - `go_to_definition` → MCP tool
   - `find_references` → MCP tool
   - `get_call_graph` → MCP tool with visualization

2. **Enhanced Capabilities**
   - Incremental parsing status
   - Multi-file refactoring preview
   - Architecture metrics and insights

3. **AI-Optimized Formats**
   - Token-efficient tree representations
   - Summarized symbol tables
   - Compressed diff formats

## Benefits of MCP Integration

1. **Standardization**: Single protocol for all AI tools
2. **Flexibility**: Easy to add new tools without changing client code
3. **Security**: Built-in authentication and sandboxing
4. **Ecosystem**: Integrates with existing MCP tools and servers
5. **Performance**: Efficient streaming and incremental updates

## Next Steps

1. Implement basic MCP server with core Ariadne tools
2. Add resource providers for code exploration
3. Create specialized prompts for architecture analysis
4. Build refactoring preview system with diff generation
5. Add session management for complex operations
6. Integrate with VS Code and other MCP-compatible hosts
