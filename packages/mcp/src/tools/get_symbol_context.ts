import { z } from "zod";
import { Project } from "../types";

// Request schema for the MCP tool
export const get_symbol_contextSchema = z.object({
  symbol: z.string().describe("Name of the symbol to look up (function, class, variable, etc.)"),
  searchScope: z.enum(["file", "project", "dependencies"]).optional().default("project").describe("Scope to search within"),
  includeTests: z.boolean().optional().default(false).describe("Whether to include test file references"),
});

export type GetSymbolContextRequest = z.infer<typeof get_symbol_contextSchema>;

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
export async function get_symbol_context(
  project: Project,
  request: GetSymbolContextRequest,
): Promise<GetSymbolContextResponse> {
  const { symbol, searchScope, includeTests } = request;
  
  // Find all definitions matching the symbol name
  const definitions = find_symbol_definitions(project, symbol, searchScope);
  
  if (definitions.length === 0) {
    return {
      error: "symbol_not_found",
      message: `No symbol named '${symbol}' found in ${searchScope}`,
      suggestions: find_similar_symbols(project, symbol, searchScope),
    };
  }
  
  // If multiple definitions found, use heuristics to pick the best one
  // For now, we'll use the first one and potentially add disambiguation later
  const primaryDef = definitions[0];
  
  // Extract comprehensive context
  const symbolInfo = extract_symbol_info(primaryDef);
  const definitionInfo = extract_definition_info(primaryDef, project);
  const usageInfo = find_symbol_usages(project, primaryDef, includeTests);
  const relationships = analyze_relationships(project, primaryDef);
  const metrics = calculate_metrics(primaryDef, usageInfo);
  
  return {
    symbol: symbolInfo,
    definition: definitionInfo,
    usage: usageInfo,
    relationships,
    metrics,
  };
}

// Helper functions

function find_symbol_definitions(
  project: Project,
  symbolName: string,
  _searchScope: string,
): any[] {
  const definitions: any[] = [];

  // Get all semantic indexes from the project
  const semanticIndexes = project.get_all_scope_graphs();

  for (const [filePath, semanticIndex] of semanticIndexes) {
    // Search through all definition types in the semantic index
    const definitionMaps = [
      semanticIndex.functions,
      semanticIndex.classes,
      semanticIndex.variables,
      semanticIndex.interfaces,
      semanticIndex.enums,
      semanticIndex.namespaces,
      semanticIndex.types,
    ];

    for (const defMap of definitionMaps) {
      for (const def of defMap.values()) {
        if (def.name === symbolName) {
          definitions.push({
            ...def,
            file_path: filePath,
            semantic_index: semanticIndex,
          });
        }
      }
    }
  }

  return definitions;
}

function find_similar_symbols(
  project: Project,
  symbolName: string,
  _searchScope: string,
): string[] {
  const allSymbols = new Set<string>();
  const semanticIndexes = project.get_all_scope_graphs();

  for (const [, semanticIndex] of semanticIndexes) {
    // Search through all definition types in the semantic index
    const definitionMaps = [
      semanticIndex.functions,
      semanticIndex.classes,
      semanticIndex.variables,
      semanticIndex.interfaces,
      semanticIndex.enums,
      semanticIndex.namespaces,
      semanticIndex.types,
    ];

    for (const defMap of definitionMaps) {
      for (const def of defMap.values()) {
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

function extract_symbol_info(def: any): SymbolInfo {
  const symbolKindMap: Record<string, SymbolInfo["kind"]> = {
    "function": "function",
    "method": "method",
    "class": "class",
    "struct": "struct",
    "interface": "interface",
    "type": "type",
    "enum": "enum",
    "variable": "variable",
    "property": "property",
  };

  // The symbol_kind might be stored as "kind" in some definitions
  const symbolKind = def.symbol_kind || def.kind;

  return {
    name: def.name,
    kind: symbolKindMap[symbolKind] || "unknown",
    // TODO: Extract signature from the implementation
    // TODO: Determine visibility from modifiers
  };
}

function extract_definition_info(def: any, project: Project): DefinitionInfo {
  let implementation = "// Source code not available";
  const startLine = def.location?.start_line || 1;
  
  try {
    // Use the public API to get source code
    implementation = project.get_source_code(def, def.file_path);
    
    // Check if this definition is exported and prepend export keyword if needed
    // Since export detection via graph nodes isn't working reliably,
    // let's check if the source code around the definition contains 'export'
    if (!implementation.startsWith("export ")) {
      // Try to get the full line including export keyword
      try {
        const fullLineDef: any = {
          range: {
            start: { row: (def.location?.start_line || 1) - 1, column: 0 },
            end: { row: (def.location?.end_line || 1) - 1, column: 999 },
          },
        };
        const fullLine = project.get_source_code(fullLineDef, def.file_path);
        
        // Check if the line starts with 'export'
        if (fullLine.trimStart().startsWith("export ")) {
          implementation = "export " + implementation;
        }
      } catch {
        // Fallback to checking semantic index exports
        if (def.semantic_index) {
          const isExported = def.semantic_index.exported_symbols.has(def.name);
          if (isExported) {
            implementation = "export " + implementation;
          }
        }
      }
    }
  } catch {
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
        const startLine = (def.location?.start_line || 1) - 1; // Convert to 0-indexed
        if (startLine > 0) {
          const prevLineDef: any = {
            range: {
              start: { row: Math.max(0, startLine - 10), column: 0 },
              end: { row: startLine - 1, column: 999 },
            },
          };
          const prevLines = project.get_source_code(prevLineDef, def.file_path);
          const jsdocInPrev = prevLines.match(/\/\*\*([\s\S]*?)\*\//);
          if (jsdocInPrev) {
            documentation = jsdocInPrev[0];
          }
        }
      } catch {
        // Ignore errors in documentation extraction
      }
    }
  }
  
  // Extract annotations/decorators
  try {
    const startLine = (def.location?.start_line || 1) - 1; // Convert to 0-indexed
    if (startLine > 0) {
      const prevLineDef: any = {
        range: {
          start: { row: Math.max(0, startLine - 10), column: 0 },
          end: { row: startLine, column: 999 },
        },
      };
      const prevLines = project.get_source_code(prevLineDef, def.file_path);
      
      // Look for decorators/annotations like @deprecated, @override, etc.
      const decoratorMatches = prevLines.match(/@\w+/g);
      if (decoratorMatches && decoratorMatches.length > 0) {
        annotations = decoratorMatches;
      }
    }
  } catch {
    // Ignore errors in annotation extraction
  }
  
  return {
    file: def.file_path,
    line: startLine,
    implementation,
    documentation,
    annotations,
  };
}

function find_symbol_usages(
  project: Project,
  def: any,
  includeTests: boolean,
): UsageInfo {
  const directReferences: UsageReference[] = [];
  const imports: UsageReference[] = [];
  const tests: TestReference[] = [];

  const semanticIndexes = project.get_all_scope_graphs();

  // First, find local references in the same file
  const semantic_index = def.semantic_index;
  if (semantic_index && semantic_index.references) {
    // Look for references that match this definition's symbol_id
    for (const ref of semantic_index.references) {
      if (ref.name === def.name) {
        const context = extract_reference_context(def.file_path, ref, project);

        // Check if this is a test file and we should track it as a test
        const isInTestFunction = is_reference_in_test_function(def.file_path, ref, semanticIndexes);

        if (isInTestFunction && includeTests) {
          const testName = extract_test_name(def.file_path, ref, project);
          tests.push({
            file: def.file_path,
            testName: testName || "test function",
            line: ref.location.start_line,
          });
        } else if (!isInTestFunction) {
          directReferences.push({
            file: def.file_path,
            line: ref.location.start_line,
            context,
          });
        }
      }
    }
  }

  // For now, simplified cross-file reference detection
  // TODO: Implement proper import/export resolution

  // Check other files for references to this symbol by name
  for (const [filePath, otherSemanticIndex] of semanticIndexes) {
    if (filePath === def.file_path) continue;

    // Look for references in other files that match by name
    for (const ref of otherSemanticIndex.references) {
      if (ref.name === def.name) {
        const context = extract_reference_context(filePath, ref, project);

        // Check if this is a test file
        const isInTestFunction = is_reference_in_test_function(filePath, ref, semanticIndexes);

        if (isInTestFunction && includeTests) {
          const testName = extract_test_name(filePath, ref, project);
          tests.push({
            file: filePath,
            testName: testName || "test function",
            line: ref.location.start_line,
          });
        } else if (!isInTestFunction) {
          directReferences.push({
            file: filePath,
            line: ref.location.start_line,
            context,
          });
        }
      }
    }
  }
  
  return {
    directReferences,
    imports,
    tests,
    totalCount: directReferences.length + tests.length,
  };
}


function extract_reference_context(filePath: string, ref: any, project: Project): string {
  try {
    // Create a dummy def with just the range we need (one line)
    const dummyDef = {
      range: {
        start: { row: ref.location.start_line - 1, column: 0 },
        end: { row: ref.location.start_line - 1, column: 999 },
      },
    };

    const line = project.get_source_code(dummyDef, filePath as any);

    // Trim whitespace and limit length
    return line.trim().substring(0, 100);
  } catch {
    return "";
  }
}

function extract_test_name(filePath: string, ref: any, project: Project): string | null {
  try {
    // Search backwards for test/it/describe
    for (let i = ref.location.start_line - 1; i >= 0; i--) {
      const dummyDef: any = {
        range: {
          start: { row: i, column: 0 },
          end: { row: i, column: 999 },
        },
      };

      const line = project.get_source_code(dummyDef, filePath as any);
      const testMatch = line.match(/(?:test|it|describe)\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (testMatch) {
        return testMatch[1];
      }

      // Don't search too far
      if (ref.location.start_line - 1 - i > 20) break;
    }
  } catch {
    // Failed to extract test name
  }

  return null;
}

function is_reference_in_test_function(filePath: string, _ref: any, _fileGraphs: Map<string, any>): boolean {
  // Note: We're not using graph or ref parameters currently due to limitations
  // in how Ariadne detects test functions (primarily for named functions, not
  // anonymous functions or code blocks within test suites)
  
  // For now, use a simpler heuristic: check if the file is a test file
  // This is because:
  // 1. Arrow functions inside test blocks may not be captured as function definitions
  // 2. The reference might be directly in a test block, not in a named function
  // 3. Ariadne's test detection is primarily for named functions
  
  // TODO: Improve this by traversing the AST to find enclosing test blocks
  const isTestFile = filePath.includes("test") || filePath.includes("spec");
  return isTestFile;
}

function analyze_relationships(project: Project, def: any): RelationshipInfo {
  const relationships: RelationshipInfo = {
    calls: [],
    calledBy: [],
    dependencies: [],
    dependents: [],
  };

  // Simplified relationship analysis for now
  // TODO: Implement full call graph and inheritance analysis

  // For functions, try to get basic call information from call graph
  if (def.symbol_kind === "function") {
    try {
      const callGraph = project.get_call_graph();
      const functionNode = callGraph.nodes.get(def.symbol_id);
      if (functionNode) {
        // TODO: FunctionNode type doesn't have calls/called_by properties yet
        // This functionality is not yet implemented in the core
        relationships.calls = [];
        relationships.calledBy = [];
      }
    } catch {
      // Call graph generation might fail for some codebases
    }
  }
  
  // Simplified class inheritance analysis
  if (def.symbol_kind === "class" || def.symbol_kind === "struct" || def.symbol_kind === "interface") {
    // For now, try to extract inheritance from source code
    const fallbackRelationships = extract_inheritance_from_source(project, def);
    if (fallbackRelationships.extends) {
      relationships.extends = fallbackRelationships.extends;
    }
    if (fallbackRelationships.implements && fallbackRelationships.implements.length > 0) {
      relationships.implements = fallbackRelationships.implements;
    }
  }
  
  // TODO: Still missing:
  // - General symbol dependencies (imports, variable usage)
  // - Cross-file type dependencies
  
  return relationships;
}

// Fallback inheritance extraction functions
function extract_inheritance_from_source(project: Project, def: any): { extends?: string; implements?: string[] } {
  try {
    // Get the source code around the class definition
    const implementation = project.get_source_code(def, def.file_path);
    
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
        .split(",")
        .map((name: string) => name.trim())
        .filter((name: string) => name.length > 0);
    }
    
    // Handle interface extension
    if (def.symbol_kind === "interface") {
      const interfaceExtendsMatch = implementation.match(/interface\s+\w+\s+extends\s+([\w\s,]+)/);
      if (interfaceExtendsMatch) {
        const extendedInterfaces = interfaceExtendsMatch[1]
          .split(",")
          .map((name: string) => name.trim())
          .filter((name: string) => name.length > 0);
        
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
    if (def.symbol_kind === "struct" && def.file_path.endsWith(".rs")) {
      // Look for references to this struct in impl blocks
      try {
        const semanticIndexes = project.get_all_scope_graphs();
        const semanticIndex = semanticIndexes.get(def.file_path);

        if (semanticIndex) {
          const structRefs = semanticIndex.references.filter((ref: any) => ref.name === def.name);

          const implementedTraits: string[] = [];

          for (const ref of structRefs) {
            try {
              const refDef = {
                range: {
                  start: { row: ref.location.start_line - 1, column: 0 },
                  end: { row: ref.location.start_line - 1, column: 999 },
                },
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
            } catch {
              // Skip this reference
            }
          }

          if (implementedTraits.length > 0) {
            result.implements = implementedTraits;
          }
        }
      } catch {
        // Fallback failed, ignore
      }
    }

    return result;
  } catch {
    return {};
  }
}


function calculate_metrics(def: any, _usage: UsageInfo): MetricsInfo {
  // Use metadata.line_count if available (most accurate), otherwise fall back to range calculation
  let linesOfCode: number;

  if (def.metadata?.line_count) {
    linesOfCode = def.metadata.line_count;
  } else if (def.location) {
    // Fall back to range calculation using location
    linesOfCode = def.location.end_line - def.location.start_line + 1;
  } else {
    // Default fallback
    linesOfCode = 1;
  }
  
  // TODO: Calculate cyclomatic complexity
  // TODO: Calculate test coverage percentage
  
  return {
    linesOfCode,
  };
}