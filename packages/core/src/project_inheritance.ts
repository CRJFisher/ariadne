/**
 * Inheritance and class relationship methods for Project class
 */

import { Def, ScopeGraph } from './graph';
import { ClassRelationship, extract_class_relationships } from './inheritance';
import { LanguageConfig } from './types';
import { Tree } from 'tree-sitter';
import path from 'path';

interface FileInfo {
  graph: ScopeGraph;
  content: string;
  tree: Tree;
}

export class ProjectInheritance {
  private file_graphs: Map<string, FileInfo>;
  private inheritance_map: Map<string, ClassRelationship>;
  private languages: Map<string, LanguageConfig>;

  constructor(
    file_graphs: Map<string, FileInfo>,
    inheritance_map: Map<string, ClassRelationship>,
    languages: Map<string, LanguageConfig>
  ) {
    this.file_graphs = file_graphs;
    this.inheritance_map = inheritance_map;
    this.languages = languages;
  }

  /**
   * Get class relationships (inheritance, interfaces) for a class definition
   * @param class_def The class definition
   * @returns ClassRelationship object or null if not a class
   */
  get_class_relationships(class_def: Def): ClassRelationship | null {
    if (!['class', 'struct', 'interface'].includes(class_def.symbol_kind)) {
      return null;
    }
    
    // Check if already cached
    const cached = this.inheritance_map.get(class_def.symbol_id);
    if (cached) return cached;
    
    // Get file info and language config
    const file_info = this.file_graphs.get(class_def.file_path);
    if (!file_info) {
      return null;
    }
    
    const language = this.get_language_for_file(class_def.file_path);
    if (!language) {
      return null;
    }
    
    // Extract relationships from AST
    const relationships = extract_class_relationships(class_def, file_info.tree, language);
    if (!relationships) {
      return null;
    }
    
    // Resolve parent and interface definitions
    if (relationships.parent_class) {
      relationships.parent_class_def = this.find_class_by_name(relationships.parent_class) || undefined;
    }
    relationships.implemented_interfaces.forEach(interfaceName => {
      const interfaceDef = this.find_class_by_name(interfaceName);
      if (interfaceDef) relationships.interface_defs.push(interfaceDef);
    });
    
    // Cache and return
    this.inheritance_map.set(class_def.symbol_id, relationships);
    return relationships;
  }

  /**
   * Find all subclasses of a given class
   * @param parent_class The parent class definition
   * @returns Array of class definitions that extend the parent
   */
  find_subclasses(parent_class: Def): Def[] {
    if (!['class', 'struct', 'interface'].includes(parent_class.symbol_kind)) {
      return [];
    }
    
    const subclasses: Def[] = [];
    
    // Search all files for classes that extend this one
    for (const [file_path, file_info] of this.file_graphs) {
      const classes = file_info.graph.getAllDefs().filter(d => 
        ['class', 'struct', 'interface'].includes(d.symbol_kind) && d.symbol_id !== parent_class.symbol_id
      );
      
      for (const cls of classes) {
        const relationships = this.get_class_relationships(cls);
        if (relationships?.parent_class === parent_class.name) {
          subclasses.push(cls);
        }
      }
    }
    
    return subclasses;
  }

  /**
   * Find all classes that implement a given interface
   * @param interface_def The interface definition
   * @returns Array of class definitions that implement the interface
   */
  find_implementations(interface_def: Def): Def[] {
    if (!['interface', 'class'].includes(interface_def.symbol_kind)) {
      return [];
    }
    
    const implementations: Def[] = [];
    
    // Search all files for classes that implement this interface
    for (const [file_path, file_info] of this.file_graphs) {
      const classes = file_info.graph.getAllDefs().filter(d => 
        ['class', 'struct'].includes(d.symbol_kind)
      );
      
      for (const cls of classes) {
        const relationships = this.get_class_relationships(cls);
        if (relationships?.implemented_interfaces.includes(interface_def.name)) {
          implementations.push(cls);
        }
      }
    }
    
    return implementations;
  }

  /**
   * Get the full inheritance chain for a class
   * @param class_def The class definition
   * @returns Array of class definitions from most specific to most general
   */
  get_inheritance_chain(class_def: Def): Def[] {
    const chain: Def[] = [];
    const visited = new Set<string>();
    let current = class_def;
    
    while (current && ['class', 'struct', 'interface'].includes(current.symbol_kind)) {
      if (visited.has(current.symbol_id)) break;
      visited.add(current.symbol_id);
      
      const relationships = this.get_class_relationships(current);
      if (relationships?.parent_class_def) {
        chain.push(relationships.parent_class_def);
        current = relationships.parent_class_def;
      } else {
        break;
      }
    }
    
    return chain;
  }

  /**
   * Check if a class is a subclass of another
   * @param child The potential child class
   * @param parent The potential parent class
   * @returns True if child inherits from parent
   */
  is_subclass_of(child: Def, parent: Def): boolean {
    if (!['class', 'struct'].includes(child.symbol_kind) || !['class', 'struct'].includes(parent.symbol_kind)) {
      return false;
    }
    
    return this.get_inheritance_chain(child).some(ancestor => ancestor.symbol_id === parent.symbol_id);
  }

  /**
   * Find a class by name across all files
   * @param class_name The name of the class to find
   * @returns The class definition or null
   */
  find_class_by_name(class_name: string): Def | null {
    for (const [_, file_info] of this.file_graphs) {
      const cls = file_info.graph.getAllDefs().find(d => 
        ['class', 'interface', 'struct'].includes(d.symbol_kind) && d.name === class_name
      );
      if (cls) {
        return cls;
      }
    }
    return null;
  }
  
  /**
   * Get language for a file based on extension
   */
  private get_language_for_file(file_path: string): string | null {
    const ext = path.extname(file_path).slice(1); // Remove the dot
    const config = this.languages.get(ext);
    return config ? config.name : null;
  }
}