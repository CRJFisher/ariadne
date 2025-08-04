import { Point, Def, Ref, FunctionCall, ImportInfo, SimpleRange, CallGraph, CallGraphOptions, IScopeGraph } from './graph';
import { Edit } from './edit';
import { ClassRelationship } from './inheritance';
import { ImmutableProject } from './project/immutable_project';
import { InMemoryStorage } from './storage/in_memory_storage';
import { typescript_config } from './languages/typescript';
import { javascript_config } from './languages/javascript';
import { python_config } from './languages/python';
import { rust_config } from './languages/rust';

/**
 * Project class with backward compatibility wrapper around ImmutableProject.
 * 
 * @deprecated This class maintains the mutable API for backward compatibility.
 * For new code, use ImmutableProject directly.
 * 
 * This class simulates mutation by updating an internal reference to an immutable project.
 * All "mutating" methods actually create a new immutable project instance internally.
 */
export class Project {
  private immutableProject: ImmutableProject;
  
  constructor() {
    // Create default storage with languages
    const languages = new Map([
      ['typescript', typescript_config],
      ['javascript', javascript_config], 
      ['python', python_config],
      ['rust', rust_config]
    ]);
    
    const storage = new InMemoryStorage(languages);
    this.immutableProject = new ImmutableProject(storage);
    
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Warning: The mutable Project class is deprecated. ' +
        'Please migrate to ImmutableProject for better performance and correctness.'
      );
    }
  }
  
  /**
   * Add or update a file in the project
   * 
   * @deprecated Use ImmutableProject.add_or_update_file() which returns a new instance
   */
  add_or_update_file(file_path: string, source_code: string, edit?: Edit): void {
    this.immutableProject = this.immutableProject.add_or_update_file(file_path, source_code, edit);
  }
  
  /**
   * Remove a file from the project
   * 
   * @deprecated Use ImmutableProject.remove_file() which returns a new instance
   */
  remove_file(file_path: string): void {
    this.immutableProject = this.immutableProject.remove_file(file_path);
  }
  
  /**
   * Update a file range (for incremental updates)
   * 
   * @deprecated Use ImmutableProject.update_file_range() which returns a new instance
   */
  update_file_range(
    file_path: string,
    start_position: Point,
    old_end_position: Point,
    new_text: string
  ): void {
    this.immutableProject = this.immutableProject.update_file_range(
      file_path,
      start_position,
      old_end_position,
      new_text
    );
  }
  
  // Read-only methods delegate directly without deprecation warnings
  
  find_references(file_path: string, position: Point): Ref[] {
    return this.immutableProject.find_references(file_path, position);
  }
  
  go_to_definition(file_path: string, position: Point): Def | null {
    return this.immutableProject.go_to_definition(file_path, position);
  }
  
  get_scope_graph(file_path: string): IScopeGraph | null {
    return this.immutableProject.get_scope_graph(file_path);
  }
  
  get_all_scope_graphs(): Map<string, IScopeGraph> {
    return this.immutableProject.get_all_scope_graphs();
  }
  
  get_functions_in_file(file_path: string): Def[] {
    return this.immutableProject.get_functions_in_file(file_path);
  }
  
  get_definitions(file_path: string): Def[] {
    return this.immutableProject.get_definitions(file_path);
  }
  
  get_all_functions(options?: {
    symbol_kinds?: string[],
    include_private?: boolean,
    include_tests?: boolean
  }): Map<string, Def[]> {
    return this.immutableProject.get_all_functions(options);
  }
  
  get_calls_from_definition(def: Def): FunctionCall[] {
    return this.immutableProject.get_calls_from_definition(def);
  }
  
  get_function_calls(module_level_only: boolean = false): Map<string, FunctionCall[]> {
    return this.immutableProject.get_function_calls(module_level_only);
  }
  
  extract_call_graph(functions: Def[]): Map<string, FunctionCall[]> {
    return this.immutableProject.extract_call_graph(functions);
  }
  
  get_call_graph(options?: CallGraphOptions): CallGraph {
    return this.immutableProject.get_call_graph(options);
  }
  
  get_source_code(def: Def, file_path: string): string {
    return this.immutableProject.get_source_code(def, file_path);
  }
  
  get_source_with_context(def: Def, file_path: string, context_lines: number = 0): {
    source: string,
    start_line: number,
    end_line: number,
    context: { before: string[], after: string[] }
  } {
    return this.immutableProject.get_source_with_context(def, file_path, context_lines);
  }
  
  get_imports_with_definitions(file_path: string): ImportInfo[] {
    return this.immutableProject.get_imports_with_definitions(file_path);
  }
  
  get_exported_functions(module_path: string): Def[] {
    return this.immutableProject.get_exported_functions(module_path);
  }
  
  get_class_relationships(class_def: Def): ClassRelationship | null {
    return this.immutableProject.get_class_relationships(class_def);
  }
  
  find_subclasses(parent_class: Def): Def[] {
    return this.immutableProject.find_subclasses(parent_class);
  }
  
  find_implementations(interface_def: Def): Def[] {
    return this.immutableProject.find_implementations(interface_def);
  }
  
  get_inheritance_chain(class_def: Def): Def[] {
    return this.immutableProject.get_inheritance_chain(class_def);
  }
  
  is_subclass_of(child: Def, parent: Def): boolean {
    return this.immutableProject.is_subclass_of(child, parent);
  }
}