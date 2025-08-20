/**
 * Path manipulation utilities
 * 
 * Provides helpers for working with file paths
 */

import * as path from 'path';

/**
 * Normalize a file path for consistent comparison
 */
export function normalize_path(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * Get relative path from one file to another
 */
export function get_relative_path(from: string, to: string): string {
  const fromDir = path.dirname(from);
  let relativePath = path.relative(fromDir, to);
  
  // Ensure forward slashes
  relativePath = relativePath.replace(/\\/g, '/');
  
  // Add ./ prefix if not going up directories
  if (!relativePath.startsWith('..')) {
    relativePath = './' + relativePath;
  }
  
  return relativePath;
}

/**
 * Check if a path is absolute
 */
export function is_absolute_path(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

/**
 * Resolve a module path relative to a file
 */
export function resolve_module_path(
  importPath: string,
  fromFile: string,
  baseDir: string = process.cwd()
): string | null {
  // Handle different import patterns
  if (importPath.startsWith('.')) {
    // Relative import
    const fromDir = path.dirname(fromFile);
    return path.resolve(fromDir, importPath);
  } else if (importPath.startsWith('/')) {
    // Absolute import (from project root)
    return path.resolve(baseDir, importPath.slice(1));
  } else {
    // Node module or alias import
    // Would need additional configuration to resolve these
    return null;
  }
}

/**
 * Get the file extension
 */
export function get_extension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Remove file extension
 */
export function remove_extension(filePath: string): string {
  const ext = path.extname(filePath);
  return filePath.slice(0, -ext.length);
}

/**
 * Check if a file path matches a pattern
 */
export function matches_pattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
    .replace(/\//g, '\\/');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

/**
 * Get common base path of multiple paths
 */
export function get_common_base(paths: string[]): string {
  if (paths.length === 0) return '';
  if (paths.length === 1) return path.dirname(paths[0]);
  
  const parts = paths.map(p => p.split('/'));
  const minLength = Math.min(...parts.map(p => p.length));
  
  let commonPath = [];
  for (let i = 0; i < minLength; i++) {
    const part = parts[0][i];
    if (parts.every(p => p[i] === part)) {
      commonPath.push(part);
    } else {
      break;
    }
  }
  
  return commonPath.join('/');
}

/**
 * Check if a path is a test file
 */
export function is_test_file(filePath: string): boolean {
  const fileName = path.basename(filePath);
  const patterns = [
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /_test\.[jt]sx?$/,
    /_spec\.[jt]sx?$/,
    /test_.*\.[jt]sx?$/,
    /.*_test\.py$/,
    /test_.*\.py$/,
    /.*_test\.rs$/
  ];
  
  return patterns.some(pattern => pattern.test(fileName));
}

/**
 * Get the directory name from a path
 */
export function get_directory(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Get the file name without directory
 */
export function get_filename(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Join path segments
 */
export function join_paths(...segments: string[]): string {
  return path.join(...segments).replace(/\\/g, '/');
}