/**
 * Type Flow References - Internal module
 *
 * Not exposed publicly. Used internally by references.ts
 */

// Internal exports for references.ts only
export { extract_type_flow } from "./type_flow_references";
export type {
  LocalTypeFlow,
  LocalConstructorCall,
  LocalAssignmentFlow,
  LocalReturnFlow,
  LocalCallAssignment,
  FlowSource
} from "./type_flow_references";