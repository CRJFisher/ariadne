/**
 * Member access expression detection module
 * 
 * Detects namespace member access patterns across different languages
 * e.g., namespace.member, module.function, object.property
 * 
 * This file contains only exports - all implementation is in the respective modules
 */

// Export types
export {
  MemberAccessExpression,
  MemberAccessContext
} from './types';

// Export main function - used by code_graph.ts
export {
  find_member_access_expressions
} from './member_access';

// Export configuration functions - used by type_propagation module
export {
  getMemberAccessConfig,
  isMemberAccessNode,
  getMemberAccessFields,
  shouldSkipNode
} from './language_configs';