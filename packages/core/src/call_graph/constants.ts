/**
 * Immutable constants for call graph analysis
 * Using const assertions for compile-time literal types
 */

/**
 * Default configuration for two-phase build
 */
export const DEFAULT_BUILD_CONFIG = {
  parallel: true,
  maxParallelFiles: 100,
  batchSize: 50,
  includePrivate: false,
  includeTests: false
} as const;

/**
 * File extensions by language
 */
export const LANGUAGE_EXTENSIONS = {
  typescript: ['.ts', '.tsx', '.d.ts'] as const,
  javascript: ['.js', '.jsx', '.mjs', '.cjs'] as const,
  python: ['.py', '.pyi'] as const,
  rust: ['.rs'] as const
} as const;

/**
 * Symbol kinds that represent callable entities
 */
export const CALLABLE_SYMBOL_KINDS = [
  'function',
  'method',
  'constructor',
  'async_function',
  'generator_function'
] as const;

/**
 * Symbol kinds that represent type definitions
 */
export const TYPE_SYMBOL_KINDS = [
  'class',
  'interface',
  'type',
  'enum',
  'struct',
  'trait'
] as const;

/**
 * Maximum file size for tree-sitter parsing (32KB)
 */
export const MAX_FILE_SIZE = 32 * 1024; // 32KB

/**
 * Type guards using const arrays
 */
export function isCallableSymbolKind(kind: string): kind is typeof CALLABLE_SYMBOL_KINDS[number] {
  return (CALLABLE_SYMBOL_KINDS as readonly string[]).includes(kind);
}

export function isTypeSymbolKind(kind: string): kind is typeof TYPE_SYMBOL_KINDS[number] {
  return (TYPE_SYMBOL_KINDS as readonly string[]).includes(kind);
}

export function isValidLanguageExtension(
  language: keyof typeof LANGUAGE_EXTENSIONS,
  extension: string
): boolean {
  const extensions = LANGUAGE_EXTENSIONS[language];
  return (extensions as readonly string[]).includes(extension);
}