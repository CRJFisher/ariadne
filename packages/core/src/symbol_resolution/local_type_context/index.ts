/**
 * Local Type Context Module
 *
 * Provides lightweight type tracking for method resolution without full type flow analysis
 */

export {
  build_local_type_context,
  get_variable_type,
  get_expression_type,
  type LocalTypeContext,
  type ConstructorCall,
  type TypeGuard,
} from "./local_type_context";