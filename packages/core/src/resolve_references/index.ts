/**
 * Stage-2 resolution surface: the project-level registries, the resolution
 * store, and the import graph. Modules inside resolve_references/ import
 * siblings directly, never through this barrel — it serves project/,
 * trace_call_graph/, and the core public API only.
 */

export { DefinitionRegistry } from "./registries/definition";
export { TypeRegistry } from "./registries/type";
export { ScopeRegistry } from "./registries/scope";
export { ExportRegistry } from "./registries/export";
export { ReferenceRegistry } from "./registries/reference";
export { ResolutionRegistry } from "./resolution_registry";
export { ImportGraph } from "./import_resolution/import_graph";
