/**
 * Reference type - essential for call chain tracking
 */
export type ReferenceType =
  | "call" // Function/method call
  | "construct" // Constructor call
  | "read" // Variable read
  | "write" // Variable write
  | "member_access" // Property/method access - needed for method resolution
  | "type" // Type reference
  | "assignment" // Assignment target/source connection
  | "return"; // Return value - tracks function return types
