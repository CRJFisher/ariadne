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
  get_member_access_config,
  is_member_access_node,
  get_member_access_fields,
  should_skip_node
} from './language_configs';