import { Point, ScopeGraph, Def, Ref } from './graph';
import { build_scope_graph } from './scope_resolution';
import { find_all_references, find_definition } from './symbol_resolver';
import { LanguageConfig } from './types';
import { typescript_config } from './languages/typescript';
import { javascript_config } from './languages/javascript';
import path from 'path';

/**
 * Manages the code intelligence for an entire project.
 */
export class Project {
  private file_graphs: Map<string, ScopeGraph> = new Map();
  private languages: Map<string, LanguageConfig> = new Map();

  constructor() {
    // Register available languages
    this.register_language(typescript_config);
    this.register_language(javascript_config);
    // TODO: Add other languages as they are implemented
  }

  /**
   * Register a language configuration
   */
  private register_language(config: LanguageConfig) {
    this.languages.set(config.name, config);
    // Also register by file extensions for easy lookup
    for (const ext of config.file_extensions) {
      this.languages.set(ext, config);
    }
  }

  /**
   * Get language configuration for a file
   */
  private get_language_config(file_path: string): LanguageConfig | null {
    const ext = path.extname(file_path).slice(1); // Remove the dot
    return this.languages.get(ext) || null;
  }

  /**
   * Adds a file to the project or updates it if it already exists.
   * @param file_path - The unique path identifying the file.
   * @param source_code - The source code of the file.
   */
  add_or_update_file(file_path: string, source_code: string) {
    const config = this.get_language_config(file_path);
    if (!config) {
      console.warn(`No language configuration found for file: ${file_path}`);
      return;
    }

    const tree = config.parser.parse(source_code);
    const graph = build_scope_graph(tree, config);
    this.file_graphs.set(file_path, graph);
  }

  /**
   * Removes a file from the project.
   * @param file_path - The path of the file to remove.
   */
  remove_file(file_path: string) {
    this.file_graphs.delete(file_path);
  }

  /**
   * Finds all references to a symbol at a given position in a file.
   * @param file_path - The path of the file containing the symbol.
   * @param position - The row and column of the symbol.
   * @returns An array of locations where the symbol is referenced.
   */
  find_references(file_path: string, position: Point): Ref[] {
    return find_all_references(file_path, position, this.file_graphs);
  }

  /**
   * Finds the definition of a symbol at a given position in a file.
   * @param file_path - The path of the file containing the symbol.
   * @param position - The row and column of the symbol.
   * @returns The location of the symbol's definition, or null if not found.
   */
  go_to_definition(file_path: string, position: Point): Def | null {
    return find_definition(file_path, position, this.file_graphs);
  }
}