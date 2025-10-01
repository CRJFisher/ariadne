/**
 * Stub types and interfaces for MCP server
 * TODO: Implement actual Project type that wraps Ariadne core API
 * See Epic 5 tasks for MCP server implementation
 */

import type { FilePath } from "@ariadnejs/types";

/**
 * Project interface - stub for now
 * TODO: Implement using Ariadne core API
 */
export interface Project {
  get_definitions(filePath: FilePath): any[];
  get_all_functions(): Map<string, any>;
  get_all_scope_graphs(): Map<FilePath, any>;
  get_source_code(def: any, filePath: FilePath): string;
  get_call_graph(): any;
  get_class_relationships(def: any): any;
  find_subclasses(def: any): any[];
  find_implementations(def: any): any[];
  add_or_update_file(filePath: string, sourceCode: string): void;
}

/**
 * Create a stub project instance
 * TODO: Replace with actual implementation
 */
export function create_project(): Project {
  return {
    get_definitions: () => [],
    get_all_functions: () => new Map(),
    get_all_scope_graphs: () => new Map(),
    get_source_code: () => "",
    get_call_graph: () => ({}),
    get_class_relationships: () => ({}),
    find_subclasses: () => [],
    find_implementations: () => [],
    add_or_update_file: () => {}
  };
}

/**
 * Stub helper function
 * TODO: Implement actual file loading
 */
export async function load_project_files(_project: Project, _projectPath: string): Promise<void> {
  // TODO: Implement
}

/**
 * Stub helper function
 * TODO: Implement actual file loading
 */
export async function load_file_if_needed(_project: Project, _filePath: string): Promise<void> {
  // TODO: Implement
}
