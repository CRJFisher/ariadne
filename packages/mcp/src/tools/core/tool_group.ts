import type { ToolGroupDefinition } from "../tool_registry";
import {
  list_entrypoints,
  list_entrypoints_schema,
  type ListEntrypointsRequest,
} from "./list_entrypoints";
import {
  show_call_graph_neighborhood,
  show_call_graph_neighborhood_schema,
  type ShowCallGraphNeighborhoodRequest,
} from "./show_call_graph_neighborhood";

export const CORE_TOOL_GROUP: ToolGroupDefinition = {
  group_name: "core",
  description: "Core entry point detection and call graph analysis tools",
  tools: [
    {
      name: "list_entrypoints",
      description:
        "Lists all entry point functions ordered by call tree complexity. Entry points are functions never called by other functions in the analyzed scope. Shows function signatures with parameters and return types, call tree size, and a reference ID (Ref) for use with other tools. Supports filtering by specific files or folders for scoped analysis. Test functions are marked with [TEST].",
      input_schema: list_entrypoints_schema,
      handler: async (project, args) =>
        list_entrypoints(project, args as ListEntrypointsRequest),
    },
    {
      name: "show_call_graph_neighborhood",
      description:
        "Shows the call graph neighborhood around a callable. Displays callers (upstream, who calls this function) and callees (downstream, what this function calls) with configurable depth. Use the Ref output from list_entrypoints as the symbol_ref input, or construct it as file_path:line#name. Supports filtering by specific files or folders for scoped analysis.",
      input_schema: show_call_graph_neighborhood_schema,
      handler: async (project, args) =>
        show_call_graph_neighborhood(project, args as ShowCallGraphNeighborhoodRequest),
    },
  ],
};
