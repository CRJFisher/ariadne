import { Export, FilePath, Import, Language, ModulePath, SourceCode } from "@ariadnejs/types";
import { dirname, join } from "path";
import { SyntaxNode } from "tree-sitter";


export interface ImportExtractionContext {
    source_code: SourceCode;
    file_path: FilePath;
    language: Language;
    ast_root: SyntaxNode;
    exports_by_file: Map<FilePath, Export[]>;
  }

/**
 * Extract imports from AST
 */
export function extract_imports(context: ImportExtractionContext): Import[] {
  // TODO: Implement using tree-sitter queries from import_export/queries/*.scm
  // TODO: resolve imports to exports
  return [];
}

/**
 * Convert a module path to a file path
 */
function resolve_module_to_file(
  module_path: ModulePath,
  from_file: FilePath,
  exports_by_file: Map<FilePath, Export[]>,
  language: Language
): FilePath | undefined {
  // TODO: split this out into language-specific files + functions and marshall them here

  // Try to resolve as a relative path
  const module_str = module_path as string;
  if (module_str.startsWith("./") || module_str.startsWith("../")) {
    const from_dir = dirname(from_file as string);

    let resolved: string;
    if (module_str.startsWith("./")) {
      resolved = from_dir + "/" + module_str.slice(2);
    } else if (module_str.startsWith("../")) {
      const parts = from_dir.split("/");
      const module_parts = module_str.split("/");

      for (const part of module_parts) {
        if (part === "..") {
          parts.pop();
        } else if (part !== ".") {
          parts.push(part);
        }
      }
      resolved = parts.join("/");
    } else {
      resolved = from_dir + "/" + module_str;
    }

    // Try with common extensions
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs"];

    if (exports_by_file.has(resolved as FilePath)) {
      return resolved as FilePath;
    }

    for (const ext of extensions) {
      const with_ext = resolved + ext;
      if (exports_by_file.has(with_ext as FilePath)) {
        return with_ext as FilePath;
      }
    }

    // Also check if the resolved path matches any export file paths
    // Sometimes paths are stored with leading './'
    const normalizedResolved = resolved.replace(/^\.\//, "");
    for (const ext of extensions) {
      const with_ext = normalizedResolved + ext;
      if (exports_by_file.has(with_ext as FilePath)) {
        return with_ext as FilePath;
      }
    }

    // Try index files
    const index_files = ["index.ts", "index.js", "__init__.py", "mod.rs"];
    for (const index of index_files) {
      const index_path = join(resolved, index);
      if (exports_by_file.has(index_path as FilePath)) {
        return index_path as FilePath;
      }
    }
  }

  // 3. For non-relative imports, check special cases by language
  if (language === "rust") {
    if (!module_str.includes("/") && !module_str.includes("::")) {
      const lib_path = "src/lib.rs" as FilePath;
      if (exports_by_file.has(lib_path)) {
        return lib_path;
      }
    }
  }

  // 4. For Python, handle dotted module paths
  if (language === "python" && module_str.includes(".")) {
    // Convert dots to slashes for Python module paths
    const path_with_slashes = module_str.replace(/\./g, "/");

    // Try with .py extension
    const py_path = path_with_slashes + ".py";
    if (exports_by_file.has(py_path as FilePath)) {
      return py_path as FilePath;
    }

    // Try __init__.py in the module directory
    const init_path = path_with_slashes + "/__init__.py";
    if (exports_by_file.has(init_path as FilePath)) {
      return init_path as FilePath;
    }
  }

  // 5. Check known files
  const file_paths = Array.from(exports_by_file.keys());
  for (const file_path of file_paths) {
    const file_str = file_path as string;
    if (
      file_str.endsWith(module_str) ||
      file_str.endsWith(module_str + ".ts") ||
      file_str.endsWith(module_str + ".js") ||
      file_str.endsWith(module_str + ".py") ||
      file_str.endsWith(module_str + ".rs")
    ) {
      return file_path;
    }

    // For Python, also check if module path matches with dots replaced by slashes
    if (language === "python" && module_str.includes(".")) {
      const path_with_slashes = module_str.replace(/\./g, "/");
      if (
        file_str.endsWith(path_with_slashes + ".py") ||
        file_str === path_with_slashes + ".py"
      ) {
        return file_path;
      }
    }
  }

  return undefined;
}
