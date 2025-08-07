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
  kind: "function" | "class" | "struct" | "variable" | "type" | "interface" | "enum" | "method" | "property" | "unknown";
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
  const fileGraphs = project.get_all_scope_graphs();
  
  for (const [filePath, graph] of fileGraphs) {
    // Include all files - we'll filter test functions later if needed
    
    // Get all definition nodes from the graph
    const defs = graph.getNodes('definition');
    
    for (const def of defs) {
      // Type guard to ensure we have a definition node with required properties
      if ('name' in def && def.name === symbolName) {
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
  const fileGraphs = project.get_all_scope_graphs();
  
  for (const [_filePath, graph] of fileGraphs) {
    // Include all files - test filtering happens at the function level
    
    const defs = graph.getNodes('definition');
    for (const def of defs) {
      // Type guard to ensure we have a definition node with name property
      if ('name' in def && typeof def.name === 'string') {
        allSymbols.add(def.name);
      }
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
    "struct": "struct",
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
  let implementation = "// Source code not available";
  let startLine = def.range.start.row;
  
  try {
    // Use the public API to get source code
    implementation = project.get_source_code(def, def.file_path);
    
    // Check if this definition is exported and prepend export keyword if needed
    // Since export detection via graph nodes isn't working reliably,
    // let's check if the source code around the definition contains 'export'
    if (!implementation.startsWith('export ')) {
      // Try to get the full line including export keyword
      try {
        const fullLineDef: any = {
          kind: 'variable' as const,
          name: '_dummy',
          symbol_kind: 'variable' as const,
          symbol_id: '_dummy',
          id: -1,
          file_path: def.file_path,
          range: {
            start: { row: def.range.start.row, column: 0 },
            end: { row: def.range.end.row, column: 999 }
          }
        };
        const fullLine = project.get_source_code(fullLineDef, def.file_path);
        
        // Check if the line starts with 'export'
        if (fullLine.trimStart().startsWith('export ')) {
          implementation = 'export ' + implementation;
        }
      } catch (e) {
        // Fallback to checking graph nodes
        if (def.graph) {
          const exports = def.graph.getNodes('export') as any[];
          const isExported = exports.length > 0;  // Simplified check
          if (isExported) {
            implementation = 'export ' + implementation;
          }
        }
      }
    }
  } catch (error) {
    // If source code extraction fails, use fallback
  }
  
  // Extract documentation and decorators using Ariadne's built-in API
  let documentation: string | undefined;
  let annotations: string[] | undefined;
  
  // Use the docstring from the def if available
  if (def.docstring) {
    documentation = def.docstring;
  }
  
  // If no docstring, try to extract JSDoc from the source
  if (!documentation && implementation) {
    // Look for JSDoc comment in the implementation or just before it
    const jsdocMatch = implementation.match(/\/\*\*([\s\S]*?)\*\//);
    if (jsdocMatch) {
      documentation = jsdocMatch[0];
    } else {
      // Try to get the line before the definition to check for JSDoc
      try {
        if (def.range.start.row > 0) {
          const prevLineDef: any = {
            kind: 'variable' as const,
            name: '_dummy',
            symbol_kind: 'variable' as const,
            symbol_id: '_dummy',
            id: -1,
            file_path: def.file_path,
            range: {
              start: { row: Math.max(0, def.range.start.row - 10), column: 0 },
              end: { row: def.range.start.row - 1, column: 999 }
            }
          };
          const prevLines = project.get_source_code(prevLineDef, def.file_path);
          const jsdocInPrev = prevLines.match(/\/\*\*([\s\S]*?)\*\//);
          if (jsdocInPrev) {
            documentation = jsdocInPrev[0];
          }
        }
      } catch (e) {
        // Ignore errors in documentation extraction
      }
    }
  }
  
  // Extract annotations/decorators
  try {
    if (def.range.start.row > 0) {
      const prevLineDef: any = {
        kind: 'variable' as const,
        name: '_dummy',
        symbol_kind: 'variable' as const,
        symbol_id: '_dummy',
        id: -1,
        file_path: def.file_path,
        range: {
          start: { row: Math.max(0, def.range.start.row - 10), column: 0 },
          end: { row: def.range.start.row, column: 999 }
        }
      };
      const prevLines = project.get_source_code(prevLineDef, def.file_path);
      
      // Look for decorators/annotations like @deprecated, @override, etc.
      const decoratorMatches = prevLines.match(/@\w+/g);
      if (decoratorMatches && decoratorMatches.length > 0) {
        annotations = decoratorMatches;
      }
    }
  } catch (e) {
    // Ignore errors in annotation extraction
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
  
  const fileGraphs = project.get_all_scope_graphs();
  
  // First, find local references in the same file
  const localRefs = def.graph.getRefsForDef(def.id);
  for (const ref of localRefs) {
    const context = extractReferenceContext(def.file_path, ref, project);
    
    // Check if this is a test file and we should track it as a test
    const isInTestFunction = isReferenceInTestFunction(def.file_path, ref, fileGraphs);
    
    if (isInTestFunction && includeTests) {
      const testName = extractTestName(def.file_path, ref, project);
      tests.push({
        file: def.file_path,
        testName: testName || "test function",
        line: ref.range.start.row + 1
      });
    } else if (!isInTestFunction) {
      directReferences.push({
        file: def.file_path,
        line: ref.range.start.row + 1,
        context
      });
    }
  }
  
  // Check if this is an exported definition by looking for is_exported property
  // The core library sets this property during parsing
  const isExported = def.is_exported === true;
  
  if (isExported) {
    // Search for imports and references in other files
    for (const [filePath, graph] of fileGraphs) {
      if (filePath === def.file_path) continue;
      
      // Find imports using getNodes method
      const importNodes = graph.getNodes('import') as any[];
      for (const imp of importNodes) {
        // Check if this import matches our definition
        // Import nodes have 'name' (local name) and optionally 'source_name' (imported name)
        const matchesName = 'name' in imp && (
          imp.name === def.name || 
          ('source_name' in imp && imp.source_name === def.name)
        );
        
        if (matchesName) {
          // Verify the import is actually from the file containing the definition
          // For now, we'll include all matching imports (TODO: improve module resolution)
          imports.push({
            file: filePath,
            line: 'range' in imp ? imp.range.start.row + 1 : 0,
            context: `import { ${imp.name} } from '${imp.source_module || '...'}'`
          });
          
          // Find references to this import using the helper function
          const importRefs = findReferencesToImport(graph, imp);
          
          // Also find direct references by name in this file
          const allRefs = graph.getNodes('reference') as any[];
          const nameMatchingRefs = allRefs.filter(ref => ref.name === imp.name);
          
          for (const ref of nameMatchingRefs) {
            const context = extractReferenceContext(filePath, ref, project);
            
            // Check if the reference is inside a test function
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
  try {
    // Create a dummy def with just the range we need (one line)
    const dummyDef = {
      ...ref,
      file_path: filePath,
      range: {
        start: { row: ref.range.start.row, column: 0 },
        end: { row: ref.range.start.row, column: 999 }
      }
    };
    
    const line = project.get_source_code(dummyDef, filePath);
    
    // Trim whitespace and limit length
    return line.trim().substring(0, 100);
  } catch (error) {
    return "";
  }
}

function extractTestName(filePath: string, ref: any, project: Project): string | null {
  try {
    // Search backwards for test/it/describe
    for (let i = ref.range.start.row; i >= 0; i--) {
      const dummyDef: any = {
        kind: 'variable' as const,
        name: '_dummy',
        symbol_kind: 'variable' as const,
        symbol_id: '_dummy',
        id: -1,
        file_path: filePath,
        range: {
          start: { row: i, column: 0 },
          end: { row: i, column: 999 }
        }
      };
      
      const line = project.get_source_code(dummyDef, filePath);
      const testMatch = line.match(/(?:test|it|describe)\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (testMatch) {
        return testMatch[1];
      }
      
      // Don't search too far
      if (ref.range.start.row - i > 20) break;
    }
  } catch (error) {
    // Failed to extract test name
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
  
  // Analyze function call relationships
  if (def.symbol_kind === 'function') {
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
  }
  
  // Analyze class inheritance relationships
  if (def.symbol_kind === 'class' || def.symbol_kind === 'struct' || def.symbol_kind === 'interface') {
    try {
      const classRelationships = project.get_class_relationships(def);
      if (classRelationships) {
        // Set parent class
        if (classRelationships.parent_class) {
          relationships.extends = classRelationships.parent_class;
        }
        
        // Set implemented interfaces
        if (classRelationships.implemented_interfaces && classRelationships.implemented_interfaces.length > 0) {
          relationships.implements = classRelationships.implemented_interfaces;
        }
      } else {
        // Fallback: try to extract inheritance from source code
        const fallbackRelationships = extractInheritanceFromSource(project, def);
        if (fallbackRelationships.extends) {
          relationships.extends = fallbackRelationships.extends;
        }
        if (fallbackRelationships.implements && fallbackRelationships.implements.length > 0) {
          relationships.implements = fallbackRelationships.implements;
        }
      }
    } catch (error) {
      // Inheritance analysis might fail for some classes
      console.warn(`Failed to analyze inheritance for ${def.name}: ${error}`);
      
      // Try fallback method
      const fallbackRelationships = extractInheritanceFromSource(project, def);
      if (fallbackRelationships.extends) {
        relationships.extends = fallbackRelationships.extends;
      }
      if (fallbackRelationships.implements && fallbackRelationships.implements.length > 0) {
        relationships.implements = fallbackRelationships.implements;
      }
    }
    
    // Find subclasses/implementations using fallback if needed
    try {
      if (def.symbol_kind === 'class' || def.symbol_kind === 'struct') {
        const subclasses = project.find_subclasses(def);
        if (subclasses.length > 0) {
          relationships.dependents = subclasses.map(sub => sub.name);
        } else {
          // Fallback: search for classes that extend this one
          relationships.dependents = findDependentClassesFromSource(project, def);
        }
      } else if (def.symbol_kind === 'interface') {
        const implementations = project.find_implementations(def);
        if (implementations.length > 0) {
          relationships.dependents = implementations.map(impl => impl.name);
        } else {
          // Fallback: search for classes that implement this interface
          relationships.dependents = findDependentClassesFromSource(project, def);
        }
      }
    } catch (error) {
      console.warn(`Failed to find dependents for ${def.name}: ${error}`);
      // Use fallback method
      relationships.dependents = findDependentClassesFromSource(project, def);
    }
  }
  
  // TODO: Still missing:
  // - General symbol dependencies (imports, variable usage)
  // - Cross-file type dependencies
  
  return relationships;
}

// Fallback inheritance extraction functions
function extractInheritanceFromSource(project: Project, def: any): { extends?: string; implements?: string[] } {
  try {
    // Get the source code around the class definition using enclosing_range
    const defWithEnclosingRange = {
      ...def,
      range: def.enclosing_range || def.range
    };
    const implementation = project.get_source_code(defWithEnclosingRange, def.file_path);
    
    const result: { extends?: string; implements?: string[] } = {};
    
    // Extract extends relationship
    const extendsMatch = implementation.match(/class\s+\w+\s+extends\s+(\w+)/);
    if (extendsMatch) {
      result.extends = extendsMatch[1];
    }
    
    // Extract implements relationships
    const implementsMatch = implementation.match(/(?:class|interface)\s+\w+(?:\s+extends\s+\w+)?\s+implements\s+([\w\s,]+)/);
    if (implementsMatch) {
      result.implements = implementsMatch[1]
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0);
    }
    
    // Handle interface extension
    if (def.symbol_kind === 'interface') {
      const interfaceExtendsMatch = implementation.match(/interface\s+\w+\s+extends\s+([\w\s,]+)/);
      if (interfaceExtendsMatch) {
        const extendedInterfaces = interfaceExtendsMatch[1]
          .split(',')
          .map(name => name.trim())
          .filter(name => name.length > 0);
        
        if (extendedInterfaces.length === 1) {
          result.extends = extendedInterfaces[0];
        } else if (extendedInterfaces.length > 1) {
          // For multiple interface inheritance, use the first one as extends
          result.extends = extendedInterfaces[0];
          // Could also set implements to the rest, but this is less common
        }
      }
    }
    
    // Handle Rust trait implementations by looking at references
    if (def.symbol_kind === 'struct' && def.file_path.endsWith('.rs')) {
      // Look for references to this struct in impl blocks
      try {
        const fileGraphs = project.get_all_scope_graphs();
        const graph = fileGraphs.get(def.file_path);
        
        if (graph) {
          const refs = graph.getNodes('reference') as any[];
          const structRefs = refs.filter(ref => ref.name === def.name);
          
          const implementedTraits: string[] = [];
          
          for (const ref of structRefs) {
            try {
              const refDef = {
                ...ref,
                range: {
                  start: { row: ref.range.start.row, column: 0 },
                  end: { row: ref.range.start.row, column: 999 }
                }
              };
              const line = project.get_source_code(refDef, def.file_path);
              
              // Look for impl patterns: "impl TraitName for StructName"
              const implMatch = line.match(/impl\s+(\w+)\s+for\s+\w+/);
              if (implMatch) {
                const traitName = implMatch[1];
                if (!implementedTraits.includes(traitName)) {
                  implementedTraits.push(traitName);
                }
              }
            } catch (error) {
              // Skip this reference
            }
          }
          
          if (implementedTraits.length > 0) {
            result.implements = implementedTraits;
          }
        }
      } catch (error) {
        // Fallback failed, ignore
      }
    }
    
    return result;
  } catch (error) {
    return {};
  }
}

function findDependentClassesFromSource(project: Project, def: any): string[] {
  const dependents: string[] = [];
  
  try {
    // Search all files for classes that extend or implement this definition
    const fileGraphs = project.get_all_scope_graphs();
    
    for (const [filePath, graph] of fileGraphs) {
      const definitions = graph.getNodes('definition') as any[];
      const classDefinitions = definitions.filter(d => 
        d.symbol_kind === 'class' || d.symbol_kind === 'struct' || d.symbol_kind === 'interface'
      );
      
      for (const classDef of classDefinitions) {
        if (classDef.name === def.name) continue; // Skip self
        
        try {
          const defWithEnclosingRange = {
            ...classDef,
            range: (classDef as any).enclosing_range || (classDef as any).range
          };
          const implementation = project.get_source_code(defWithEnclosingRange as any, filePath);
          
          // Check for extends relationship
          const extendsPattern = new RegExp(`(?:class|interface)\\s+\\w+\\s+extends\\s+${def.name}\\b`);
          if (extendsPattern.test(implementation)) {
            dependents.push(classDef.name);
            continue;
          }
          
          // Check for implements relationship
          const implementsPattern = new RegExp(`class\\s+\\w+(?:\\s+extends\\s+\\w+)?\\s+implements\\s+[\\w\\s,]*\\b${def.name}\\b`);
          if (implementsPattern.test(implementation)) {
            dependents.push(classDef.name);
            continue;
          }
          
          // Handle Rust trait implementations
          if (filePath.endsWith('.rs')) {
            const rustImplPattern = new RegExp(`impl\\s+${def.name}\\s+for\\s+(\\w+)`);
            const rustMatch = implementation.match(rustImplPattern);
            if (rustMatch) {
              dependents.push(rustMatch[1]);
            }
          }
        } catch (error) {
          // Skip this definition if we can't get its source
        }
      }
    }
  } catch (error) {
    // Return empty array on error
  }
  
  return dependents;
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