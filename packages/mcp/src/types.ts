/**
 * Types and interfaces for MCP server that use actual Ariadne core API
 */

import type { FilePath } from "@ariadnejs/types";
import { Project as CoreProject } from "@ariadnejs/core";

/**
 * Re-export the actual Project type from core
 */
export type Project = CoreProject;

/**
 * Create an actual project instance
 */
export function create_project(): Project {
  return new CoreProject();
}

/**
 * Load project files from the filesystem
 */
export async function load_project_files(project: Project, projectPath: string): Promise<void> {
  // For now this is a stub - in a real implementation we would:
  // 1. Scan the project directory for source files
  // 2. Read each file's content
  // 3. Call project.update_file(filePath, content) for each file

  // This is left as a stub since the MCP server is primarily for testing
  // and files are usually added one at a time via the update_file method
  console.warn('load_project_files is not yet implemented - files should be added individually via update_file');
}

/**
 * Load a specific file if it's not already in the project
 */
export async function load_file_if_needed(project: Project, filePath: string): Promise<void> {
  // For now this is a stub - in a real implementation we would:
  // 1. Check if the file is already loaded in the project
  // 2. If not, read the file content from filesystem
  // 3. Call project.update_file(filePath, content)

  // This is left as a stub since the MCP server is primarily for testing
  console.warn('load_file_if_needed is not yet implemented - files should be added via update_file');
}

/**
 * Helper functions to bridge the gap between MCP tool expectations and actual Project API
 */

/**
 * Get all function definitions from the project
 * @param project - The project instance
 * @returns Map of file paths to function definitions
 */
export function get_all_functions(project: Project): Map<string, any> {
  // The actual Project class stores data differently
  // For now, return empty map as the MCP server is primarily for testing
  console.warn('get_all_functions is a stub - not yet implemented');
  return new Map();
}

/**
 * Get definitions for a specific file
 * @param project - The project instance
 * @param filePath - The file path to get definitions for
 * @returns Array of definitions in the file
 */
export function get_definitions(project: Project, filePath: FilePath): any[] {
  // The actual Project class stores data differently
  // For now, return empty array as the MCP server is primarily for testing
  console.warn('get_definitions is a stub - not yet implemented');
  return [];
}
