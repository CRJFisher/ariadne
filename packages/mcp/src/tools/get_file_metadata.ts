import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";
import type { Project } from "../types";
import { get_definitions } from "../types";
import type { FilePath } from "@ariadnejs/types";

// Request schema for the MCP tool
export const get_file_metadataSchema = z.object({
  filePath: z.string().describe("Path to the file to analyze (relative or absolute)"),
});

export type GetFileMetadataRequest = z.infer<typeof get_file_metadataSchema>;

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
function extract_signature(source: string, startLine: number): string {
  const lines = source.split("\n");
  if (startLine > 0 && startLine <= lines.length) {
    let line = lines[startLine - 1].trim();
    
    // For constructors and methods with inline braces, remove the body
    // Match patterns like: constructor(...) { } or method() {}
    line = line.replace(/\s*\{.*\}\s*$/, "");
    
    // Remove trailing opening brace for multi-line functions
    line = line.replace(/\s*\{\s*$/, "");
    
    // Remove trailing semicolon
    line = line.replace(/;\s*$/, "");
    
    // Remove arrow function body markers
    line = line.replace(/\s*=>\s*\{?\s*$/, "");
    
    return line.trim();
  }
  return "";
}

/**
 * Implementation of get_file_metadata MCP tool
 * Returns all symbols defined in a file with their signatures and line numbers
 */
export async function get_file_metadata(
  project: Project,
  request: GetFileMetadataRequest,
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
      filePath: resolvedPath,
    };
  }
  
  // Read the file content
  const source = await fs.readFile(resolvedPath, "utf-8");
  const lines = source.split("\n");
  
  // Get definitions from the project
  const definitions = get_definitions(project, resolvedPath as FilePath);
  
  // Detect language from file extension
  const ext = path.extname(resolvedPath);
  const languageMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "c",
  };
  const language = languageMap[ext] || "unknown";
  
  // Process definitions into metadata
  const symbols: SymbolMetadata[] = [];
  const exports = new Set<string>();
  const imports = new Set<string>();
  
  for (const def of definitions) {
    // Determine symbol type
    let type: SymbolMetadata["type"] = "variable";
    const symbolKind = def.symbol_kind?.toLowerCase() || "";
    
    if (symbolKind.includes("function") || symbolKind.includes("method")) {
      type = symbolKind.includes("method") ? "method" : "function";
    } else if (symbolKind.includes("class")) {
      type = "class";
    } else if (symbolKind.includes("interface")) {
      type = "interface";
    } else if (symbolKind.includes("type") || symbolKind.includes("alias")) {
      // 'alias' is used for TypeScript type aliases
      type = "type";
    } else if (symbolKind.includes("enum")) {
      type = "enum";
    } else if (symbolKind.includes("property")) {
      type = "property";
    }
    
    // Get line number (1-based)
    // Note: def.range.start.row is 0-based, so we add 1
    const line = def.range?.start?.row !== undefined ? def.range.start.row + 1 : 1;
    
    // Extract signature
    let signature = "";
    if (line > 0) {
      // Try to get a clean signature from the source
      signature = extract_signature(source, line);
      
      // If empty, try to construct from available info
      if (!signature && def.signature) {
        signature = `${def.name}${def.signature}`;
      } else if (!signature) {
        signature = def.name;
      }
    }
    
    // Check if exported - use the is_exported flag from Def or fallback to heuristic
    const isExported = def.is_exported ?? (line > 0 && lines[line - 1].includes("export"));
    if (isExported) {
      exports.add(def.name);
    }
    
    symbols.push({
      name: def.name,
      type,
      line,
      signature,
      exported: isExported,
    });
  }
  
  // Extract imports (basic pattern matching)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // JavaScript/TypeScript imports
    const importMatch = line.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      imports.add(importMatch[1]);
    }
    
    // Python imports
    // Handle: from X import Y
    const pyFromImportMatch = line.match(/^from\s+(\S+)\s+import\s+/);
    if (pyFromImportMatch) {
      imports.add(pyFromImportMatch[1]);
    }
    // Handle: import X
    const pyDirectImportMatch = line.match(/^import\s+(\S+)/);
    if (pyDirectImportMatch && !line.includes(" from ")) {
      // Split comma-separated imports
      const modules = pyDirectImportMatch[1].split(",").map(m => m.trim());
      modules.forEach(m => {
        if (m && !m.includes(" as ")) {
          imports.add(m);
        } else if (m.includes(" as ")) {
          const [module] = m.split(" as ");
          imports.add(module.trim());
        }
      });
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
    symbolCount: symbols.length,
  };
}