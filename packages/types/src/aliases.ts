// File and module identifiers
export type FilePath = string;        // Absolute or relative file path
export type ModulePath = string;      // Module import path (e.g., 'lodash', './utils')
export type SourceCode = string;      // Source code

// Symbol identifiers
export type SymbolId = string;        // Unique symbol identifier (format: "file_path#symbol_name")
export type SymbolName = string;      // Simple name of a symbol (unqualified)
export type QualifiedName = string;   // Fully qualified name (e.g., "MyClass.myMethod")

// Class-related identifiers
export type ClassName = string;       // Class name
export type MethodName = string;      // Method name  
export type PropertyName = string;    // Property name
export type InterfaceName = string;   // Interface name
export type TraitName = string;       // Trait name (for Rust)

// Function and variable identifiers
export type FunctionName = string;    // Function name
export type VariableName = string;    // Variable name
export type ParameterName = string;   // Parameter name

// Type system identifiers
export type TypeName = string;        // Type name (for type definitions)
export type TypeString = string;      // Type annotation as string (e.g., "string[]", "Promise<void>")

// Import/export identifiers
export type NamespaceName = string;   // Namespace name
export type ExportName = string;      // Export name (may differ from local name)
export type ImportName = string;      // Import name (may differ from source name)

// Scope identifiers
export type ScopeId = string;         // Unique scope identifier
export type ScopeName = string;       // Scope name (if named)

// Documentation
export type DocString = string;       // Documentation string
export type DecoratorName = string;   // Decorator/annotation name

// AST types
export type ASTNodeType = string;     // AST node type (e.g., "member_expression", "attribute")
export type FieldName = string;       // AST field name (e.g., "object", "property")