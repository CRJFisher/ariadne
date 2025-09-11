/**
 * Comprehensive branded types for type safety
 * 
 * This file defines ALL branded types used throughout the codebase
 * to ensure type safety and prevent string mixing bugs.
 */

// ============================================================================
// Core Symbol Types
// ============================================================================

/** Simple name of a symbol (unqualified) */
export type SymbolName = string & { __brand: 'SymbolName' };

/** Unique symbol identifier (format: "file_path:line:column:name") */
export type SymbolId = string & { __brand: 'SymbolId' };

/** Symbol reference in code */
export type SymbolRef = string & { __brand: 'SymbolRef' };

// ============================================================================
// Call Graph Types
// ============================================================================

/** Name of the calling function/method */
export type CallerName = string & { __brand: 'CallerName' };

/** Name of the called function/method */
export type CalleeName = string & { __brand: 'CalleeName' };

/** Name of the object receiving a method call */
export type ReceiverName = string & { __brand: 'ReceiverName' };

/** Special constant for module-level context */
export const MODULE_CONTEXT = "<module>" as const;
export type ModuleContext = typeof MODULE_CONTEXT;

/** Caller can be a symbol or module context */
export type CallerContext = CallerName | ModuleContext;

// ============================================================================
// Type System Types
// ============================================================================

/** Type constraint expression (e.g., "T extends BaseClass") */
export type TypeConstraint = string & { __brand: 'TypeConstraint' };

/** Default value expression */
export type DefaultValue = string & { __brand: 'DefaultValue' };

/** Code expression */
export type Expression = string & { __brand: 'Expression' };

/** Initial value for a variable */
export type InitialValue = string & { __brand: 'InitialValue' };

/** Type expression (more specific than TypeString) */
export type TypeExpression = string & { __brand: 'TypeExpression' };

// ============================================================================
// Scope and Path Types
// ============================================================================

/** Scope path (e.g., "global.module.class.method.block") */
export type ScopePath = string & { __brand: 'ScopePath' };

/** Resolution path for symbols */
export type ResolutionPath = string & { __brand: 'ResolutionPath' };

// ============================================================================
// Enum Types (not branded, but defined as unions)
// ============================================================================

/** Visibility modifiers */
export type Visibility = "public" | "private" | "protected" | "internal";

/** Resolution reason for call graph */
export type ResolutionReason = 
  | "imported"
  | "local_definition"
  | "class_member"
  | "inherited"
  | "builtin"
  | "global"
  | "unknown";

/** Type kind for resolved types */
export type ResolvedTypeKind = 
  | "class" 
  | "interface" 
  | "type" 
  | "enum" 
  | "trait"
  | "primitive"
  | "unknown";

/** Call type */
export type CallType = 
  | "direct" 
  | "method" 
  | "constructor" 
  | "dynamic"
  | "macro"
  | "decorator";

// ============================================================================
// Type Guards
// ============================================================================

export function isSymbolName(value: unknown): value is SymbolName {
  return typeof value === 'string' && value.length > 0;
}

export function isSymbolId(value: unknown): value is SymbolId {
  return typeof value === 'string' && value.includes(':');
}

export function isCallerName(value: unknown): value is CallerName {
  return typeof value === 'string' && value.length > 0;
}

export function isCalleeName(value: unknown): value is CalleeName {
  return typeof value === 'string' && value.length > 0;
}

export function isReceiverName(value: unknown): value is ReceiverName {
  return typeof value === 'string' && value.length > 0;
}

export function isModuleContext(value: unknown): value is ModuleContext {
  return value === MODULE_CONTEXT;
}

export function isCallerContext(value: unknown): value is CallerContext {
  return isCallerName(value) || isModuleContext(value);
}

export function isTypeConstraint(value: unknown): value is TypeConstraint {
  return typeof value === 'string' && value.length > 0;
}

export function isDefaultValue(value: unknown): value is DefaultValue {
  return typeof value === 'string';
}

export function isExpression(value: unknown): value is Expression {
  return typeof value === 'string';
}

export function isScopePath(value: unknown): value is ScopePath {
  return typeof value === 'string' && value.includes('.');
}

export function isVisibility(value: unknown): value is Visibility {
  return value === "public" || value === "private" || 
         value === "protected" || value === "internal";
}

export function isResolutionReason(value: unknown): value is ResolutionReason {
  return value === "imported" || value === "local_definition" ||
         value === "class_member" || value === "inherited" ||
         value === "builtin" || value === "global" || value === "unknown";
}

// ============================================================================
// Branded Type Creators (cast functions with validation)
// ============================================================================

export function toSymbolName(value: string): SymbolName {
  if (!value || value.length === 0) {
    throw new Error(`Invalid SymbolName: "${value}"`);
  }
  return value as SymbolName;
}

export function toSymbolId(value: string): SymbolId {
  if (!value || !value.includes(':')) {
    throw new Error(`Invalid SymbolId format: "${value}". Expected format: "file:line:column:name"`);
  }
  return value as SymbolId;
}

export function toCallerName(value: string): CallerName {
  if (!value || value.length === 0) {
    throw new Error(`Invalid CallerName: "${value}"`);
  }
  return value as CallerName;
}

export function toCalleeName(value: string): CalleeName {
  if (!value || value.length === 0) {
    throw new Error(`Invalid CalleeName: "${value}"`);
  }
  return value as CalleeName;
}

export function toReceiverName(value: string): ReceiverName {
  if (!value || value.length === 0) {
    throw new Error(`Invalid ReceiverName: "${value}"`);
  }
  return value as ReceiverName;
}

export function toTypeConstraint(value: string): TypeConstraint {
  if (!value || value.length === 0) {
    throw new Error(`Invalid TypeConstraint: "${value}"`);
  }
  return value as TypeConstraint;
}

export function toDefaultValue(value: string): DefaultValue {
  return value as DefaultValue;
}

export function toExpression(value: string): Expression {
  return value as Expression;
}

export function toInitialValue(value: string): InitialValue {
  return value as InitialValue;
}

export function toTypeExpression(value: string): TypeExpression {
  if (!value || value.length === 0) {
    throw new Error(`Invalid TypeExpression: "${value}"`);
  }
  return value as TypeExpression;
}

export function toScopePath(value: string): ScopePath {
  if (!value || !value.includes('.')) {
    throw new Error(`Invalid ScopePath format: "${value}". Expected format: "scope1.scope2.scope3"`);
  }
  return value as ScopePath;
}

// ============================================================================
// Compound Type Builders
// ============================================================================

import { FilePath, ClassName, MethodName, FunctionName, QualifiedName } from "./aliases";
import { Location } from "./common";

/**
 * Build a SymbolId from components
 */
export function buildSymbolId(
  filePath: FilePath,
  line: number,
  column: number,
  name: SymbolName
): SymbolId {
  return `${filePath}:${line}:${column}:${name}` as SymbolId;
}

/**
 * Parse a SymbolId into components
 */
export function parseSymbolId(id: SymbolId): {
  filePath: FilePath;
  line: number;
  column: number;
  name: SymbolName;
} {
  const parts = id.split(':');
  if (parts.length < 4) {
    throw new Error(`Invalid SymbolId format: "${id}"`);
  }
  
  // Handle file paths with colons (e.g., Windows C:\path)
  const nameIndex = parts.length - 1;
  const columnIndex = parts.length - 2;
  const lineIndex = parts.length - 3;
  const filePathParts = parts.slice(0, lineIndex);
  
  return {
    filePath: filePathParts.join(':') as FilePath,
    line: parseInt(parts[lineIndex], 10),
    column: parseInt(parts[columnIndex], 10),
    name: parts[nameIndex] as SymbolName,
  };
}

/**
 * Build a ScopePath from scope names
 */
export function buildScopePath(scopes: string[]): ScopePath {
  if (scopes.length === 0) {
    throw new Error("ScopePath requires at least one scope");
  }
  return scopes.join('.') as ScopePath;
}

/**
 * Parse a ScopePath into scope names
 */
export function parseScopePath(path: ScopePath): string[] {
  return path.split('.');
}

/**
 * Build a QualifiedName from components
 */
export function buildQualifiedName(
  className: ClassName,
  memberName: MethodName | FunctionName
): QualifiedName {
  return `${className}.${memberName}` as QualifiedName;
}

/**
 * Parse a QualifiedName into components
 */
export function parseQualifiedName(name: QualifiedName): {
  className: ClassName;
  memberName: string;
} {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) {
    throw new Error(`Invalid QualifiedName format: "${name}"`);
  }
  
  return {
    className: name.substring(0, lastDot) as ClassName,
    memberName: name.substring(lastDot + 1),
  };
}

// Re-export QualifiedName from aliases
export { QualifiedName } from "./aliases";

// ============================================================================
// Additional Compound Type Builders for Complex Types
// ============================================================================

import { ModulePath } from "./aliases";

/**
 * Build a ModulePath from components
 */
export function buildModulePath(
  source: string,
  isRelative: boolean = false
): ModulePath {
  let path = source;
  
  // Normalize path separators
  path = path.replace(/\\/g, '/');
  
  // Add relative prefix if needed
  if (isRelative && !path.startsWith('.')) {
    path = './' + path;
  }
  
  // Remove .js/.ts extensions for cleaner paths
  path = path.replace(/\.(js|jsx|ts|tsx|mjs|cjs|mts|cts)$/, '');
  
  return path as ModulePath;
}

/**
 * Parse a ModulePath into components
 */
export function parseModulePath(path: ModulePath): {
  segments: string[];
  isRelative: boolean;
  isScoped: boolean;
  packageName?: string;
  subpath?: string;
} {
  const isRelative = path.startsWith('./') || path.startsWith('../');
  const isScoped = path.startsWith('@');
  const segments = path.split('/').filter(s => s.length > 0);
  
  let packageName: string | undefined;
  let subpath: string | undefined;
  
  if (!isRelative) {
    if (isScoped && segments.length >= 2) {
      // Scoped package like @types/node
      packageName = segments.slice(0, 2).join('/');
      subpath = segments.slice(2).join('/');
    } else if (segments.length > 0) {
      // Regular package like lodash
      packageName = segments[0];
      subpath = segments.slice(1).join('/');
    }
  }
  
  return {
    segments,
    isRelative,
    isScoped,
    packageName,
    subpath: subpath || undefined
  };
}

/**
 * Build a TypeExpression from components
 */
export function buildTypeExpression(
  base: string,
  generics?: string[],
  modifiers?: TypeModifier[]
): TypeExpression {
  let expr = base;
  
  // Add generic parameters
  if (generics && generics.length > 0) {
    expr += `<${generics.join(', ')}>`;
  }
  
  // Apply modifiers
  if (modifiers) {
    for (const modifier of modifiers) {
      switch (modifier) {
        case 'array':
          expr += '[]';
          break;
        case 'nullable':
          expr += ' | null';
          break;
        case 'optional':
          expr += ' | undefined';
          break;
        case 'promise':
          expr = `Promise<${expr}>`;
          break;
        case 'readonly':
          expr = `readonly ${expr}`;
          break;
      }
    }
  }
  
  return toTypeExpression(expr);
}

export type TypeModifier = 'array' | 'nullable' | 'optional' | 'promise' | 'readonly';

/**
 * Parse a TypeExpression into components
 */
export function parseTypeExpression(expr: TypeExpression): {
  base: string;
  generics?: string[];
  isArray: boolean;
  isNullable: boolean;
  isOptional: boolean;
  isPromise: boolean;
  isUnion: boolean;
  unionTypes?: string[];
} {
  const str = expr as string;
  
  // Check for union types
  const isUnion = str.includes(' | ');
  const unionTypes = isUnion ? str.split(' | ').map(s => s.trim()) : undefined;
  
  // Check for Promise
  const isPromise = str.startsWith('Promise<');
  
  // Check for array
  const isArray = str.endsWith('[]');
  
  // Check for nullable/optional
  const isNullable = str.includes(' | null');
  const isOptional = str.includes(' | undefined');
  
  // Extract base type and generics
  let base = str;
  let generics: string[] | undefined;
  
  // Simple generic extraction (doesn't handle nested generics perfectly)
  const genericMatch = /^([^<]+)<([^>]+)>/.exec(str);
  if (genericMatch) {
    base = genericMatch[1];
    generics = genericMatch[2].split(',').map(s => s.trim());
  } else if (isArray) {
    base = str.replace(/\[\]$/, '');
  }
  
  return {
    base,
    generics,
    isArray,
    isNullable,
    isOptional,
    isPromise,
    isUnion,
    unionTypes
  };
}

/**
 * Build a ResolutionPath from file paths
 */
export function buildResolutionPath(paths: FilePath[]): ResolutionPath {
  return paths.join(' -> ') as ResolutionPath;
}

/**
 * Parse a ResolutionPath into file paths
 */
export function parseResolutionPath(path: ResolutionPath): FilePath[] {
  return path.split(' -> ').map(p => p.trim() as FilePath);
}

/**
 * Build a compound identifier (e.g., "module:class:method")
 */
export function buildCompoundIdentifier(
  ...parts: string[]
): string {
  return parts.filter(p => p.length > 0).join(':');
}

/**
 * Parse a compound identifier
 */
export function parseCompoundIdentifier(id: string): string[] {
  return id.split(':').filter(p => p.length > 0);
}