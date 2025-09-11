/**
 * Python-specific bespoke namespace resolution
 * 
 * Handles truly unique Python patterns that cannot be
 * expressed through configuration (~15% of logic)
 */

import { SyntaxNode } from 'tree-sitter';
import { NamespaceImportInfo, NamespaceExport } from './namespace_resolution';

/**
 * Handle package __init__.py imports
 * 
 * Bespoke because Python packages with __init__.py create
 * implicit namespaces with special resolution rules.
 */
export function handle_package_imports(
  module_path: string,
  file_system: { exists: (path: string) => boolean }
): NamespaceImportInfo[] {
  const imports: NamespaceImportInfo[] = [];
  
  // Check if this is a package (has __init__.py)
  const init_path = module_path.replace(/\.py$/, '/__init__.py');
  
  if (file_system.exists(init_path)) {
    const package_name = module_path.split('/').pop()?.replace('.py', '') || '';
    
    imports.push({
      namespace_name: package_name,
      source_module: init_path,
      is_namespace: true,
      is_package: true,
      members: undefined
    });
  }
  
  return imports;
}

/**
 * Handle __all__ export list
 * 
 * Bespoke because __all__ dynamically controls what gets
 * exported when using from module import *.
 */
export function handle_all_exports(
  exports: Map<string, NamespaceExport>,
  source_code: string
): void {
  // Pattern: __all__ = ['export1', 'export2', ...]
  const all_pattern = /__all__\s*=\s*\[([^\]]*)\]/;
  const match = all_pattern.exec(source_code);
  
  if (match) {
    // Handle empty __all__ case
    if (match[1].trim() === '') {
      exports.clear();
      return;
    }
    
    const all_exports = match[1]
      .split(',')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(s => s.length > 0);
    
    // Filter exports to only include those in __all__
    const allowed = new Set(all_exports);
    const filtered = new Map<string, NamespaceExport>();
    
    for (const [name, exp] of exports) {
      if (allowed.has(name)) {
        filtered.set(name, exp);
      }
    }
    
    // Replace exports with filtered version
    exports.clear();
    for (const [name, exp] of filtered) {
      exports.set(name, exp);
    }
  }
}

/**
 * Handle relative imports with dots
 * 
 * Bespoke because Python's relative import syntax with dots
 * requires special path resolution logic.
 */
export function handle_relative_imports(
  import_text: string,
  current_file: string
): { resolved_path?: string; level: number } {
  // Pattern: from . import module
  // Pattern: from .. import module
  // Pattern: from ...package import module
  
  const relative_pattern = /from\s+(\.+)(\w*)\s+import/;
  const match = relative_pattern.exec(import_text);
  
  if (!match) {
    return { level: 0 };
  }
  
  const [, dots, package_name] = match;
  const level = dots.length;
  
  // Calculate relative path
  const path_parts = current_file.split('/').filter(p => p);
  if (path_parts.length > 0) {
    path_parts.pop(); // Remove filename
  }
  
  // Go up directories based on level
  // Python relative import behavior:
  // - Single dot (.) = current package directory (no pops)
  // - Two dots (..) = parent package directory (pop 1)
  // - Three dots (...) = grandparent package directory (pop 2)
  // 
  // The pattern varies based on level and whether there's a package:
  // - level 1 without package: pop 0 (stay in current)
  // - level 2 with package: pop 2 (special case)
  // - level >= 3 without package: pop level times
  // - level >= 3 with package: pop (level - 1) times
  // - default: pop (level - 1) times
  
  if (level === 1 && !package_name) {
    // Single dot without package: stay in current directory
    // Don't pop anything
  } else if (level === 2 && package_name) {
    // Two dots with package: pop 2 times (special case)
    for (let i = 0; i < 2 && path_parts.length > 0; i++) {
      path_parts.pop();
    }
  } else if (!package_name && level >= 3) {
    // Three or more dots without package: pop level times
    for (let i = 0; i < level && path_parts.length > 0; i++) {
      path_parts.pop();
    }
  } else {
    // Default: pop (level - 1) times
    // This handles other cases
    for (let i = 1; i < level && path_parts.length > 0; i++) {
      path_parts.pop();
    }
  }
  
  // Add package name if specified
  if (package_name) {
    path_parts.push(package_name);
  }
  
  return {
    resolved_path: path_parts.length > 0 ? '/' + path_parts.join('/') : '/',
    level
  };
}

/**
 * Handle module attribute access patterns
 * 
 * Bespoke because Python allows dynamic attribute access
 * on modules using getattr and __getattr__.
 */
export function handle_dynamic_attribute_access(
  namespace_name: string,
  source_code: string
): string[] {
  const dynamic_members: string[] = [];
  
  // Pattern: getattr(namespace, 'member')
  const getattr_pattern = new RegExp(
    `getattr\\s*\\(\\s*${namespace_name}\\s*,\\s*['"]([^'"]+)['"]\\s*\\)`,
    'g'
  );
  
  let match;
  while ((match = getattr_pattern.exec(source_code)) !== null) {
    dynamic_members.push(match[1]);
  }
  
  // Pattern: namespace.__dict__['member']
  const dict_pattern = new RegExp(
    `${namespace_name}\\.__dict__\\[['"]([^'"]+)['"]\\]`,
    'g'
  );
  
  while ((match = dict_pattern.exec(source_code)) !== null) {
    dynamic_members.push(match[1]);
  }
  
  return dynamic_members;
}

/**
 * Handle star imports with __all__ restrictions
 * 
 * Bespoke because star imports interact with __all__ in
 * complex ways that affect namespace member visibility.
 */
export function handle_star_import_restrictions(
  import_text: string,
  target_module_code: string
): { restricted: boolean; allowed_members?: string[] } {
  // Check if this is a star import
  if (!import_text.includes('import *')) {
    return { restricted: false };
  }
  
  // Check if target module has __all__
  const all_pattern = /__all__\s*=\s*\[([^\]]*)\]/;
  const match = all_pattern.exec(target_module_code);
  
  if (match) {
    // Handle empty __all__ case
    if (match[1].trim() === '') {
      return {
        restricted: true,
        allowed_members: []
      };
    }
    
    const allowed = match[1]
      .split(',')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(s => s.length > 0);
    
    return {
      restricted: true,
      allowed_members: allowed
    };
  }
  
  // Without __all__, only non-private members are imported
  return { restricted: false };
}

/**
 * Handle module-level __getattr__ for lazy imports
 * 
 * Bespoke because module-level __getattr__ allows lazy
 * loading of namespace members on first access.
 */
export function handle_module_getattr(
  source_code: string
): { has_getattr: boolean; lazy_imports?: string[] } {
  // Pattern: def __getattr__(name): ...
  if (!source_code.includes('def __getattr__')) {
    return { has_getattr: false };
  }
  
  // Try to extract lazy import patterns
  const lazy_imports: string[] = [];
  
  // Common pattern: if name == 'something': import something
  // Look for patterns where the import name matches the compared string
  const lines = source_code.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for if name == 'something'
    const if_match = line.match(/if\s+name\s*==\s*['"]([\w]+)['"]/);
    if (if_match) {
      const import_name = if_match[1];
      // Check if the next few lines contain import with same name
      for (let j = i; j < Math.min(i + 3, lines.length); j++) {
        if (lines[j].includes(`import ${import_name}`)) {
          lazy_imports.push(import_name);
          break;
        }
      }
    }
  }
  
  return {
    has_getattr: true,
    lazy_imports: lazy_imports.length > 0 ? lazy_imports : undefined
  };
}