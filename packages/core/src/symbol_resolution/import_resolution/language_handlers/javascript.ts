/**
 * JavaScript/TypeScript import handler
 *
 * Handles ES6 modules and CommonJS import resolution
 * following Node.js module resolution algorithm.
 */

import * as path from "path";
import * as fs from "fs";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Import,
  Export,
  SymbolDefinition,
  DefaultImport,
  NamespaceImport,
  NamedImport,
  DefaultExport,
  NamedExport,
} from "@ariadnejs/types";
import type { LanguageImportHandler } from "../import_types";
import {
  find_file_with_extensions,
  resolve_node_modules_path,
} from "../module_resolver";

/**
 * Create a JavaScript/TypeScript import handler
 */
export function create_javascript_handler(): LanguageImportHandler {
  return {
    resolve_module_path: resolve_js_module_path,
    match_import_to_export: match_js_import_to_export,
  };
}

/**
 * Resolve JavaScript/TypeScript module paths
 */
function resolve_js_module_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // 1. Try relative paths
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    return resolve_js_relative_path(import_path, importing_file);
  }

  // 2. Try absolute paths (less common in JS/TS)
  if (import_path.startsWith("/")) {
    return resolve_absolute_path(import_path);
  }

  // 3. Try package resolution (node_modules, built-ins)
  return resolve_js_package_path(import_path, importing_file);
}

/**
 * Resolve relative JavaScript imports
 */
function resolve_js_relative_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  const dir = path.dirname(importing_file);
  const base_path = path.resolve(dir, import_path);

  // Check if it's a directory with index file
  if (fs.existsSync(base_path)) {
    const stats = fs.statSync(base_path);
    if (stats.isDirectory()) {
      // Look for index files
      const index_files = ["index.ts", "index.tsx", "index.js", "index.jsx"];
      for (const index of index_files) {
        const index_path = path.join(base_path, index);
        if (fs.existsSync(index_path)) {
          return index_path as FilePath;
        }
      }
    }
  }

  // Try with common JS/TS extensions
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  return find_file_with_extensions(base_path, extensions);
}

/**
 * Resolve absolute paths (less common in JS/TS)
 */
function resolve_absolute_path(import_path: string): FilePath | null {
  if (fs.existsSync(import_path)) {
    return import_path as FilePath;
  }

  // Try with extensions
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  return find_file_with_extensions(import_path, extensions);
}

/**
 * Resolve package imports (node_modules and built-ins)
 */
function resolve_js_package_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // Check if it's a Node.js built-in module
  if (is_nodejs_builtin(import_path)) {
    return null; // Built-ins have no file path
  }

  // Handle scoped packages
  const package_name = import_path.startsWith("@")
    ? import_path.split("/").slice(0, 2).join("/")
    : import_path.split("/")[0];

  // If the import has a subpath (e.g., "lodash/debounce"), handle it
  if (import_path !== package_name) {
    // First resolve the package location
    const package_resolved = resolve_node_modules_path(package_name, importing_file);
    if (!package_resolved) {
      return null;
    }

    // Extract the subpath
    const subpath = import_path.substring(package_name.length + 1);
    const package_dir = path.dirname(package_resolved);
    const subpath_resolved = path.join(package_dir, subpath);

    // Try the subpath directly
    if (fs.existsSync(subpath_resolved)) {
      const stats = fs.statSync(subpath_resolved);
      if (stats.isFile()) {
        return subpath_resolved as FilePath;
      }
      // If directory, look for index
      if (stats.isDirectory()) {
        const index_files = ["index.ts", "index.tsx", "index.js", "index.jsx"];
        for (const index of index_files) {
          const index_path = path.join(subpath_resolved, index);
          if (fs.existsSync(index_path)) {
            return index_path as FilePath;
          }
        }
      }
    }

    // Try with extensions
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
    return find_file_with_extensions(subpath_resolved, extensions);
  }

  // No subpath, just resolve the package itself
  return resolve_node_modules_path(package_name, importing_file);
}

/**
 * Check if a module is a Node.js built-in
 */
function is_nodejs_builtin(module_name: string): boolean {
  // Core Node.js modules
  const builtins = new Set([
    "assert", "buffer", "child_process", "cluster", "crypto", "dgram",
    "dns", "domain", "events", "fs", "http", "https", "net", "os",
    "path", "punycode", "querystring", "readline", "repl", "stream",
    "string_decoder", "timers", "tls", "tty", "url", "util", "v8",
    "vm", "zlib", "worker_threads", "inspector", "async_hooks",
    "http2", "perf_hooks", "process", "console",
  ]);

  // Handle node: prefix
  if (module_name.startsWith("node:")) {
    return true;
  }

  // Check if it's in the built-ins set
  const base_module = module_name.split("/")[0];
  return builtins.has(base_module);
}

/**
 * Match JavaScript imports to their corresponding exports
 */
function match_js_import_to_export(
  import_stmt: Import,
  source_exports: readonly Export[],
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): Map<SymbolName, SymbolId> {
  const result = new Map<SymbolName, SymbolId>();

  switch (import_stmt.kind) {
    case "default":
      return match_default_import(import_stmt as DefaultImport, source_exports);

    case "namespace":
      return match_namespace_import(import_stmt as NamespaceImport, source_exports, source_symbols);

    case "named":
      return match_named_import(import_stmt as NamedImport, source_exports);

    case "side_effect":
      // Side effect imports don't import any symbols
      return result;

    default:
      return result;
  }
}

/**
 * Match a default import to the default export
 */
function match_default_import(
  import_stmt: DefaultImport | Import,
  source_exports: readonly Export[]
): Map<SymbolName, SymbolId> {
  const result = new Map<SymbolName, SymbolId>();

  // Handle both types - use name field
  const local_name = (import_stmt as Import).name;

  // Find the default export
  for (const exp of source_exports) {
    if (exp.kind === "default") {
      result.set(local_name, (exp as Export).symbol);
      break;
    }
  }

  return result;
}

/**
 * Match a namespace import to all exports
 */
function match_namespace_import(
  import_stmt: NamespaceImport | Import,
  source_exports: readonly Export[],
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): Map<SymbolName, SymbolId> {
  const result = new Map<SymbolName, SymbolId>();

  // For namespace imports, we create a synthetic symbol that represents
  // the namespace object. However, for simplicity in this implementation,
  // we'll just map the namespace name to the first export's symbol as a placeholder.
  // In a full implementation, this would create a proper namespace symbol.

  // Note: A more complete implementation would:
  // 1. Create a synthetic namespace symbol
  // 2. Track all exports as properties of that namespace
  // 3. Handle property access resolution separately

  // For now, we'll just indicate that the namespace was imported
  // by mapping it to a synthetic symbol (we'll use the first export if available)
  if (source_exports.length > 0) {
    // Handle both NamespaceImport with namespace_name and Import with name
    const namespace_name = (import_stmt as NamespaceImport).namespace_name ||
                          ((import_stmt as Import).name as unknown as NamespaceName);
    // Convert NamespaceName to SymbolName (both are branded strings)
    const namespace_as_symbol = namespace_name as unknown as SymbolName;
    result.set(namespace_as_symbol, source_exports[0].symbol);
  }

  return result;
}

/**
 * Match named imports to named exports
 */
function match_named_import(
  import_stmt: NamedImport | Import,
  source_exports: readonly Export[]
): Map<SymbolName, SymbolId> {
  const result = new Map<SymbolName, SymbolId>();

  // Handle both NamedImport with imports array and simple Import with name
  const import_items = import_stmt.imports || [{ name: (import_stmt as Import).name, alias: undefined }];

  for (const import_item of import_items) {
    const imported_name = import_item.name;
    const local_name = import_item.alias || import_item.name;

    // Find matching export
    for (const exp of source_exports) {
      if (exp.kind === "named") {
        const named_export = exp as NamedExport;
        // Handle simple Export type with just name/symbol or NamedExport with exports array
        if ((named_export ).exports) {
          for (const export_item of (named_export ).exports) {
            const export_name = export_item.export_name || export_item.local_name;
            if (export_name === imported_name) {
              result.set(local_name, named_export.symbol);
              break;
            }
          }
        } else if ((exp as Export).name === imported_name) {
          // Simple Export with matching name
          result.set(local_name, (exp as Export).symbol);
        }
      }
    }
  }

  return result;
}