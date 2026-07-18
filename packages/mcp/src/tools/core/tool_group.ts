import type { ToolGroupDefinition } from "../register_tools";
import {
  list_entrypoints,
  list_entrypoints_schema,
  type ListEntrypointsConfig,
  type ListEntrypointsRequest,
} from "./list_entrypoints";
import {
  show_call_graph_neighborhood,
  show_call_graph_neighborhood_schema,
  type ShowCallGraphNeighborhoodRequest,
} from "./show_call_graph_neighborhood";

export interface CoreToolGroupConfig {
  list_entrypoints: ListEntrypointsConfig;
}

/**
 * Build the `core` tool group with server-level configuration baked into the
 * handler closures. `show_suppressed` lives on the server config (CLI flag /
 * env var) rather than on the per-call schema so triage workflows enable it
 * once via `.mcp.json` and everyday agents see the clean default output.
 */
export function create_core_tool_group(
  config: CoreToolGroupConfig
): ToolGroupDefinition {
  return {
    group_name: "core",
    description: "Core entry point detection and call graph analysis tools",
    tools: [
      {
        name: "list_entrypoints",
        description:
          "Lists all entry point functions ordered by call tree complexity. Entry points are functions never called by other functions in the analyzed scope. Output excludes known false positives (framework-invoked routes such as Flask `@app.route`, Python dunder protocol methods, dynamic dispatch, indirect-only calls, test-only code). Shows function signatures with parameters and return types, call tree size, and a reference ID (Ref) for use with other tools. Supports filtering by specific files or folders. Test functions are marked with [TEST]. For triage workflows that need to audit the suppressed bucket, ask the operator to start the MCP server with `--show-suppressed` (or `ARIADNE_SHOW_SUPPRESSED=1`); a clearly-delimited \"Suppressed\" section will be appended with a `[group_id: detail]` tag per entry.",
        input_schema: list_entrypoints_schema,
        handler: async (project, args) =>
          list_entrypoints(
            project,
            args as ListEntrypointsRequest,
            config.list_entrypoints
          ),
      },
      {
        name: "show_call_graph_neighborhood",
        description:
          "Shows the call graph neighborhood around a callable. Displays callers (upstream, who calls this function) and callees (downstream, what this function calls) with configurable depth. Use the Ref output from list_entrypoints as the symbol_ref input, or construct it as file_path:line#name. Supports filtering by specific files or folders for scoped analysis.",
        input_schema: show_call_graph_neighborhood_schema,
        handler: async (project, args, project_path) =>
          show_call_graph_neighborhood(
            project,
            args as ShowCallGraphNeighborhoodRequest,
            project_path
          ),
      },
    ],
  };
}
