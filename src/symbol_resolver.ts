import { Def, Import, Point, Ref, ScopeGraph } from './graph';

/**
 * Finds all references to a symbol across a project.
 */
export function find_all_references(
  file_path: string, 
  position: Point,
  file_graphs: Map<string, ScopeGraph>
): Ref[] {

  const graph = file_graphs.get(file_path);
  if (!graph) {
    console.warn(`No graph found for file: ${file_path}`);
    return [];
  }

  // Find the node at the given position
  const node = graph.findNodeAtPosition(position);
  if (!node) {
    return [];
  }

  const allRefs: Ref[] = [];

  if (node.kind === 'definition') {
    // Find all references to this definition in the same file
    const localRefs = graph.getRefsForDef(node.id);
    allRefs.push(...localRefs);

    // Check if this is an exported definition (in root scope)
    const exportedDef = graph.findExportedDef(node.name);
    if (exportedDef && exportedDef.id === node.id) {
      // Search for imports and references in other files
      for (const [otherFile, otherGraph] of file_graphs) {
        if (otherFile === file_path) continue;

        // Find imports with matching name
        const imports = otherGraph.getAllImports();
        for (const imp of imports) {
          if (imp.name === node.name) {
            // Find references to this import
            const importRefs = findReferencesToImport(otherGraph, imp);
            allRefs.push(...importRefs);
          }
        }
      }
    }
  } else if (node.kind === 'reference') {
    // Find the definition this reference points to
    const defs = graph.getDefsForRef(node.id);
    if (defs.length > 0) {
      // When starting from a reference, recursively find all references
      // starting from the definition (which will include the definition itself)
      return find_all_references(file_path, defs[0].range.start, file_graphs);
    }

    // Check if it references an import
    const imports = graph.getImportsForRef(node.id);
    if (imports.length > 0) {
      // Find the source of the import and get all references
      const imp = imports[0];
      // TODO: Parse import statements to find source file
      // For now, search all files for matching exported definition
      for (const [otherFile, otherGraph] of file_graphs) {
        if (otherFile === file_path) continue;
        
        const exportedDef = otherGraph.findExportedDef(imp.name);
        if (exportedDef) {
          return find_all_references(otherFile, exportedDef.range.start, file_graphs);
        }
      }
    }
  } else if (node.kind === 'import') {
    // Find references to this import in the current file
    const importRefs = findReferencesToImport(graph, node);
    allRefs.push(...importRefs);
  }

  return allRefs;
}

/**
 * Finds the definition of a symbol.
 */
export function find_definition(
  file_path: string,
  position: Point,
  file_graphs: Map<string, ScopeGraph>
): Def | null {

  const graph = file_graphs.get(file_path);
  if (!graph) {
    return null;
  }

  // Find the node at the given position
  const node = graph.findNodeAtPosition(position);
  if (!node) {
    return null;
  }

  if (node.kind === 'reference') {
    // Follow RefToDef edge to find local definition
    const defs = graph.getDefsForRef(node.id);
    if (defs.length > 0) {
      return defs[0];
    }

    // Check if it references an import
    const imports = graph.getImportsForRef(node.id);
    if (imports.length > 0) {
      // For now, return the import statement itself (not the cross-file definition)
      // This is the expected behavior according to the test: "Since we don't have cross-file resolution yet"
      const imp = imports[0];
      return {
        id: imp.id,
        kind: 'definition',
        name: imp.name,
        symbol_kind: 'import',
        range: imp.range,
        file_path: file_path
      } as Def;
    }
  } else if (node.kind === 'import') {
    // Use source_name if available (for renamed imports), otherwise use the import name
    const export_name = node.source_name || node.name;
    
    // Find the exported definition in other files
    for (const [otherFile, otherGraph] of file_graphs) {
      if (otherFile === file_path) continue;
      
      const exportedDef = otherGraph.findExportedDef(export_name);
      if (exportedDef) {
        return exportedDef;
      }
    }
  } else if (node.kind === 'definition') {
    // Already at a definition
    return node;
  }

  return null;
}

/**
 * Helper function to find all references to an import within a graph
 */
function findReferencesToImport(graph: ScopeGraph, imp: Import): Ref[] {
  const refs: Ref[] = [];
  
  // Find all references that point to this import
  const allRefs = graph.getNodes<Ref>('reference');
  for (const ref of allRefs) {
    const connectedImports = graph.getImportsForRef(ref.id);
    if (connectedImports.some(i => i.id === imp.id)) {
      refs.push(ref);
    }
  }
  
  return refs;
}
