export { query_tree } from "./query_code_tree";
export {
  process_scopes,
  create_processing_context,
  type ProcessingContext,
  type CaptureNode,
  SemanticCategory,
  SemanticEntity,
} from "./scope_processor";
export {
  ReferenceBuilder,
  ReferenceKind,
  process_references,
  is_reference_capture,
} from "./reference_builder";
