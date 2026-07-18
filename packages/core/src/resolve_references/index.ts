/**
 * Stage-2 resolution surface: the project-level registries, the resolution
 * store, and the import graph. Modules inside resolve_references/ import
 * siblings directly, never through this barrel — it exists for consumers
 * outside the stage (today the core public API in src/index.ts).
 */

export { DefinitionRegistry } from "./registries/definition";
export { TypeRegistry } from "./registries/type";
export { ScopeRegistry } from "./registries/scope";
export { ExportRegistry } from "./registries/export";
export { ReferenceRegistry } from "./registries/reference";
export { ResolutionRegistry } from "./resolution_registry";
export { ImportGraph } from "./import_resolution/import_graph";
