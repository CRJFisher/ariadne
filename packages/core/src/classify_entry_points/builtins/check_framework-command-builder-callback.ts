// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// yargs CommandModule lifecycle hook: a `builder` method on a class that implements `yargs.CommandModule` is invoked by the yargs runtime when the registered command instance is dispatched. Ariadne does not model framework interface dispatch, so these methods appear unreachable. Classifier matches typescript `builder` methods inside files following the conventional `<dir>/commands/<Name>Command.ts` shape used by yargs-style CLI projects. The proper resolver-level fix is to trace method calls through interface implementations (TASK-198).

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_framework_command_builder_callback(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = new RegExp("^builder$").test(entry_point.name);
  const check_2 = new RegExp("/commands/[A-Z][A-Za-z0-9]*Command\\.ts$").test(entry_point.file_path);
  return check_0 && check_1 && check_2;
}
