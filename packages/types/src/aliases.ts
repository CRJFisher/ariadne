// File and module identifiers
export type FilePath = string & { __brand: 'FilePath' }; // Absolute or relative file path
export type SourceCode = string & { __brand: 'SourceCode' }; // Source code

export type QualifiedName = string & { __brand: 'QualifiedName' }; // Fully qualified name (e.g., "MyClass.myMethod")

// Class-related identifiers
export type ClassName = string & { __brand: 'ClassName' }; // Class name
export type MethodName = string & { __brand: 'MethodName' }; // Method name
export type PropertyName = string & { __brand: 'PropertyName' }; // Property name
export type InterfaceName = string & { __brand: 'InterfaceName' }; // Interface name
export type TraitName = string & { __brand: 'TraitName' }; // Trait name (for Rust)

// Function and variable identifiers
export type FunctionName = string & { __brand: 'FunctionName' }; // Function name
export type VariableName = string & { __brand: 'VariableName' }; // Variable name
export type ParameterName = string & { __brand: 'ParameterName' }; // Parameter name

// Type system identifiers
export type TypeName = string & { __brand: 'TypeName' }; // Type name (for type definitions)
export type TypeString = string & { __brand: 'TypeString' }; // Type annotation as string (e.g., "string[]", "Promise<void>")

// Import/export identifiers
export type ExportName = string & { __brand: 'ExportName' }; // Export name (may differ from local name)
export type ImportName = string & { __brand: 'ImportName' }; // Import name (may differ from source name)

// Scope identifiers
export type ScopeId = string & { __brand: 'ScopeId' }; // Unique scope identifier
export type ScopeName = string & { __brand: 'ScopeName' }; // Scope name (if named)

// Documentation
export type DocString = string & { __brand: 'DocString' }; // Documentation string
export type DecoratorName = string & { __brand: 'DecoratorName' }; // Decorator/annotation name

// AST types
export type ASTNodeType = string & { __brand: 'ASTNodeType' }; // AST node type (e.g., "member_expression", "attribute")
export type FieldName = string & { __brand: 'FieldName' }; // AST field name (e.g., "object", "property")

// ============================================================================
// Utility Functions for Branded Types
// ============================================================================

/**
 * Build a QualifiedName from components
 */
export function build_qualified_name(
  class_name: ClassName,
  member_name: MethodName | FunctionName
): QualifiedName {
  return `${class_name}.${member_name}` as QualifiedName;
}

/**
 * Parse a QualifiedName into components
 */
export function parse_qualified_name(name: QualifiedName): {
  className: ClassName;
  memberName: string;
} {
  const last_dot = name.lastIndexOf(".");
  if (last_dot === -1) {
    throw new Error(`Invalid QualifiedName format: "${name}"`);
  }

  return {
    className: name.substring(0, last_dot) as ClassName,
    memberName: name.substring(last_dot + 1),
  };
}
