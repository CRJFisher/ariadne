import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolves a module import path to an actual file path.
 * Handles relative imports, file extensions, and index files.
 */
export class ModuleResolver {
  // Common file extensions to try in order of priority
  private static readonly EXTENSIONS = {
    typescript: ['.ts', '.tsx', '.d.ts'],
    javascript: ['.js', '.jsx', '.mjs'],
    python: ['.py', '.pyi'],
    rust: ['.rs']
  };

  // Index file names for different languages
  private static readonly INDEX_FILES = {
    typescript: ['index.ts', 'index.tsx', 'index.d.ts'],
    javascript: ['index.js', 'index.jsx', 'index.mjs'],
    python: ['__init__.py'],
    rust: ['mod.rs']
  };

  /**
   * Resolve a module path from an import statement
   * @param currentFile - The file containing the import statement
   * @param importPath - The import path (e.g., './utils', '../lib/helper', 'lodash')
   * @returns The resolved file path or null if not found
   */
  static resolveModulePath(currentFile: string, importPath: string): string | null {
    // Skip external modules (node_modules, absolute imports without path)
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      // This is likely an external module (npm package, python package, etc.)
      return null;
    }

    // Handle relative imports
    if (importPath.startsWith('.')) {
      return this.resolveRelativePath(currentFile, importPath);
    }

    // Handle absolute imports (less common, but possible)
    if (importPath.startsWith('/')) {
      return this.resolveAbsolutePath(importPath);
    }

    return null;
  }

  /**
   * Resolve a relative import path
   */
  private static resolveRelativePath(currentFile: string, importPath: string): string | null {
    const dir = path.dirname(currentFile);
    const basePath = path.resolve(dir, importPath);
    
    // Determine which language we're dealing with based on current file extension
    const language = this.detectLanguage(currentFile);
    
    // Try exact path first (might be a directory)
    if (fs.existsSync(basePath)) {
      const stats = fs.statSync(basePath);
      if (stats.isDirectory()) {
        // Look for index files in the directory
        return this.findIndexFile(basePath, language);
      } else {
        // It's a file, return it
        return basePath;
      }
    }

    // Try with language-specific extensions
    const extensions = this.getExtensionsForLanguage(language);
    for (const ext of extensions) {
      const pathWithExt = basePath + ext;
      if (fs.existsSync(pathWithExt)) {
        return pathWithExt;
      }
    }

    // Try as a directory with index file
    const indexPath = this.findIndexFile(basePath, language);
    if (indexPath) {
      return indexPath;
    }

    return null;
  }

  /**
   * Resolve an absolute import path
   */
  private static resolveAbsolutePath(importPath: string): string | null {
    // For absolute paths, try the path directly
    if (fs.existsSync(importPath)) {
      return importPath;
    }
    return null;
  }

  /**
   * Find an index file in a directory
   */
  private static findIndexFile(dirPath: string, language: string): string | null {
    if (!fs.existsSync(dirPath)) {
      return null;
    }

    const indexFiles = this.getIndexFilesForLanguage(language);
    for (const indexFile of indexFiles) {
      const indexPath = path.join(dirPath, indexFile);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  /**
   * Detect the language based on file extension
   */
  private static detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    if (['.ts', '.tsx', '.d.ts'].includes(ext)) {
      return 'typescript';
    } else if (['.js', '.jsx', '.mjs'].includes(ext)) {
      return 'javascript';
    } else if (['.py', '.pyi'].includes(ext)) {
      return 'python';
    } else if (['.rs'].includes(ext)) {
      return 'rust';
    }
    
    // Default to TypeScript/JavaScript as most common
    return 'typescript';
  }

  /**
   * Get file extensions to try for a language
   */
  private static getExtensionsForLanguage(language: string): string[] {
    // For JS/TS, try both sets of extensions
    if (language === 'typescript' || language === 'javascript') {
      return [...this.EXTENSIONS.typescript, ...this.EXTENSIONS.javascript];
    }
    
    return this.EXTENSIONS[language as keyof typeof this.EXTENSIONS] || [];
  }

  /**
   * Get index file names for a language
   */
  private static getIndexFilesForLanguage(language: string): string[] {
    // For JS/TS, try both sets of index files
    if (language === 'typescript' || language === 'javascript') {
      return [...this.INDEX_FILES.typescript, ...this.INDEX_FILES.javascript];
    }
    
    return this.INDEX_FILES[language as keyof typeof this.INDEX_FILES] || [];
  }

  /**
   * Resolve Python-specific import patterns
   * @param currentFile - The Python file containing the import
   * @param importPath - The import path (e.g., 'package.module', '..utils')
   * @returns The resolved file path or null if not found
   */
  static resolvePythonImport(currentFile: string, importPath: string): string | null {
    // Handle relative imports with dots
    if (importPath.startsWith('.')) {
      const dots = importPath.match(/^\.+/)?.[0].length || 0;
      const modulePath = importPath.substring(dots);
      
      let dir = path.dirname(currentFile);
      
      // Go up directories based on number of dots
      for (let i = 1; i < dots; i++) {
        dir = path.dirname(dir);
      }
      
      // Convert module path to file path (package.module -> package/module)
      const filePath = modulePath.replace(/\./g, path.sep);
      const basePath = path.join(dir, filePath);
      
      // Try as a Python file
      if (fs.existsSync(basePath + '.py')) {
        return basePath + '.py';
      }
      
      // Try as a package with __init__.py
      const initPath = path.join(basePath, '__init__.py');
      if (fs.existsSync(initPath)) {
        return initPath;
      }
    } else {
      // Handle absolute imports (package.module)
      // This would require knowledge of Python path or project root
      // For now, we'll try relative to the current file's directory
      const parts = importPath.split('.');
      let currentDir = path.dirname(currentFile);
      
      // Try to find the module starting from current directory and going up
      while (currentDir !== path.dirname(currentDir)) {
        const testPath = path.join(currentDir, ...parts);
        
        // Try as a file
        if (fs.existsSync(testPath + '.py')) {
          return testPath + '.py';
        }
        
        // Try as a package
        const initPath = path.join(testPath, '__init__.py');
        if (fs.existsSync(initPath)) {
          return initPath;
        }
        
        currentDir = path.dirname(currentDir);
      }
    }
    
    return null;
  }

  /**
   * Resolve Rust-specific module patterns
   * @param currentFile - The Rust file containing the import
   * @param modulePath - The module path (e.g., 'crate::utils', 'super::helper')
   * @returns The resolved file path or null if not found
   */
  static resolveRustModule(currentFile: string, modulePath: string): string | null {
    const parts = modulePath.split('::');
    const firstPart = parts[0];
    
    let basePath: string;
    
    if (firstPart === 'crate') {
      // Find crate root (look for Cargo.toml)
      basePath = this.findCrateRoot(currentFile);
      parts.shift(); // Remove 'crate'
    } else if (firstPart === 'super') {
      // Go up one module level
      basePath = path.dirname(path.dirname(currentFile));
      parts.shift(); // Remove 'super'
    } else if (firstPart === 'self') {
      // Current module
      basePath = path.dirname(currentFile);
      parts.shift(); // Remove 'self'
    } else {
      // Relative to current module
      basePath = path.dirname(currentFile);
    }
    
    // If no parts left after removing crate/super/self, we're done
    if (parts.length === 0) {
      return basePath.endsWith('.rs') ? basePath : null;
    }
    
    // Build the path from parts
    for (const part of parts) {
      // First try as a file
      const filePath = path.join(basePath, part + '.rs');
      if (fs.existsSync(filePath)) {
        basePath = filePath;
        continue;
      }
      
      // Then try as a directory with mod.rs
      const modPath = path.join(basePath, part, 'mod.rs');
      if (fs.existsSync(modPath)) {
        basePath = modPath;
        continue;
      }
      
      // Module not found
      return null;
    }
    
    return basePath.endsWith('.rs') ? basePath : null;
  }

  /**
   * Find the crate root by looking for Cargo.toml
   */
  private static findCrateRoot(startPath: string): string {
    let currentDir = path.dirname(startPath);
    
    while (currentDir !== path.dirname(currentDir)) {
      if (fs.existsSync(path.join(currentDir, 'Cargo.toml'))) {
        // Found crate root, look for src directory
        const srcDir = path.join(currentDir, 'src');
        if (fs.existsSync(srcDir)) {
          return srcDir;
        }
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    // Fallback to file directory
    return path.dirname(startPath);
  }
}