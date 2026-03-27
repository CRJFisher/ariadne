export type { PersistenceStorage } from "./storage";
export { FileSystemStorage } from "./file_system_storage";
export type { ContentHash } from "./content_hash";
export { compute_content_hash } from "./content_hash";
export {
  CURRENT_SCHEMA_VERSION,
  type CacheManifest,
  type CacheManifestEntry,
  serialize_manifest,
  deserialize_manifest,
} from "./cache_manifest";
export {
  serialize_semantic_index,
  deserialize_semantic_index,
  validate_semantic_index_shape,
} from "./serialize_index";
export {
  type GitTreeHash,
  type GitFileState,
  is_git_repo,
  query_git_file_state,
} from "./git_change_detection";
