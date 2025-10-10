import { z } from "zod";
import * as fs from "fs/promises";
import type { Project } from "../types";
import { get_all_functions, get_definitions } from "../types";

// Stub type for references removed - not needed

// Request schema for the MCP tool
export const find_referencesSchema = z.object({
  symbol: z.string().describe("Name of the symbol to find references for"),
  includeDeclaration: z.boolean().optional().default(false).describe("Include the declaration itself in results"),
  searchScope: z.enum(["file", "project"]).optional().default("project").describe("Scope to search within"),
});

export type FindReferencesRequest = z.infer<typeof find_referencesSchema>;

// Response interfaces
export interface ReferenceLocation {
  file: string;
  line: number;
  column: number;
  context: string; // Line of code containing the reference
  isDefinition: boolean;
}

export interface FindReferencesResult {
  symbol: string;
  references: ReferenceLocation[];
  totalCount: number;
  fileCount: number;
}

// Error response
export interface SymbolNotFoundError {
  error: "symbol_not_found";
  message: string;
  symbol: string;
}

export type FindReferencesResponse = FindReferencesResult | SymbolNotFoundError;

/**
 * Get the line of code at a specific position
 */
async function get_line_context(filePath: string, line: number): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    if (line > 0 && line <= lines.length) {
      return lines[line - 1].trim();
    }
  } catch {
    // File might not exist or be readable
  }
  return "";
}

/**
 * Find all definitions of a symbol by name
 */
function find_symbol_definitions(project: Project, symbolName: string): Array<{file: string, position: {row: number, column: number}}> {
  const definitions: Array<{file: string, position: {row: number, column: number}}> = [];
  
  // Get all function definitions - returns Map<string, Def[]>
  const allDefsMap = get_all_functions(project);
  
  // Iterate through the map entries
  for (const [, defs] of allDefsMap) {
    for (const def of defs) {
      if (def.name === symbolName && def.file_path && def.range?.start) {
        definitions.push({
          file: def.file_path,
          position: {
            row: def.range.start.row,
            column: def.range.start.column,
          },
        });
      }
    }
  }
  
  // Also search in all files by getting scope graphs
  // Since there's no get_file_paths, we use get_all_scope_graphs
  const allGraphs = project.get_all_scope_graphs();
  for (const [filePath ] of allGraphs) {
    const fileDefs = get_definitions(project, filePath);
    for (const def of fileDefs) {
      if (def.name === symbolName && def.range?.start) {
        // Check if we already have this definition
        const exists = definitions.some(d =>
          d.file === filePath &&
          d.position.row === def.range.start.row &&
          d.position.column === def.range.start.column,
        );
        
        if (!exists) {
          definitions.push({
            file: filePath,
            position: {
              row: def.range.start.row,
              column: def.range.start.column,
            },
          });
        }
      }
    }
  }
  
  return definitions;
}

/**
 * Implementation of find_references MCP tool
 * Finds all references to a symbol by name
 */
export async function find_references(
  project: Project,
  request: FindReferencesRequest,
): Promise<FindReferencesResponse> {
  const { symbol, includeDeclaration = false, searchScope = "project" } = request;
  
  // First, find the definition(s) of the symbol
  const definitions = find_symbol_definitions(project, symbol);
  
  if (definitions.length === 0) {
    return {
      error: "symbol_not_found",
      message: `No symbol named '${symbol}' found in the project`,
      symbol,
    };
  }
  
  // Collect all references
  const allReferences: ReferenceLocation[] = [];
  const filesWithReferences = new Set<string>();
  
  // Determine which files to search based on scope
  const allGraphs = project.get_all_scope_graphs();
  
  for (const [filePath, graph] of allGraphs) {
    // For file scope, only search in files that contain a definition
    if (searchScope === "file" && !definitions.some(d => d.file === filePath)) {
      continue;
    }
    
    // Get all references in this file
    const fileRefs = graph.references || [];
    for (const fileRef of fileRefs) {
      if (fileRef.name === symbol && fileRef.location?.start_line) {
        const context = await get_line_context(filePath, fileRef.location.start_line);

        // Check if this is actually a definition
        const isDefinition = definitions.some(d =>
          d.file === filePath &&
          d.position.row === fileRef.location.start_line - 1 &&
          d.position.column === fileRef.location.start_column,
        );
        
        // Skip definitions if not including them
        if (isDefinition && !includeDeclaration) {
          continue;
        }
        
        allReferences.push({
          file: filePath,
          line: fileRef.location.start_line,
          column: fileRef.location.start_column + 1,
          context,
          isDefinition,
        });
        filesWithReferences.add(filePath);
      }
    }
  }
  
  // For each definition, find references within the same file
  for (const def of definitions) {
    // Add the definition itself if requested
    if (includeDeclaration) {
      const context = await get_line_context(def.file, def.position.row + 1);
      
      // Check for duplicates
      const exists = allReferences.some(r => 
        r.file === def.file && 
        r.line === def.position.row + 1 && 
        r.column === def.position.column + 1,
      );
      
      if (!exists) {
        allReferences.push({
          file: def.file,
          line: def.position.row + 1, // Convert to 1-based
          column: def.position.column + 1,
          context,
          isDefinition: true,
        });
        filesWithReferences.add(def.file);
      }
    }
    
    // Skip the project.find_references call entirely
    // The scope graph approach above already collected all references correctly
    // The find_references API was causing incorrect file attribution for references
  }
  
  // Sort references by file and line
  allReferences.sort((a, b) => {
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file);
    }
    return a.line - b.line;
  });
  
  return {
    symbol,
    references: allReferences,
    totalCount: allReferences.length,
    fileCount: filesWithReferences.size,
  };
}