export type { PersistenceStorage } from "./storage";
export { FileSystemStorage } from "./file_system_storage";
export type { ContentHash } from "./content_hash";
export { compute_content_hash } from "./content_hash";
export { INDEXER_VERSION } from "./indexer_version";
export {
  CURRENT_SCHEMA_VERSION,
  type CachedIndex,
  serialize_cached_index,
  deserialize_cached_index,
} from "./cached_index";
export {
  to_serializable_semantic_index,
  deserialize_semantic_index,
  validate_semantic_index_shape,
} from "./serialize_index";
export {
  type GitFileState,
  is_git_repo,
  query_git_file_state,
} from "./git_change_detection";
export { resolve_cache_dir, slugify_project_path } from "./resolve_cache_dir";
