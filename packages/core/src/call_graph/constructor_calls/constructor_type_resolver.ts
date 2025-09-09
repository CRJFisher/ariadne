/**
 * Constructor Type Resolver
 * 
 * Validates and enriches constructor calls with type registry information during 
 * the Global Assembly phase. This runs AFTER both constructor_calls (Per-File) 
 * and type_registry (Global) have been built.
 * 
 * Key responsibilities:
 * - Validate constructor calls against registered types
 * - Resolve imported class constructors
 * - Check constructor parameter compatibility
 * - Handle type aliases in constructor calls
 */

import { ConstructorCallInfo } from '@ariadnejs/types';
import { TypeRegistry } from '../../type_analysis/type_registry';

/**
 * Extended constructor call info with type validation
 */
export interface ConstructorCallWithType extends ConstructorCallInfo {
  is_valid?: boolean;              // Whether type exists in registry
  resolved_type?: string;          // Fully qualified type name
  expected_params?: ParameterInfo[]; // Expected constructor parameters
  param_mismatch?: boolean;        // If params don't match signature
  is_imported?: boolean;           // If this is an imported class
  type_kind?: 'class' | 'interface' | 'struct' | 'trait'; // What kind of type
}

/**
 * Parameter information for validation
 */
export interface ParameterInfo {
  name: string;
  type?: string;
  is_optional?: boolean;
  default_value?: string;
}

/**
 * Enrich constructor calls with type registry information
 * 
 * This function runs during Global Assembly after both constructor calls
 * and type registry have been built.
 * 
 * @param constructor_calls Constructor calls from Per-File analysis
 * @param type_registry Type registry from Global Assembly
 * @param imports Import information for resolving cross-file types
 * @returns Constructor calls enriched with type validation
 */
export function enrich_constructor_calls_with_types(
  constructor_calls: readonly ConstructorCallInfo[],
  type_registry: TypeRegistry | undefined,
  imports?: Map<string, ImportInfo[]>
): readonly ConstructorCallWithType[] {
  if (!type_registry) {
    // No registry available, return calls as-is
    return constructor_calls;
  }

  return constructor_calls.map(call => {
    const enriched: ConstructorCallWithType = { ...call };
    
    // Get the file's imports if available
    const file_imports = call.location.file_path ? imports?.get(call.location.file_path) : undefined;

    // Try to validate the constructor
    const validation = validate_constructor(
      call.constructor_name,
      type_registry,
      call.location.file_path,
      file_imports
    );

    if (validation) {
      enriched.is_valid = validation.is_valid;
      enriched.resolved_type = validation.resolved_type;
      enriched.expected_params = validation.expected_params;
      enriched.is_imported = validation.is_imported;
      enriched.type_kind = validation.type_kind;

      // Check parameter compatibility
      if (validation.expected_params && call.arguments) {
        enriched.param_mismatch = check_param_mismatch(
          call.arguments,
          validation.expected_params
        );
      }
    } else {
      enriched.is_valid = false;
    }

    return enriched;
  });
}

/**
 * Import information for cross-file resolution
 */
interface ImportInfo {
  name: string;
  source: string;
  alias?: string;
  is_type_import?: boolean;
}

/**
 * Validation result
 */
interface ValidationResult {
  is_valid: boolean;
  resolved_type?: string;
  expected_params?: ParameterInfo[];
  is_imported?: boolean;
  type_kind?: 'class' | 'interface' | 'struct' | 'trait';
}

/**
 * Validate a constructor call against the type registry
 * 
 * @param class_name Name of the class being constructed
 * @param registry Type registry
 * @param file_path File where the constructor call is made
 * @param imports Import information for the file
 * @returns Validation result or undefined if not found
 */
export function validate_constructor(
  class_name: string,
  registry: TypeRegistry,
  file_path: string,
  imports?: ImportInfo[]
): ValidationResult | undefined {
  // First check if it's a built-in type
  const language = detect_language(file_path);
  const builtins = registry.builtins.get(language);
  if (builtins?.has(class_name)) {
    return {
      is_valid: true,
      resolved_type: class_name,
      type_kind: 'class'
    };
  }

  // Check if it's an imported type
  if (imports) {
    const import_info = find_import(class_name, imports);
    if (import_info) {
      const resolved = resolve_imported_type(
        import_info,
        registry,
        file_path
      );
      
      if (resolved) {
        return {
          is_valid: true,
          resolved_type: resolved.qualified_name,
          expected_params: resolved.constructor_params,
          is_imported: true,
          type_kind: resolved.type_kind
        };
      }
    }
  }

  // Check local types in the same file
  const local_type = find_local_type(class_name, file_path, registry);
  if (local_type) {
    return {
      is_valid: true,
      resolved_type: local_type.qualified_name,
      expected_params: local_type.constructor_params,
      type_kind: local_type.type_kind
    };
  }

  // Check if it's a type alias
  const aliased = registry.aliases.get(class_name);
  if (aliased) {
    const type_def = registry.types.get(aliased);
    if (type_def && is_constructable(type_def.kind)) {
      return {
        is_valid: true,
        resolved_type: aliased,
        expected_params: extract_constructor_params(type_def),
        type_kind: type_def.kind as any
      };
    }
  }

  return undefined;
}

/**
 * Find an import by name
 */
function find_import(
  name: string,
  imports: ImportInfo[]
): ImportInfo | undefined {
  return imports.find(imp => 
    imp.name === name || imp.alias === name
  );
}

/**
 * Resolved type information
 */
interface ResolvedType {
  qualified_name: string;
  constructor_params?: ParameterInfo[];
  type_kind: 'class' | 'interface' | 'struct' | 'trait';
}

/**
 * Resolve an imported type through the registry
 */
function resolve_imported_type(
  import_info: ImportInfo,
  registry: TypeRegistry,
  importing_file: string
): ResolvedType | undefined {
  // Try to resolve through the import cache
  const cache_key = `${importing_file}#${import_info.name}`;
  const cached = registry.import_cache.get(cache_key);
  
  if (cached) {
    const type_def = registry.types.get(cached);
    if (type_def && is_constructable(type_def.kind)) {
      return {
        qualified_name: cached,
        constructor_params: extract_constructor_params(type_def),
        type_kind: type_def.kind as any
      };
    }
  }

  // Try to resolve through exports
  const source_path = resolve_import_path(import_info.source, importing_file);
  const exports = registry.exports.get(source_path);
  
  if (exports) {
    const qualified_name = exports.get(import_info.name);
    if (qualified_name) {
      const type_def = registry.types.get(qualified_name);
      if (type_def && is_constructable(type_def.kind)) {
        // Note: Cannot cache in readonly import_cache
        // In a real implementation, caching would be handled at registry build time
        
        return {
          qualified_name,
          constructor_params: extract_constructor_params(type_def),
          type_kind: type_def.kind as any
        };
      }
    }
  }

  return undefined;
}

/**
 * Find a local type in the same file
 */
function find_local_type(
  type_name: string,
  file_path: string,
  registry: TypeRegistry
): ResolvedType | undefined {
  const file_types = registry.files.get(file_path);
  
  if (file_types) {
    for (const qualified_name of file_types) {
      // Check if the qualified name ends with the type name
      if (qualified_name.endsWith(`#${type_name}`) ||
          qualified_name.endsWith(`::${type_name}`) || 
          qualified_name.endsWith(`.${type_name}`) ||
          qualified_name === type_name) {
        const type_def = registry.types.get(qualified_name);
        if (type_def && is_constructable(type_def.kind)) {
          return {
            qualified_name,
            constructor_params: extract_constructor_params(type_def),
            type_kind: type_def.kind as any
          };
        }
      }
    }
  }

  return undefined;
}

/**
 * Check if a type kind is constructable
 */
function is_constructable(kind: string): boolean {
  return ['class', 'struct'].includes(kind);
}

/**
 * Extract constructor parameters from a type definition
 */
function extract_constructor_params(type_def: any): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  
  // Look for constructor/init method in members
  if (type_def.members) {
    for (const [name, member] of type_def.members) {
      if (member.kind === 'constructor' || 
          name === 'constructor' || 
          name === '__init__' ||
          name === 'new') {
        // Extract parameter information if available
        if (member.parameters) {
          return member.parameters.map((p: any) => ({
            name: p.name,
            type: p.type,
            is_optional: p.is_optional || false,
            default_value: p.default_value
          }));
        }
      }
    }
  }

  return params;
}

/**
 * Check if arguments match expected parameters
 */
function check_param_mismatch(
  actual_args: any[],
  expected_params: ParameterInfo[]
): boolean {
  // Count required parameters
  const required_count = expected_params.filter(p => !p.is_optional).length;
  const actual_count = actual_args.length;
  
  // Simple check: too few arguments
  if (actual_count < required_count) {
    return true;
  }
  
  // Simple check: too many arguments (unless there's a rest parameter)
  const max_count = expected_params.length;
  if (actual_count > max_count && !has_rest_parameter(expected_params)) {
    return true;
  }
  
  return false;
}

/**
 * Check if parameters include a rest/varargs parameter
 */
function has_rest_parameter(params: ParameterInfo[]): boolean {
  // This would need language-specific logic
  // For now, assume no rest parameters
  return false;
}

/**
 * Detect language from file extension
 */
function detect_language(file_path: string): string {
  const ext = file_path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    default:
      return 'unknown';
  }
}

/**
 * Resolve import path to absolute path
 */
function resolve_import_path(import_source: string, importing_file: string): string {
  // Simplified path resolution
  // In a real implementation, this would handle:
  // - Relative paths (./foo, ../bar)
  // - Module paths (lodash, @types/node)
  // - Path aliases (@/components)
  
  if (import_source.startsWith('.')) {
    // Relative import - resolve relative to importing file
    const dir = importing_file.substring(0, importing_file.lastIndexOf('/'));
    return `${dir}/${import_source}`;
  }
  
  // Assume it's a module path for now
  return import_source;
}

/**
 * Batch validate multiple constructor calls
 * 
 * @param calls Constructor calls to validate
 * @param registry Type registry
 * @param imports Import map by file
 * @returns Map of validation results by call
 */
export function batch_validate_constructors(
  calls: ConstructorCallInfo[],
  registry: TypeRegistry,
  imports: Map<string, ImportInfo[]>
): Map<ConstructorCallInfo, ValidationResult> {
  const results = new Map<ConstructorCallInfo, ValidationResult>();
  
  for (const call of calls) {
    const file_imports = call.file_path ? imports.get(call.file_path) : undefined;
    const validation = validate_constructor(
      call.class_name,
      registry,
      call.file_path || '',
      file_imports
    );
    
    if (validation) {
      results.set(call, validation);
    }
  }
  
  return results;
}

/**
 * Get all constructable types from the registry
 * 
 * @param registry Type registry
 * @param language Optional language filter
 * @returns Array of constructable type names
 */
export function get_constructable_types(
  registry: TypeRegistry,
  language?: string
): string[] {
  const types: string[] = [];
  
  for (const [name, type_def] of registry.types) {
    if (is_constructable(type_def.kind)) {
      if (language) {
        // Extract file path from qualified name (format: file_path#type_name)
        const file_path = name.substring(0, name.lastIndexOf('#'));
        if (file_path && detect_language(file_path) === language) {
          types.push(name);
        }
      } else {
        types.push(name);
      }
    }
  }
  
  // Add built-in types if language specified
  if (language) {
    const builtins = registry.builtins.get(language);
    if (builtins) {
      types.push(...builtins);
    }
  }
  
  return types;
}