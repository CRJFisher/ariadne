import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { Project } from "@ariadnejs/core";
import type { ProjectManager } from "../project_manager";
import { resolve_project } from "./resolve_project";
import { record_tool_call } from "../analytics/analytics";

/**
 * A single tool's definition: schema, metadata, and pure handler function.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: z.ZodType;
  annotations?: ToolAnnotations;
  handler: (project: Project, args: Record<string, unknown>) => Promise<string>;
}

/**
 * A group of related tools that can be enabled/disabled together.
 */
export interface ToolGroupDefinition {
  group_name: string;
  description: string;
  tools: ToolDefinition[];
}

export interface RegisterToolGroupsOptions {
  mcp_server: McpServer;
  project_manager: ProjectManager;
  project_path: string;
  enabled_groups: string[];
}

/**
 * Narrowed interface for McpServer.tool() that avoids TS2589 deep generic
 * instantiation triggered by the SDK's overloaded signatures when given
 * a dynamic ZodRawShape. Safe because we validate with tool.input_schema.parse().
 */
interface ToolRegistrar {
  tool(
    name: string,
    description: string,
    schema: Record<string, z.ZodType>,
    callback: (args: Record<string, unknown>, extra: ToolCallExtra) => Promise<CallToolResult>,
  ): unknown;
}

interface ToolCallExtra {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  requestId: unknown;
  _meta?: Record<string, unknown>;
}

/**
 * Register tool groups with the McpServer.
 *
 * Each tool is registered via `McpServer.tool()` with a callback that:
 * 1. Resolves the project (persistent or scoped based on file/folder filters)
 * 2. Calls the pure handler function
 * 3. Records analytics
 *
 * When `enabled_groups` is empty, all groups are enabled.
 */
export function register_tool_groups(
  groups: ToolGroupDefinition[],
  options: RegisterToolGroupsOptions,
): void {
  const { mcp_server, project_manager, project_path, enabled_groups } = options;
  const registrar: ToolRegistrar = mcp_server;

  const active_groups = enabled_groups.length === 0
    ? groups
    : groups.filter((g) => enabled_groups.includes(g.group_name));

  for (const group of active_groups) {
    for (const tool of group.tools) {
      const shape = extract_zod_shape(tool.input_schema);

      registrar.tool(
        tool.name,
        tool.description,
        shape,
        async (args, extra) => {
          const tool_start = Date.now();
          const tool_use_id = (extra._meta?.["claudecode/toolUseId"] as string) ?? undefined;

          try {
            const parsed_args = tool.input_schema.parse(args);
            const project = await resolve_project(
              parsed_args as { files?: string[]; folders?: string[] },
              project_manager,
              project_path,
            );
            const result = await tool.handler(project, parsed_args);

            record_tool_call({
              tool_name: tool.name,
              arguments: args,
              duration_ms: Date.now() - tool_start,
              success: true,
              request_id: String(extra.requestId),
              tool_use_id,
            });

            return { content: [{ type: "text" as const, text: result }] };
          } catch (error) {
            const error_message = error instanceof Error ? error.message : String(error);

            record_tool_call({
              tool_name: tool.name,
              arguments: args,
              duration_ms: Date.now() - tool_start,
              success: false,
              error_message,
              request_id: String(extra.requestId),
              tool_use_id,
            });

            return {
              content: [{ type: "text" as const, text: `Error: ${error_message}` }],
              isError: true,
            };
          }
        },
      );
    }
  }
}

/**
 * Extract a Zod shape from a ZodType for McpServer.tool().
 *
 * McpServer.tool() expects a ZodRawShape (plain object of Zod schemas).
 * This extracts the shape if the input is a ZodObject,
 * or returns an empty shape for non-object schemas.
 */
function extract_zod_shape(schema: z.ZodType): Record<string, z.ZodType> {
  if (schema instanceof z.ZodObject) {
    return schema.shape;
  }
  return {};
}
