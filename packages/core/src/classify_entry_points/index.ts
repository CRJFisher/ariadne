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
  complete_caller_evidence,
  build_class_name_by_constructor_position,
} from "./complete_caller_evidence";
export type { OutsideIndexGrepInput } from "./complete_caller_evidence";
export { load_permanent_registry, PermanentRegistryError } from "./registry_loader";
export {
  BUILTIN_CHECKS,
  type BuiltinCheckFn,
} from "./builtins";
