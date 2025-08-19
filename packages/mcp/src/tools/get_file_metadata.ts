import { Project } from "@ariadnejs/core";
import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";

// Request schema for the MCP tool
export const getFileMetadataSchema = z.object({
  filePath: z.string().describe("Path to the file to analyze (relative or absolute)")
});

export type GetFileMetadataRequest = z.infer<typeof getFileMetadataSchema>;

// Response interfaces
export interface SymbolMetadata {
  name: string;
  type: "function" | "class" | "interface" | "type" | "enum" | "variable" | "method" | "property" | "import" | "export";
  line: number;
  signature: string;  // 1-line signature
  exported: boolean;
}

export interface FileMetadata {
  filePath: string;
  language: string;
  symbols: SymbolMetadata[];
  imports: string[];  // List of imported modules/files
  exports: string[];  // List of exported symbols
  lineCount: number;
  symbolCount: number;
}

// Error response
export interface FileNotFoundError {
  error: "file_not_found";
  message: string;
  filePath: string;
}

export type GetFileMetadataResponse = FileMetadata | FileNotFoundError;

/**
 * Extract a 1-line signature from the source code
 */
function extractSignature(source: string, startLine: number): string {
  const lines = source.split('\n');
  if (startLine > 0 && startLine <= lines.length) {
    const line = lines[startLine - 1].trim();
    // Remove trailing { or ; for cleaner signatures
    return line.replace(/[\{;]\s*$/, '').trim();
  }
  return '';
}

/**
 * Implementation of get_file_metadata MCP tool
 * Returns all symbols defined in a file with their signatures and line numbers
 */
export async function getFileMetadata(
  project: Project,
  request: GetFileMetadataRequest
): Promise<GetFileMetadataResponse> {
  const { filePath } = request;
  
  // Resolve the file path
  const resolvedPath = path.isAbsolute(filePath) 
    ? filePath 
    : path.join(process.cwd(), filePath);
  
  // Check if file exists
  try {
    await fs.access(resolvedPath);
  } catch {
    return {
      error: "file_not_found",
      message: `File not found: ${filePath}`,
      filePath: resolvedPath
    };
  }
  
  // Read the file content
  const source = await fs.readFile(resolvedPath, 'utf-8');
  const lines = source.split('\n');
  
  // Get definitions from the project
  const definitions = project.get_definitions(resolvedPath);
  
  // Detect language from file extension
  const ext = path.extname(resolvedPath);
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
    '.c': 'c'
  };
  const language = languageMap[ext] || 'unknown';
  
  // Process definitions into metadata
  const symbols: SymbolMetadata[] = [];
  const exports = new Set<string>();
  const imports = new Set<string>();
  
  for (const def of definitions) {
    // Determine symbol type
    let type: SymbolMetadata['type'] = 'variable';
    const symbolKind = def.symbol_kind?.toLowerCase() || '';
    
    if (symbolKind.includes('function') || symbolKind.includes('method')) {
      type = symbolKind.includes('method') ? 'method' : 'function';
    } else if (symbolKind.includes('class')) {
      type = 'class';
    } else if (symbolKind.includes('interface')) {
      type = 'interface';
    } else if (symbolKind.includes('type')) {
      type = 'type';
    } else if (symbolKind.includes('enum')) {
      type = 'enum';
    } else if (symbolKind.includes('property')) {
      type = 'property';
    }
    
    // Get line number (1-based)
    const line = def.range?.start.row ? def.range.start.row + 1 : 0;
    
    // Extract signature
    let signature = '';
    if (line > 0) {
      // Try to get a clean signature from the source
      signature = extractSignature(source, line);
      
      // If empty, try to construct from available info
      if (!signature && def.signature) {
        signature = `${def.name}${def.signature}`;
      } else if (!signature) {
        signature = def.name;
      }
    }
    
    // Check if exported - use the is_exported flag from Def or fallback to heuristic
    const isExported = def.is_exported ?? (line > 0 && lines[line - 1].includes('export'));
    if (isExported) {
      exports.add(def.name);
    }
    
    symbols.push({
      name: def.name,
      type,
      line,
      signature,
      exported: isExported
    });
  }
  
  // Extract imports (basic pattern matching)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // JavaScript/TypeScript imports
    const importMatch = line.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      imports.add(importMatch[1]);
    }
    
    // Python imports
    const pyImportMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+/);
    if (pyImportMatch && pyImportMatch[1]) {
      imports.add(pyImportMatch[1]);
    }
    
    // Rust use statements
    const rustUseMatch = line.match(/^use\s+([^;{]+)/);
    if (rustUseMatch) {
      imports.add(rustUseMatch[1].trim());
    }
  }
  
  return {
    filePath: resolvedPath,
    language,
    symbols,
    imports: Array.from(imports),
    exports: Array.from(exports),
    lineCount: lines.length,
    symbolCount: symbols.length
  };
}