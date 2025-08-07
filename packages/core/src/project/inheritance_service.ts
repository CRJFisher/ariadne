import { Def } from '../graph';
import { ClassRelationship } from '../inheritance';
import { ProjectState } from '../storage/storage_interface';
import { ProjectInheritance } from '../project_inheritance';
import { Tree } from 'tree-sitter';
import { ScopeGraph } from '../graph';

/**
 * InheritanceService handles class inheritance and relationship queries
 */
export class InheritanceService {
  /**
   * Get inheritance information for a class definition
   */
  getClassRelationships(
    state: ProjectState,
    classDef: Def
  ): ClassRelationship | null {
    // Create file info map for ProjectInheritance
    const fileInfoMap = this.createFileInfoMap(state);
    const projectInheritance = new ProjectInheritance(
      fileInfoMap,
      new Map(state.inheritance_map),
      new Map(state.languages)
    );
    
    return projectInheritance.get_class_relationships(classDef);
  }
  
  /**
   * Find all classes that extend a given class
   */
  findSubclasses(
    state: ProjectState,
    parentClass: Def
  ): Def[] {
    const fileInfoMap = this.createFileInfoMap(state);
    const projectInheritance = new ProjectInheritance(
      fileInfoMap,
      new Map(state.inheritance_map),
      new Map(state.languages)
    );
    
    return projectInheritance.find_subclasses(parentClass);
  }
  
  /**
   * Find all classes that implement a given interface
   */
  findImplementations(
    state: ProjectState,
    interfaceDef: Def
  ): Def[] {
    const fileInfoMap = this.createFileInfoMap(state);
    const projectInheritance = new ProjectInheritance(
      fileInfoMap,
      new Map(state.inheritance_map),
      new Map(state.languages)
    );
    
    return projectInheritance.find_implementations(interfaceDef);
  }
  
  /**
   * Get the complete inheritance chain for a class
   */
  getInheritanceChain(
    state: ProjectState,
    classDef: Def
  ): Def[] {
    const fileInfoMap = this.createFileInfoMap(state);
    const projectInheritance = new ProjectInheritance(
      fileInfoMap,
      new Map(state.inheritance_map),
      new Map(state.languages)
    );
    
    return projectInheritance.get_inheritance_chain(classDef);
  }
  
  /**
   * Check if one class is a subclass of another
   */
  isSubclassOf(
    state: ProjectState,
    child: Def,
    parent: Def
  ): boolean {
    const fileInfoMap = this.createFileInfoMap(state);
    const projectInheritance = new ProjectInheritance(
      fileInfoMap,
      new Map(state.inheritance_map),
      new Map(state.languages)
    );
    
    return projectInheritance.is_subclass_of(child, parent);
  }
  
  /**
   * Update inheritance relationships after file changes
   */
  updateInheritanceMap(
    state: ProjectState
  ): ProjectState {
    const fileInfoMap = this.createFileInfoMap(state);
    const projectInheritance = new ProjectInheritance(
      fileInfoMap,
      new Map(), // Start with empty map to rebuild
      new Map(state.languages)
    );
    
    // The inheritance map is built internally by ProjectInheritance
    // We need to extract it and update the state
    // For now, we'll keep the existing inheritance map
    // TODO: Refactor ProjectInheritance to expose the built map
    
    return state;
  }
  
  /**
   * Create file info map from project state
   */
  private createFileInfoMap(
    state: ProjectState
  ): Map<string, { graph: ScopeGraph; content: string; tree: Tree }> {
    const fileInfoMap = new Map<string, { graph: ScopeGraph; content: string; tree: Tree }>();
    
    for (const [filePath, cache] of state.file_cache) {
      fileInfoMap.set(filePath, {
        graph: cache.graph,
        content: cache.source_code,
        tree: cache.tree
      });
    }
    
    return fileInfoMap;
  }
}