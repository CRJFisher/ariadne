import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";

// Request schema for the MCP tool
export const get_source_codeSchema = z.object({
  symbol: z.string().describe("Name of the symbol to get source code for"),
  includeDocstring: z.boolean().optional().default(true).describe("Include documentation/comments if available")
});

export type GetSourceCodeRequest = z.infer<typeof get_source_codeSchema>;

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
function detect_language(filePath: string): string {
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
function find_similar_symbols(project: Project, symbolName: string, limit: number = 5): string[] {
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
function find_symbol_definition(project: Project, symbolName: string): {def: any, file: string} | null {
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
async function extract_source_code(
  filePath: string, 
  def: any,
  includeDocstring: boolean
): Promise<{sourceCode: string, startLine: number, endLine: number, docstring?: string}> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Use enclosing_range if available (for full function/class body)
  let range = def.enclosing_range || def.range;
  
  // Special handling for type aliases which need the full declaration
  if (def.symbol_kind === 'alias' && def.range && !def.enclosing_range) {
    // For type aliases, we need to extend the range to include the entire type definition
    // The def.range only points to the identifier, we need to find the closing semicolon/brace
    const startLine = def.range.start.row;
    const startCol = Math.max(0, def.range.start.column - 12); // Go back to catch "export type "
    
    // Find the end of the type definition by looking for the closing semicolon or next export
    let endLine = startLine;
    let endCol = lines[startLine].length;
    let braceCount = 0;
    let foundStart = false;
    
    for (let i = startLine; i < lines.length && i < startLine + 50; i++) {
      const line = lines[i];
      const startIdx = (i === startLine) ? def.range.start.column : 0;
      
      for (let j = startIdx; j < line.length; j++) {
        const char = line[j];
        if (char === '{') {
          braceCount++;
          foundStart = true;
        } else if (char === '}') {
          braceCount--;
          if (foundStart && braceCount === 0) {
            // Found the closing brace
            endLine = i;
            endCol = j + 1;
            // Look for optional semicolon
            if (j + 1 < line.length && line[j + 1] === ';') {
              endCol = j + 2;
            }
            break;
          }
        } else if (char === ';' && braceCount === 0) {
          // Found semicolon at top level
          endLine = i;
          endCol = j + 1;
          break;
        }
      }
      
      if (endLine !== startLine) break;
    }
    
    range = {
      start: { row: startLine, column: startCol },
      end: { row: endLine, column: endCol }
    };
  }
  
  if (!range || !range.start || !range.end) {
    // Fallback: just return the line with the definition
    const line = def.range?.start?.row || 0;
    return {
      sourceCode: lines[line] || '',
      startLine: line + 1,
      endLine: line + 1
    };
  }
  
  let startLine = range.start.row;
  let startColumn = range.start.column;
  const endLine = range.end.row;
  
  // Look backwards on the same line to capture export/public/async keywords
  if (startColumn > 0 && startLine < lines.length) {
    const lineBeforeSymbol = lines[startLine].substring(0, startColumn);
    // Check for common keywords that should be included
    // For type aliases, we need to capture "export type" which might be further back
    const keywordMatch = lineBeforeSymbol.match(/(export\s+type\s+|export\s+interface\s+|export\s+class\s+|export\s+function\s+|export\s+const\s+|export\s+let\s+|export\s+var\s+|export\s+async\s+function\s+|export\s+|public\s+|private\s+|protected\s+|async\s+|const\s+|let\s+|var\s+|static\s+|abstract\s+|type\s+)*$/);
    if (keywordMatch && keywordMatch[0]) {
      // Adjust start column to include these keywords
      startColumn = startColumn - keywordMatch[0].length;
    }
  }
  
  // Extract the source code
  let sourceLines = lines.slice(startLine, endLine + 1);
  
  // Handle partial lines (using column information)
  if (sourceLines.length > 0) {
    // First line: start from the adjusted column
    if (startColumn > 0) {
      sourceLines[0] = sourceLines[0].substring(startColumn);
    } else {
      // If we've gone back to column 0, take the whole line
      sourceLines[0] = sourceLines[0];
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
    const lang = detect_language(filePath);
    
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
export async function get_source_code(
  project: Project,
  request: GetSourceCodeRequest
): Promise<GetSourceCodeResponse> {
  const { symbol, includeDocstring } = request;
  
  // Find the symbol definition
  const result = find_symbol_definition(project, symbol);
  
  if (!result) {
    return {
      error: "symbol_not_found",
      message: `No symbol named '${symbol}' found in the project`,
      symbol,
      suggestions: find_similar_symbols(project, symbol)
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
    const extracted = await extract_source_code(file, def, includeDocstring);
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
      language: detect_language(file),
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