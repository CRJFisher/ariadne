import { Project } from "@ariadnejs/core";
import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";

// Request schema for the MCP tool
export const getSourceCodeSchema = z.object({
  symbol: z.string().describe("Name of the symbol to get source code for"),
  includeDocstring: z.boolean().optional().default(true).describe("Include documentation/comments if available")
});

export type GetSourceCodeRequest = z.infer<typeof getSourceCodeSchema>;

// Response interfaces
export interface SourceCodeResult {
  symbol: string;
  file: string;
  startLine: number;
  endLine: number;
  sourceCode: string;
  language: string;
  docstring?: string;
  signature?: string;
}

// Error response
export interface SymbolNotFoundError {
  error: "symbol_not_found";
  message: string;
  symbol: string;
  suggestions?: string[];
}

export type GetSourceCodeResponse = SourceCodeResult | SymbolNotFoundError;

/**
 * Detect language from file extension
 */
function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp'
  };
  return languageMap[ext] || 'unknown';
}

/**
 * Find similar symbol names for suggestions
 */
function findSimilarSymbols(project: Project, symbolName: string, limit: number = 5): string[] {
  const allDefsMap = project.get_all_functions();
  const symbolLower = symbolName.toLowerCase();
  const allDefs: Array<{name: string}> = [];
  
  // Flatten the map to get all definitions
  for (const [_, defs] of allDefsMap) {
    for (const def of defs) {
      if (def.name) {
        allDefs.push({name: def.name});
      }
    }
  }
  
  // Calculate similarity score
  const scored = allDefs
    .filter(def => def.name && def.name !== symbolName)
    .map(def => {
      const nameLower = def.name.toLowerCase();
      let score = 0;
      
      // Exact substring match
      if (nameLower.includes(symbolLower) || symbolLower.includes(nameLower)) {
        score += 10;
      }
      
      // Start with same characters
      const minLen = Math.min(symbolLower.length, nameLower.length);
      for (let i = 0; i < minLen; i++) {
        if (symbolLower[i] === nameLower[i]) {
          score += 2;
        } else {
          break;
        }
      }
      
      // Length similarity
      const lenDiff = Math.abs(symbolLower.length - nameLower.length);
      score -= lenDiff;
      
      return { name: def.name, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.name);
  
  // Remove duplicates
  return [...new Set(scored)];
}

/**
 * Find a symbol definition by name
 */
function findSymbolDefinition(project: Project, symbolName: string): {def: any, file: string} | null {
  // First check get_all_functions (includes methods, functions)
  const allFunctionsMap = project.get_all_functions();
  
  for (const [filePath, defs] of allFunctionsMap) {
    for (const def of defs) {
      if (def.name === symbolName && def.file_path) {
        return { def, file: def.file_path };
      }
    }
  }
  
  // Then check all loaded files for other types (classes, interfaces, types)
  const allGraphs = project.get_all_scope_graphs();
  
  for (const [filePath, graph] of allGraphs) {
    const definitions = project.get_definitions(filePath);
    for (const def of definitions) {
      if (def.name === symbolName) {
        return { def, file: filePath };
      }
    }
  }
  
  return null;
}

/**
 * Extract source code with improved range handling
 */
async function extractSourceCode(
  filePath: string, 
  def: any,
  includeDocstring: boolean
): Promise<{sourceCode: string, startLine: number, endLine: number, docstring?: string}> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Use enclosing_range if available (for full function/class body)
  const range = def.enclosing_range || def.range;
  
  if (!range || !range.start || !range.end) {
    // Fallback: just return the line with the definition
    const line = def.range?.start?.row || 0;
    return {
      sourceCode: lines[line] || '',
      startLine: line + 1,
      endLine: line + 1
    };
  }
  
  const startLine = range.start.row;
  const endLine = range.end.row;
  
  // Extract the source code
  let sourceLines = lines.slice(startLine, endLine + 1);
  
  // Handle partial lines (using column information)
  if (sourceLines.length > 0) {
    // First line: start from the specified column
    if (range.start.column > 0) {
      sourceLines[0] = sourceLines[0].substring(range.start.column);
    }
    
    // Last line: end at the specified column
    if (sourceLines.length > 1 && range.end.column > 0) {
      const lastIndex = sourceLines.length - 1;
      sourceLines[lastIndex] = sourceLines[lastIndex].substring(0, range.end.column);
    }
  }
  
  let sourceCode = sourceLines.join('\n');
  
  // Try to extract docstring if requested
  let docstring: string | undefined;
  if (includeDocstring && def.docstring) {
    docstring = def.docstring;
  } else if (includeDocstring && startLine > 0) {
    // Look for comments/docstrings above the definition
    const lang = detectLanguage(filePath);
    
    if (lang === 'python') {
      // Check for Python docstring (first string after def)
      const defLine = lines[startLine];
      if (defLine && (defLine.includes('def ') || defLine.includes('class '))) {
        // Look for triple quotes in the next few lines
        for (let i = startLine + 1; i < Math.min(startLine + 10, lines.length); i++) {
          if (lines[i].includes('"""') || lines[i].includes("'''")) {
            const quoteType = lines[i].includes('"""') ? '"""' : "'''";
            const startIdx = lines[i].indexOf(quoteType);
            let docLines = [lines[i].substring(startIdx + 3)];
            
            // Find end of docstring
            for (let j = i + 1; j < lines.length; j++) {
              if (lines[j].includes(quoteType)) {
                docLines.push(lines[j].substring(0, lines[j].indexOf(quoteType)));
                docstring = docLines.join('\n').trim();
                break;
              } else {
                docLines.push(lines[j]);
              }
            }
            break;
          }
        }
      }
    } else if (lang === 'typescript' || lang === 'javascript') {
      // Look for JSDoc comments above
      let commentLines: string[] = [];
      for (let i = startLine - 1; i >= 0 && i > startLine - 20; i--) {
        const line = lines[i].trim();
        if (line.startsWith('*') || line.startsWith('/*') || line.endsWith('*/')) {
          commentLines.unshift(line);
          if (line.startsWith('/**')) {
            docstring = commentLines.join('\n')
              .replace(/^\/\*\*/, '')
              .replace(/\*\/$/, '')
              .replace(/^\s*\* ?/gm, '')
              .trim();
            break;
          }
        } else if (commentLines.length > 0) {
          break; // Stop if we hit non-comment after finding comments
        }
      }
    }
  }
  
  return {
    sourceCode,
    startLine: startLine + 1, // Convert to 1-based
    endLine: endLine + 1,
    docstring
  };
}

/**
 * Implementation of get_source_code MCP tool
 * Extracts the complete source code of a function, class, or other symbol
 */
export async function getSourceCode(
  project: Project,
  request: GetSourceCodeRequest
): Promise<GetSourceCodeResponse> {
  const { symbol, includeDocstring } = request;
  
  // Find the symbol definition
  const result = findSymbolDefinition(project, symbol);
  
  if (!result) {
    return {
      error: "symbol_not_found",
      message: `No symbol named '${symbol}' found in the project`,
      symbol,
      suggestions: findSimilarSymbols(project, symbol)
    };
  }
  
  const { def, file } = result;
  
  try {
    // The core get_source_code API only returns the symbol name,
    // so we need to extract the full source using the range information
    let sourceCode: string;
    let startLine: number;
    let endLine: number;
    let docstring: string | undefined;
    
    // Always use manual extraction since get_source_code doesn't return full source
    const extracted = await extractSourceCode(file, def, includeDocstring);
    sourceCode = extracted.sourceCode;
    startLine = extracted.startLine;
    endLine = extracted.endLine;
    docstring = extracted.docstring;
    
    return {
      symbol,
      file,
      startLine,
      endLine,
      sourceCode,
      language: detectLanguage(file),
      docstring,
      signature: def.signature
    };
  } catch (error) {
    return {
      error: "symbol_not_found",
      message: `Failed to extract source code for '${symbol}': ${error}`,
      symbol
    };
  }
}