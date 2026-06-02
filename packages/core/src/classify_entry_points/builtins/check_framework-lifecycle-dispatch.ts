// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// Method-level NestJS handler decorators (HTTP routes via @Get/@Post/etc., WebSocket handlers via @SubscribeMessage, microservice handlers via @MessagePattern/@EventPattern/@GrpcMethod, scheduler hooks via @Cron/@Interval/@Timeout). The NestJS runtime reads these decorators at startup and dispatches to the method without a textual call site, so the resolver sees zero inbound edges and marks the method unreachable. The decorator block immediately above the definition is the discriminant. Does not cover constructors of @Injectable/@Controller/@WebSocketGateway classes — the framework-registering decorator sits on the enclosing class, not on the constructor, and the current signal library has no enclosing-class-decorator op. That sub-pattern is filed as an signal-library gap.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

function extract_decorator_block(
  lines: readonly string[],
  start_line_1_based: number,
): string {
  const collected: string[] = [];
  for (let i = start_line_1_based - 2; i >= 0; i--) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith("@") || trimmed.startsWith("#[") || trimmed.startsWith("#![")) {
      collected.unshift(line);
      continue;
    }
    break;
  }
  return collected.join("\n");
}

export function check_framework_lifecycle_dispatch(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = new RegExp("^\\s*@(Get|Post|Put|Delete|Patch|All|Options|Head|Search|SubscribeMessage|MessagePattern|EventPattern|GrpcMethod|GrpcStreamMethod|GrpcStreamCall|Cron|Interval|Timeout|Sse)\\s*\\(").test(extract_decorator_block(read_file_lines(entry_point.file_path), entry_point.start_line));
  return check_0 && check_1;
}
