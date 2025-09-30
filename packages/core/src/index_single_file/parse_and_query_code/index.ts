export { query_tree_and_parse_captures } from "./parse_and_query_code";
export {
  process_scopes,
  create_processing_context,
  process_file,
  type ProcessingContext,
  type RawCapture,
  SemanticCategory,
  SemanticEntity
} from "./scope_processor";
export {
  ReferenceBuilder,
  ReferenceKind,
  process_references,
  is_reference_capture
} from "./reference_builder";
