import { Project } from "@ariadnejs/core";
import { z } from "zod";

// Request schema for the MCP tool
export const getSymbolContextSchema = z.object({
  symbol: z.string().describe("Name of the symbol to look up (function, class, variable, etc.)"),
  searchScope: z.enum(["file", "project", "dependencies"]).optional().default("project").describe("Scope to search within"),
  includeTests: z.boolean().optional().default(false).describe("Whether to include test file references")
});

export type GetSymbolContextRequest = z.infer<typeof getSymbolContextSchema>;

// Response interfaces
export interface SymbolInfo {
  name: string;
  kind: "function" | "class" | "variable" | "type" | "interface" | "enum" | "method" | "property" | "unknown";
  signature?: string;
  visibility?: "public" | "private" | "protected";
}

export interface DefinitionInfo {
  file: string;
  line: number;
  implementation: string;
  documentation?: string;
  annotations?: string[];
}

export interface UsageReference {
  file: string;
  line: number;
  context: string;
}

export interface TestReference {
  file: string;
  testName: string;
  line: number;
}

export interface UsageInfo {
  directReferences: UsageReference[];
  imports: UsageReference[];
  tests: TestReference[];
  totalCount: number;
}

export interface RelationshipInfo {
  calls: string[];        // Functions this symbol calls
  calledBy: string[];     // Functions that call this symbol
  extends?: string;       // Parent class/interface
  implements?: string[];  // Implemented interfaces
  dependencies: string[]; // Other symbols used
  dependents: string[];   // Symbols that use this
}

export interface MetricsInfo {
  complexity?: number;
  linesOfCode: number;
  testCoverage?: number;
}

export interface SymbolContext {
  symbol: SymbolInfo;
  definition?: DefinitionInfo;
  usage: UsageInfo;
  relationships: RelationshipInfo;
  metrics?: MetricsInfo;
}

// Error response
export interface SymbolNotFoundError {
  error: "symbol_not_found";
  message: string;
  suggestions?: string[];
}

export type GetSymbolContextResponse = SymbolContext | SymbolNotFoundError;

/**
 * Implementation of get_symbol_context MCP tool
 * Finds a symbol by name and returns comprehensive context
 */
export async function getSymbolContext(
  project: Project,
  request: GetSymbolContextRequest
): Promise<GetSymbolContextResponse> {
  const { symbol, searchScope, includeTests } = request;
  
  // Find all definitions matching the symbol name
  const definitions = findSymbolDefinitions(project, symbol, searchScope);
  
  if (definitions.length === 0) {
    return {
      error: "symbol_not_found",
      message: `No symbol named '${symbol}' found in ${searchScope}`,
      suggestions: findSimilarSymbols(project, symbol, searchScope)
    };
  }
  
  // If multiple definitions found, use heuristics to pick the best one
  // For now, we'll use the first one and potentially add disambiguation later
  const primaryDef = definitions[0];
  
  // Extract comprehensive context
  const symbolInfo = extractSymbolInfo(primaryDef);
  const definitionInfo = extractDefinitionInfo(primaryDef, project);
  const usageInfo = findSymbolUsages(project, primaryDef, includeTests);
  const relationships = analyzeRelationships(project, primaryDef);
  const metrics = calculateMetrics(primaryDef, usageInfo);
  
  return {
    symbol: symbolInfo,
    definition: definitionInfo,
    usage: usageInfo,
    relationships,
    metrics
  };
}

// Helper functions

function findSymbolDefinitions(
  project: Project,
  symbolName: string,
  _searchScope: string
): any[] {
  const definitions: any[] = [];
  
  // Get all file graphs from the project
  const fileGraphs = (project as any).file_graphs as Map<string, any>;
  
  for (const [filePath, graph] of fileGraphs) {
    // Include all files - we'll filter test functions later if needed
    
    // Get all definition nodes from the graph
    const defs = graph.getNodes('definition');
    
    for (const def of defs) {
      if (def.name === symbolName) {
        definitions.push({
          ...def,
          file_path: filePath,
          graph
        });
      }
    }
  }
  
  return definitions;
}

function findSimilarSymbols(
  project: Project,
  symbolName: string,
  _searchScope: string
): string[] {
  const allSymbols = new Set<string>();
  const fileGraphs = (project as any).file_graphs as Map<string, any>;
  
  for (const [_filePath, graph] of fileGraphs) {
    // Include all files - test filtering happens at the function level
    
    const defs = graph.getNodes('definition');
    for (const def of defs) {
      allSymbols.add(def.name);
    }
  }
  
  // Improved similarity matching
  const lowerSymbol = symbolName.toLowerCase();
  const suggestions = Array.from(allSymbols)
    .filter(s => {
      const lowerS = s.toLowerCase();
      // Check if either contains the other
      if (lowerS.includes(lowerSymbol) || lowerSymbol.includes(lowerS)) {
        return true;
      }
      // Check if they share a common prefix (at least 3 chars)
      const minLen = Math.min(lowerS.length, lowerSymbol.length, 3);
      return lowerS.substring(0, minLen) === lowerSymbol.substring(0, minLen);
    })
    .sort((a, b) => {
      // Sort by similarity - prefer exact prefix matches
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      if (aLower.startsWith(lowerSymbol) && !bLower.startsWith(lowerSymbol)) return -1;
      if (!aLower.startsWith(lowerSymbol) && bLower.startsWith(lowerSymbol)) return 1;
      return a.length - b.length; // Prefer shorter names
    })
    .slice(0, 5);
  
  return suggestions;
}

function extractSymbolInfo(def: any): SymbolInfo {
  const symbolKindMap: Record<string, SymbolInfo["kind"]> = {
    "function": "function",
    "method": "method",
    "class": "class",
    "interface": "interface",
    "type": "type",
    "enum": "enum",
    "variable": "variable",
    "property": "property"
  };
  
  return {
    name: def.name,
    kind: symbolKindMap[def.symbol_kind] || "unknown",
    // TODO: Extract signature from the implementation
    // TODO: Determine visibility from modifiers
  };
}

function extractDefinitionInfo(def: any, project: Project): DefinitionInfo {
  const fileCache = (project as any).file_cache.get(def.file_path);
  if (!fileCache) {
    return {
      file: def.file_path,
      line: def.range.start.row + 1, // Convert to 1-indexed
      implementation: "// Source code not available"
    };
  }
  
  const sourceLines = fileCache.source_code.split('\n');
  
  // Use enclosing_range if available (includes full function body), otherwise fall back to range
  // NOTE: enclosing_range is currently undefined (see task-55), so this always falls back to signature only
  const range = def.enclosing_range || def.range;
  const startLine = range.start.row;
  const endLine = range.end.row;
  
  // Extract the implementation (currently only signature line due to enclosing_range bug)
  const implementation = sourceLines.slice(startLine, endLine + 1).join('\n');
  
  // Extract documentation and decorators using Ariadne's built-in API
  let documentation: string | undefined;
  let annotations: string[] | undefined;
  
  // Use the docstring from the def if available
  if (def.docstring) {
    documentation = def.docstring;
  } else {
    // Try to extract using get_source_with_context
    try {
      const sourceWithContext = project.get_source_with_context(def, def.file_path);
      documentation = sourceWithContext.docstring;
      if (sourceWithContext.decorators && sourceWithContext.decorators.length > 0) {
        annotations = sourceWithContext.decorators;
      }
    } catch (error) {
      // Fallback gracefully if context extraction fails
      console.warn(`Failed to extract context for ${def.name}:`, error);
    }
  }
  
  return {
    file: def.file_path,
    line: startLine + 1, // Convert to 1-indexed
    implementation,
    documentation,
    annotations
  };
}

function findSymbolUsages(
  project: Project,
  def: any,
  includeTests: boolean
): UsageInfo {
  const directReferences: UsageReference[] = [];
  const imports: UsageReference[] = [];
  const tests: TestReference[] = [];
  
  const fileGraphs = (project as any).file_graphs as Map<string, any>;
  
  // First, find local references in the same file
  const localRefs = def.graph.getRefsForDef(def.id);
  for (const ref of localRefs) {
    const context = extractReferenceContext(def.file_path, ref, project);
    directReferences.push({
      file: def.file_path,
      line: ref.range.start.row + 1,
      context
    });
  }
  
  // Check if this is an exported definition
  const exportedDef = def.graph.findExportedDef(def.name);
  if (exportedDef && exportedDef.id === def.id) {
    // Search for imports and references in other files
    for (const [filePath, graph] of fileGraphs) {
      if (filePath === def.file_path) continue;
      
      // Find imports
      const allImports = graph.getAllImports();
      for (const imp of allImports) {
        if (imp.name === def.name || imp.source_name === def.name) {
          imports.push({
            file: filePath,
            line: imp.range.start.row + 1,
            context: `import { ${imp.name} } from '...'`
          });
          
          // Find references to this import
          const importRefs = findReferencesToImport(graph, imp);
          for (const ref of importRefs) {
            const context = extractReferenceContext(filePath, ref, project);
            
            // Check if the reference is inside a test function using Ariadne's test detection
            const isInTestFunction = isReferenceInTestFunction(filePath, ref, fileGraphs);
            
            if (isInTestFunction) {
              if (includeTests) {
                // Try to extract test name
                const testName = extractTestName(filePath, ref, project);
                tests.push({
                  file: filePath,
                  testName: testName || "test function",
                  line: ref.range.start.row + 1
                });
              }
              // If includeTests is false, we skip test references entirely
            } else {
              directReferences.push({
                file: filePath,
                line: ref.range.start.row + 1,
                context
              });
            }
          }
        }
      }
    }
  }
  
  return {
    directReferences,
    imports,
    tests,
    totalCount: directReferences.length + tests.length
  };
}

function findReferencesToImport(graph: any, imp: any): any[] {
  const refs: any[] = [];
  const allRefs = graph.getNodes('reference');
  
  for (const ref of allRefs) {
    const connectedImports = graph.getImportsForRef(ref.id);
    if (connectedImports.some((i: any) => i.id === imp.id)) {
      refs.push(ref);
    }
  }
  
  return refs;
}

function extractReferenceContext(filePath: string, ref: any, project: Project): string {
  const fileCache = (project as any).file_cache.get(filePath);
  if (!fileCache) return "";
  
  const lines = fileCache.source_code.split('\n');
  const lineIndex = ref.range.start.row;
  
  // Get the line containing the reference
  const line = lines[lineIndex] || "";
  
  // Trim whitespace and limit length
  return line.trim().substring(0, 100);
}

function extractTestName(filePath: string, ref: any, project: Project): string | null {
  const fileCache = (project as any).file_cache.get(filePath);
  if (!fileCache) return null;
  
  const lines = fileCache.source_code.split('\n');
  
  // Search backwards for test/it/describe
  for (let i = ref.range.start.row; i >= 0; i--) {
    const line = lines[i];
    const testMatch = line.match(/(?:test|it|describe)\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (testMatch) {
      return testMatch[1];
    }
    
    // Don't search too far
    if (ref.range.start.row - i > 20) break;
  }
  
  return null;
}

function isReferenceInTestFunction(filePath: string, _ref: any, _fileGraphs: Map<string, any>): boolean {
  // Note: We're not using graph or ref parameters currently due to limitations
  // in how Ariadne detects test functions (primarily for named functions, not
  // anonymous functions or code blocks within test suites)
  
  // For now, use a simpler heuristic: check if the file is a test file
  // This is because:
  // 1. Arrow functions inside test blocks may not be captured as function definitions
  // 2. The reference might be directly in a test block, not in a named function
  // 3. Ariadne's test detection is primarily for named functions
  
  // TODO: Improve this by traversing the AST to find enclosing test blocks
  const isTestFile = filePath.includes('test') || filePath.includes('spec');
  return isTestFile;
}

function analyzeRelationships(project: Project, def: any): RelationshipInfo {
  const relationships: RelationshipInfo = {
    calls: [],
    calledBy: [],
    dependencies: [],
    dependents: []
  };
  
  // Only analyze relationships for functions (call graph is function-focused)
  if (def.symbol_kind !== 'function') {
    return relationships;
  }
  
  try {
    // Get the call graph for the entire project
    const callGraph = project.get_call_graph();
    
    // Find the node for this function
    const functionNode = callGraph.nodes.get(def.symbol_id);
    if (functionNode) {
      // Extract calls and called_by relationships
      relationships.calls = functionNode.calls.map(call => call.symbol);
      relationships.calledBy = functionNode.called_by; // already strings
    }
  } catch (error) {
    // Call graph generation might fail for some codebases
    console.warn(`Failed to generate call graph: ${error}`);
  }
  
  // TODO: Still missing:
  // - Class inheritance (extends, implements)
  // - General symbol dependencies (imports, variable usage)
  // - Non-function symbols (classes, variables, etc.)
  
  return relationships;
}

function calculateMetrics(def: any, _usage: UsageInfo): MetricsInfo {
  // Use metadata.line_count if available (most accurate), otherwise fall back to range calculation
  let linesOfCode: number;
  
  if (def.metadata?.line_count) {
    linesOfCode = def.metadata.line_count;
  } else {
    // Fall back to range calculation (only covers the definition line)
    const range = def.enclosing_range || def.range;
    linesOfCode = range.end.row - range.start.row + 1;
  }
  
  // TODO: Calculate cyclomatic complexity
  // TODO: Calculate test coverage percentage
  
  return {
    linesOfCode
  };
}