// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// yargs CommandModule handler methods. Each entry_point is a method named exactly `handler` defined inside a class file under `commands/<Name>Command.ts` (the canonical yargs CommandModule layout used by typeorm and many other CLIs). The class implements `yargs.CommandModule`; yargs invokes `.handler(args)` at runtime via the interface contract, with no in-source call site. The classifier triangulates the convention via the entry_point name + file-path layout + language.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_framework_lifecycle_handler(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  const check_0 = language === "typescript";
  const check_1 = new RegExp("^handler$").test(entry_point.name);
  const check_2 = new RegExp(".*/commands/[A-Z][A-Za-z0-9]*Command\\.(ts|js)$").test(entry_point.file_path);
  return check_0 && check_1 && check_2;
}
