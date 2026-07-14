export {
  enrich_call_graph,
  type EnrichedCallGraph,
  type EnrichCallGraphOptions,
} from "./enrich_call_graph";
export {
  auto_classify,
  MissingBuiltinError,
  type AutoClassifyOptions,
} from "./auto_classify";
export type {
  AutoClassifyResult,
  ClassifiedEntryPointResult,
  FileLinesReader,
} from "./auto_classify_types";
export { extract_entry_point_diagnostics } from "./extract_entry_point_diagnostics";
export {
  attach_unindexed_test_grep_hits,
  collect_unindexed_test_files,
  build_class_name_by_constructor_position,
} from "./attach_unindexed_test_grep_hits";
export { load_permanent_registry, PermanentRegistryError } from "./registry_loader";
export {
  BUILTIN_CHECKS,
  type BuiltinCheckFn,
} from "./builtins";
