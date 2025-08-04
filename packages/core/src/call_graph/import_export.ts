import { Def, Ref, ScopeGraph } from '../graph';
import { Tree } from 'tree-sitter';
import { FileTypeTrackerData, ProjectTypeRegistryData } from './type_tracking';
import * as TypeTracking from './type_tracking';
import { compute_class_enclosing_range } from './utils';

interface FileCache {
  tree: Tree;
  source_code: string;
  graph: ScopeGraph;
}

/**
 * Initialize import information for a file
 */
export function initialize_file_imports(
  file_path: string,
  tracker: FileTypeTrackerData,
  registry: ProjectTypeRegistryData,
  imports: Array<{
    import_statement: Def;
    imported_function: Def;
    local_name: string;
  }>,
  file_cache: Map<string, FileCache>,
  detect_exports_fn: (file_path: string) => void
): void {
  // First detect exports in the imported files
  const processedFiles = new Set<string>();
  for (const importInfo of imports) {
    const sourceFile = importInfo.imported_function.file_path;
    if (!processedFiles.has(sourceFile)) {
      detect_exports_fn(sourceFile);
      processedFiles.add(sourceFile);
    }
  }
  
  // Track all imported classes
  for (const importInfo of imports) {
    // Check if we can get the type from project registry
    const projectType = TypeTracking.get_imported_type(
      registry,
      importInfo.imported_function.file_path,
      importInfo.imported_function.name
    );
    
    if (projectType) {
      // Use type from project registry
      TypeTracking.set_imported_class(tracker, importInfo.local_name, projectType);
    } else if (importInfo.imported_function.symbol_kind === 'class') {
      // Fallback to direct import resolution
      const classDef = importInfo.imported_function;
      const fileCache = file_cache.get(classDef.file_path);
      
      // Compute enclosing range if needed
      const classDefWithRange = {
        ...classDef,
        enclosing_range: (classDef as any).enclosing_range || 
          (fileCache ? compute_class_enclosing_range(classDef, fileCache.tree) : undefined)
      };
      
      TypeTracking.set_imported_class(tracker, importInfo.local_name, {
        className: importInfo.imported_function.name,
        classDef: classDefWithRange,
        sourceFile: importInfo.imported_function.file_path
      });
    }
  }
}

/**
 * Detect and track exported definitions in a file
 */
export function detect_file_exports(
  file_path: string,
  tracker: FileTypeTrackerData,
  registry: ProjectTypeRegistryData,
  graph: ScopeGraph,
  fileCache: FileCache | undefined
): void {
  if (!graph || !fileCache) return;
  
  // Get all references and definitions in the file
  const refs = graph.getNodes<Ref>('reference');
  const defs = graph.getNodes<Def>('definition');
  
  // Handle Python files - all top-level definitions are implicitly exported
  if (file_path.endsWith('.py')) {
    detect_python_exports(file_path, tracker, registry, defs, fileCache);
    return;
  }
  
  // Handle Rust files - check for pub keyword
  if (file_path.endsWith('.rs')) {
    detect_rust_exports(file_path, tracker, registry, defs, fileCache);
    return;
  }
  
  // Handle JavaScript files
  if (file_path.endsWith('.js')) {
    detect_javascript_exports(file_path, tracker, registry, defs, fileCache);
  }
  
  // Handle ES6 exports (TypeScript and JavaScript)
  detect_es6_exports(file_path, tracker, registry, refs, defs, fileCache);
}

/**
 * Detect Python exports (all top-level non-underscore definitions)
 */
function detect_python_exports(
  file_path: string,
  tracker: FileTypeTrackerData,
  registry: ProjectTypeRegistryData,
  defs: Def[],
  fileCache: FileCache
): void {
  for (const def of defs) {
    // In Python, all top-level definitions are exported unless they start with underscore
    if (def.is_exported !== false && 
        (def.symbol_kind === 'class' || def.symbol_kind === 'function') &&
        !def.name.startsWith('_')) {
      TypeTracking.mark_as_exported(tracker, def.name);
      
      if (def.symbol_kind === 'class') {
        const defWithRange = {
          ...def,
          enclosing_range: (def as any).enclosing_range || 
            compute_class_enclosing_range(def, fileCache.tree)
        };
        TypeTracking.register_export(registry, file_path, def.name, def.name, defWithRange);
      }
    }
  }
}

/**
 * Detect Rust exports (pub keyword)
 */
function detect_rust_exports(
  file_path: string,
  tracker: FileTypeTrackerData,
  registry: ProjectTypeRegistryData,
  defs: Def[],
  fileCache: FileCache
): void {
  for (const def of defs) {
    // In Rust, items marked with 'pub' are exported
    if (def.is_exported === true && 
        (def.symbol_kind === 'struct' || def.symbol_kind === 'enum' || 
         def.symbol_kind === 'function' || def.symbol_kind === 'trait')) {
      TypeTracking.mark_as_exported(tracker, def.name);
      
      if (def.symbol_kind === 'struct') {
        const defWithRange = {
          ...def,
          enclosing_range: (def as any).enclosing_range || 
            compute_class_enclosing_range(def, fileCache.tree)
        };
        TypeTracking.register_export(registry, file_path, def.name, def.name, defWithRange);
      }
    }
  }
}

/**
 * Detect JavaScript CommonJS exports
 */
function detect_javascript_exports(
  file_path: string,
  tracker: FileTypeTrackerData,
  registry: ProjectTypeRegistryData,
  defs: Def[],
  fileCache: FileCache
): void {
  // Check for module.exports = ClassName or module.exports = { ... }
  const moduleExportsMatch = fileCache.source_code.match(/module\.exports\s*=\s*(\w+|\{[^}]+\})/);
  if (moduleExportsMatch) {
    const exportedValue = moduleExportsMatch[1];
    
    // Single export: module.exports = ClassName
    if (!exportedValue.startsWith('{')) {
      const exportedDef = defs.find(d => d.name === exportedValue);
      if (exportedDef) {
        TypeTracking.mark_as_exported(tracker, exportedDef.name);
        
        if (exportedDef.symbol_kind === 'class') {
          const defWithRange = {
            ...exportedDef,
            enclosing_range: (exportedDef as any).enclosing_range || 
              compute_class_enclosing_range(exportedDef, fileCache.tree)
          };
          TypeTracking.register_export(registry, file_path, exportedDef.name, exportedDef.name, defWithRange);
        }
      }
    } else {
      // Object export: module.exports = { func1, Class1 }
      const exportedNames = exportedValue.match(/\w+/g) || [];
      for (const name of exportedNames) {
        const def = defs.find(d => d.name === name);
        if (def) {
          TypeTracking.mark_as_exported(tracker, def.name);
          
          if (def.symbol_kind === 'class') {
            const defWithRange = {
              ...def,
              enclosing_range: (def as any).enclosing_range || 
                compute_class_enclosing_range(def, fileCache.tree)
            };
            TypeTracking.register_export(registry, file_path, def.name, def.name, defWithRange);
          }
        }
      }
    }
  }
  
  // Check for exports.name = value pattern
  const exportsAssignments = fileCache.source_code.matchAll(/exports\.(\w+)\s*=\s*(\w+)/g);
  for (const match of exportsAssignments) {
    const [, exportName, valueName] = match;
    const def = defs.find(d => d.name === valueName);
    if (def) {
      TypeTracking.mark_as_exported(tracker, def.name);
      
      if (def.symbol_kind === 'class') {
        const defWithRange = {
          ...def,
          enclosing_range: (def as any).enclosing_range || 
            compute_class_enclosing_range(def, fileCache.tree)
        };
        TypeTracking.register_export(registry, file_path, def.name, exportName, defWithRange);
      }
    }
  }
}

/**
 * Detect ES6 exports
 */
function detect_es6_exports(
  file_path: string,
  tracker: FileTypeTrackerData,
  registry: ProjectTypeRegistryData,
  refs: Ref[],
  defs: Def[],
  fileCache: FileCache
): void {
  const sourceLines = fileCache.source_code.split('\n');
  
  // Check for export statements in references
  for (const ref of refs) {
    const line = sourceLines[ref.range.start.row];
    if (line) {
      // Check if this reference is part of an export statement
      const beforeRef = line.substring(0, ref.range.start.column);
      if (beforeRef.match(/export\s*(default\s*)?$/)) {
        // This is an exported reference
        TypeTracking.mark_as_exported(tracker, ref.name);
        
        // If it's a class or function, register with project registry
        const def = defs.find(d => d.name === ref.name && (d.symbol_kind === 'class' || d.symbol_kind === 'function'));
        if (def && def.symbol_kind === 'class') {
          const defWithRange = {
            ...def,
            enclosing_range: (def as any).enclosing_range || 
              compute_class_enclosing_range(def, fileCache.tree)
          };
          TypeTracking.register_export(registry, file_path, def.name, def.name, defWithRange);
        }
      }
    }
  }
  
  // Also check for export declarations (export function/class)
  for (const def of defs) {
    if (def.symbol_kind === 'class' || def.symbol_kind === 'function' || def.symbol_kind === 'method') {
      const line = sourceLines[def.range.start.row];
      if (line) {
        const beforeDef = line.substring(0, def.range.start.column);
        if (beforeDef.match(/export\s*(default\s*)?$/)) {
          TypeTracking.mark_as_exported(tracker, def.name);
          
          if (def.symbol_kind === 'class') {
            const defWithRange = {
              ...def,
              enclosing_range: (def as any).enclosing_range || 
                compute_class_enclosing_range(def, fileCache.tree)
            };
            TypeTracking.register_export(registry, file_path, def.name, def.name, defWithRange);
          }
        }
      }
    }
  }
}