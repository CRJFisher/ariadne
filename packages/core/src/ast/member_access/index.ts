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

// Export main functions from member_access.ts
export {
  find_member_access_expressions,
  traverse_for_member_access
} from './member_access';

// Export configuration functions from language_configs.ts
export {
  getMemberAccessConfig,
  isMemberAccessNode,
  getMemberAccessFields,
  shouldSkipNode
} from './language_configs';

// Export JavaScript/TypeScript bespoke handlers (for testing)
export {
  handle_javascript_optional_chaining,
  handle_javascript_computed_access
} from './member_access.javascript';

// Export Python bespoke handlers (for testing)
export {
  handle_python_getattr
} from './member_access.python';

// Export Rust bespoke handlers (for testing)
export {
  handle_rust_field_expression
} from './member_access.rust';