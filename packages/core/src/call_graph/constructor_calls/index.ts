/**
 * Constructor call detection
 *
 * Configuration-driven dispatcher with bespoke language enhancements
 */

export { find_constructor_calls } from './constructor_calls';
  
// Export type validation functions for Global Assembly phase
export {
  enrich_constructor_calls_with_types,
  validate_constructor,
  batch_validate_constructors,
  get_constructable_types,
} from './constructor_type_resolver';

// Export bidirectional flow functions
export {
  extract_constructor_calls_and_types,
  merge_constructor_types,
  ConstructorCallResult,
  ConstructorTypeAssignment
} from './constructor_type_extraction';



