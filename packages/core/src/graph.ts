import { SyntaxNode, Range } from 'tree-sitter';
import {
  Point,
  SimpleRange,
  Scoping,
  FunctionMetadata,
  BaseNode,
  Def,
  Ref,
  Import,
  Scope,
  Node,
  FunctionCall,
  ImportInfo,
  BaseEdge,
  DefToScope,
  RefToDef,
  ScopeToScope,
  ImportToScope,
  RefToImport,
  Edge,
  Call,
  CallGraphOptions,
  CallGraphNode,
  CallGraphEdge,
  CallGraph,
  IScopeGraph
} from '@ariadnejs/types';

// Re-export types for backward compatibility
export {
  Point,
  SimpleRange,
  Scoping,
  FunctionMetadata,
  Def,
  Ref,
  Import,
  Scope,
  Node,
  FunctionCall,
  ImportInfo,
  DefToScope,
  RefToDef,
  ScopeToScope,
  ImportToScope,
  RefToImport,
  Edge,
  Call,
  CallGraphOptions,
  CallGraphNode,
  CallGraphEdge,
  CallGraph,
  IScopeGraph
} from '@ariadnejs/types';

// All types are imported from @ariadnejs/types above

// The main graph structure

export class ScopeGraph implements IScopeGraph {
  private nodes: Node[] = [];
  private edges: Edge[] = [];
  private next_node_id = 0;
  private root_id: number;

  constructor(root_node: SyntaxNode, lang_id: string) {
    // A new graph is created with a root scope that spans the entire file.
    const root_scope: Scope = {
      id: this.get_next_node_id(),
      kind: 'scope',
      range: {
        start: { row: root_node.startPosition.row, column: root_node.startPosition.column },
        end: { row: root_node.endPosition.row, column: root_node.endPosition.column },
      }
    };
    this.root_id = root_scope.id;
    this.nodes.push(root_scope);
  }

  // Method stubs based on the deep dive document
  insert_local_def(def: Def) {
    const parent_scope_id = this.find_containing_scope(def.range);
    this.nodes.push(def);
    this.edges.push({ kind: 'def_to_scope', source_id: def.id, target_id: parent_scope_id });
  }

  insert_hoisted_def(def: Def) {
    // Hoisted definitions are inserted into the parent scope of the defining scope
    const defining_scope_id = this.find_containing_scope(def.range);
    
    // Find the parent scope
    const parent_edge = this.edges.find(
      e => e.kind === 'scope_to_scope' && e.source_id === defining_scope_id
    );
    
    // If there's a parent scope, insert there; otherwise insert in the defining scope
    const target_scope_id = parent_edge ? parent_edge.target_id : defining_scope_id;
    
    this.nodes.push(def);
    this.edges.push({ kind: 'def_to_scope', source_id: def.id, target_id: target_scope_id });
  }

  insert_global_def(def: Def) {
    this.nodes.push(def);
    this.edges.push({ kind: 'def_to_scope', source_id: def.id, target_id: this.root_id });
  }

  insert_local_scope(scope: Scope) {
    const parent_scope_id = this.find_containing_scope(scope.range);
    this.nodes.push(scope);
    this.edges.push({ kind: 'scope_to_scope', source_id: scope.id, target_id: parent_scope_id });
  }

  insert_local_import(imp: Import) {
    const parent_scope_id = this.find_containing_scope(imp.range);
    this.nodes.push(imp);
    this.edges.push({ kind: 'import_to_scope', source_id: imp.id, target_id: parent_scope_id });
  }

  insert_ref(ref: Ref) {
    const possible_defs: number[] = [];
    const possible_imports: number[] = [];
    
    const local_scope_id = this.find_containing_scope(ref.range);
    
    // Walk up the scope chain from the reference's scope to the root
    for (const scope_id of this.get_scope_stack(local_scope_id)) {
      // Find definitions in this scope
      const defs_in_scope = this.get_defs_in_scope(scope_id);
      for (const def_id of defs_in_scope) {
        const def = this.nodes.find(n => n.id === def_id) as Def;
        if (def && def.name === ref.name) {
          // Check if symbols are compatible (if both have symbol kinds)
          if (!ref.symbol_kind || !def.symbol_kind || ref.symbol_kind === def.symbol_kind) {
            possible_defs.push(def_id);
          }
        }
      }
      
      // Find imports in this scope
      const imports_in_scope = this.get_imports_in_scope(scope_id);
      for (const import_id of imports_in_scope) {
        const imp = this.nodes.find(n => n.id === import_id) as Import;
        if (imp && imp.name === ref.name) {
          possible_imports.push(import_id);
        }
      }
    }
    
    // Add the reference node and create edges to found definitions/imports
    if (possible_defs.length > 0 || possible_imports.length > 0) {
      this.nodes.push(ref);
      
      for (const def_id of possible_defs) {
        this.edges.push({ kind: 'ref_to_def', source_id: ref.id, target_id: def_id });
      }
      
      for (const import_id of possible_imports) {
        this.edges.push({ kind: 'ref_to_import', source_id: ref.id, target_id: import_id });
      }
    }
  }

  get_next_node_id(): number {
    return this.next_node_id++;
  }

  private find_containing_scope(range: SimpleRange): number {
    let best_scope_id = this.root_id;
    let best_scope_size = Infinity;

    for (const node of this.nodes) {
      if (node.kind === 'scope') {
        const scope_range = node.range;
        // Check if the scope contains the given range
        const start_before = scope_range.start.row < range.start.row || 
          (scope_range.start.row === range.start.row && scope_range.start.column <= range.start.column);
        const end_after = scope_range.end.row > range.end.row || 
          (scope_range.end.row === range.end.row && scope_range.end.column >= range.end.column);
        
        if (start_before && end_after) {
          const scope_size = (scope_range.end.row - scope_range.start.row) * 1000 + (scope_range.end.column - scope_range.start.column);
          if (scope_size < best_scope_size) {
            best_scope_id = node.id;
            best_scope_size = scope_size;
          }
        }
      }
    }
    return best_scope_id;
  }

  node_to_simple_range(node: SyntaxNode): SimpleRange {
    return {
      start: { row: node.startPosition.row, column: node.startPosition.column },
      end: { row: node.endPosition.row, column: node.endPosition.column },
    };
  }

  // Helper method to get the scope stack from a starting scope to the root
  private get_scope_stack(start_scope_id: number): number[] {
    const stack: number[] = [];
    let current_id = start_scope_id;
    
    while (current_id !== undefined) {
      stack.push(current_id);
      
      // Find the parent scope
      const parent_edge = this.edges.find(
        e => e.kind === 'scope_to_scope' && e.source_id === current_id
      );
      
      if (parent_edge) {
        current_id = parent_edge.target_id;
      } else {
        break;
      }
    }
    
    return stack;
  }

  // Get all definitions in a specific scope
  private get_defs_in_scope(scope_id: number): number[] {
    return this.edges
      .filter(e => e.kind === 'def_to_scope' && e.target_id === scope_id)
      .map(e => e.source_id);
  }

  // Get all imports in a specific scope
  private get_imports_in_scope(scope_id: number): number[] {
    return this.edges
      .filter(e => e.kind === 'import_to_scope' && e.target_id === scope_id)
      .map(e => e.source_id);
  }

  // Get all nodes of a specific type
  getNodes<T extends Node>(kind: T['kind']): T[] {
    return this.nodes.filter(n => n.kind === kind) as T[];
  }

  // Get edges of a specific type
  getEdges<T extends Edge>(kind: T['kind']): T[] {
    return this.edges.filter(e => e.kind === kind) as T[];
  }

  // Find definitions for a reference
  getDefsForRef(ref_id: number): Def[] {
    const def_ids = this.edges
      .filter(e => e.kind === 'ref_to_def' && e.source_id === ref_id)
      .map(e => e.target_id);
    
    return def_ids
      .map(id => this.nodes.find(n => n.id === id))
      .filter(n => n && n.kind === 'definition') as Def[];
  }

  // Find imports for a reference
  getImportsForRef(ref_id: number): Import[] {
    const import_ids = this.edges
      .filter(e => e.kind === 'ref_to_import' && e.source_id === ref_id)
      .map(e => e.target_id);
    
    return import_ids
      .map(id => this.nodes.find(n => n.id === id))
      .filter(n => n && n.kind === 'import') as Import[];
  }

  // Find all references to a definition
  getRefsForDef(def_id: number): Ref[] {
    const ref_ids = this.edges
      .filter(e => e.kind === 'ref_to_def' && e.target_id === def_id)
      .map(e => e.source_id);
    
    return ref_ids
      .map(id => this.nodes.find(n => n.id === id))
      .filter(n => n && n.kind === 'reference') as Ref[];
  }

  // Find node at a specific position
  findNodeAtPosition(position: Point): Node | null {
    // Find the smallest node that contains the position
    let bestNode: Node | null = null;
    let bestSize = Infinity;
    
    for (const node of this.nodes) {
      const range = node.range;
      
      // Check if position is within this node's range
      if (this.positionInRange(position, range)) {
        // Calculate size (prefer smaller nodes)
        const size = (range.end.row - range.start.row) * 10000 + 
                    (range.end.column - range.start.column);
        
        if (size < bestSize) {
          bestNode = node;
          bestSize = size;
        }
      }
    }
    
    return bestNode;
  }

  // Check if a position is within a range
  private positionInRange(pos: Point, range: SimpleRange): boolean {
    // Check if position is after start
    if (pos.row < range.start.row || 
        (pos.row === range.start.row && pos.column < range.start.column)) {
      return false;
    }
    
    // Check if position is before end
    if (pos.row > range.end.row || 
        (pos.row === range.end.row && pos.column > range.end.column)) {
      return false;
    }
    
    return true;
  }

  // Get all definitions in this graph
  getAllDefs(): Def[] {
    return this.getNodes<Def>('definition');
  }

  // Get all imports in this graph
  getAllImports(): Import[] {
    return this.getNodes<Import>('import');
  }

  // Find a definition by name in the root scope (for exports)
  findExportedDef(name: string): Def | null {
    const rootDefs = this.get_defs_in_scope(this.root_id);
    
    for (const def_id of rootDefs) {
      const def = this.nodes.find(n => n.id === def_id) as Def;
      if (def && def.name === name) {
        return def;
      }
    }
    
    return null;
  }

  // Debug method to print graph structure
  debug_print() {
    console.log('\n=== Graph Structure ===');
    console.log('Nodes:');
    for (const node of this.nodes) {
      console.log(`  ${node.id}: ${node.kind} ${node.kind !== 'scope' ? (node as any).name : ''} at ${node.range.start.row}:${node.range.start.column}`);
    }
    console.log('\nEdges:');
    for (const edge of this.edges) {
      console.log(`  ${edge.source_id} -> ${edge.target_id} (${edge.kind})`);
    }
  }

  // Implement IScopeGraph interface methods
  getCallsFromDef(def_id: number): Call[] {
    // TODO: Implement this method
    return [];
  }

  getSymbolId(def: Def): string {
    return def.symbol_id;
  }

  getDefinitionBySymbol(symbol_id: string): Def | undefined {
    return this.getNodes<Def>('definition').find(d => d.symbol_id === symbol_id);
  }

  getFunctionCalls(): FunctionCall[] {
    // TODO: Implement this method
    return [];
  }

  getImportInfo(): ImportInfo[] {
    // TODO: Implement this method
    return [];
  }

  getCallGraph(options?: CallGraphOptions): CallGraph {
    // TODO: Implement this method
    return {
      nodes: new Map(),
      edges: [],
      top_level_nodes: []
    };
  }
}
