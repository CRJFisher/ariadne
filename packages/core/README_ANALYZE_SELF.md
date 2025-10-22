# Self-Analysis Script for packages/core

This script uses the Ariadne Project API to analyze the packages/core codebase itself, demonstrating call graph detection and entry point analysis.

## Usage

### Run with pretty-printed JSON

```bash
npx tsx packages/core/analyze_self.ts --pretty
```

### Run with compact JSON (for piping)

```bash
npx tsx packages/core/analyze_self.ts
```

### Pipe to jq for filtering

```bash
# Get summary statistics
npx tsx packages/core/analyze_self.ts 2>/dev/null | jq '{
  files: .total_files_analyzed,
  entry_points: .total_entry_points
}'

# Get top 10 most complex entry points
npx tsx packages/core/analyze_self.ts 2>/dev/null | jq '.entry_points[0:10]'

# Find specific function
npx tsx packages/core/analyze_self.ts 2>/dev/null | jq '.entry_points[] | select(.name == "detect_call_graph")'

# Get all functions in a specific file
npx tsx packages/core/analyze_self.ts 2>/dev/null | jq '.entry_points[] | select(.file_path | contains("project.ts"))'
```

## Output Schema

```typescript
{
  project_path: string;           // Absolute path to packages/core
  total_files_analyzed: number;   // Number of TypeScript files loaded
  total_entry_points: number;     // Number of entry point functions found
  entry_points: [
    {
      name: string;               // Function name
      file_path: string;          // Absolute path to file
      start_line: number;         // Starting line number
      start_column: number;       // Starting column number
      end_line: number;           // Ending line number
      end_column: number;         // Ending column number
      signature?: string;         // Function signature with types
      tree_size: number;          // Total unique functions called (transitively)
      kind: "function" | "method" | "constructor";
    }
  ];
  generated_at: string;           // ISO timestamp
}
```

## What is an Entry Point?

An **entry point** is a function that is never called by any other function in the codebase. These represent potential starting points for execution or exported APIs.

The script:
1. Loads all TypeScript source files (excluding tests)
2. Builds a complete call graph
3. Identifies functions with no callers
4. Calculates tree size (total transitive calls) for each
5. Sorts by tree size descending (most complex first)

## Example Output

```json
{
  "project_path": "/Users/chuck/workspace/ariadne/packages/core",
  "total_files_analyzed": 77,
  "total_entry_points": 691,
  "entry_points": [
    {
      "name": "resolve_module_path_rust",
      "file_path": "/Users/chuck/workspace/ariadne/packages/core/src/resolve_references/import_resolution/import_resolver.rust.ts",
      "start_line": 55,
      "start_column": 17,
      "end_line": 55,
      "end_column": 40,
      "signature": "resolve_module_path_rust(import_path: string, importing_file: FilePath, root_folder: FileSystemFolder): FilePath",
      "tree_size": 17,
      "kind": "function"
    }
  ],
  "generated_at": "2025-10-22T21:30:00.000Z"
}
```

## Notes

- Warnings about "duplicate export names" are from variable shadowing in different scopes - these are false positives and don't affect the analysis
- Test files (`.test.ts`, `.spec.ts`) are excluded from analysis
- Only TypeScript source files are analyzed (`.ts` but not `.d.ts`)
- The script outputs warnings to stderr and JSON to stdout for easy piping
