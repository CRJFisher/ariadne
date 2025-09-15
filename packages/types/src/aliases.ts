// File and module identifiers
export type FilePath = string & { __brand: "FilePath" }; // Absolute or relative file path
export type SourceCode = string & { __brand: "SourceCode" }; // Source code

export type QualifiedName = string & { __brand: "QualifiedName" }; // Fully qualified name (e.g., "MyClass.myMethod")

// Type system identifiers
export type TypeString = string & { __brand: "TypeString" }; // Type annotation as string (e.g., "string[]", "Promise<void>")
export type TypeName = string & { __brand: "TypeName" }; // Name of a type
export type ClassName = string & { __brand: "ClassName" }; // Name of a class

// Variable and member identifiers
export type VariableName = string & { __brand: "VariableName" }; // Name of a variable
export type PropertyName = string & { __brand: "PropertyName" }; // Name of a property
export type MethodName = string & { __brand: "MethodName" }; // Name of a method

// Import/export identifiers
export type ImportName = string & { __brand: "ImportName" }; // Name of an import
export type ExportName = string & { __brand: "ExportName" }; // Name of an export

// Documentation
export type DocString = string & { __brand: "DocString" }; // Documentation string

