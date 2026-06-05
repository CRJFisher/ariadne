// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// Node.js stream lifecycle override methods (_transform, _flush, _read, _write, _writev, _construct, _destroy, _final) on subclasses of Transform/Readable/Writable/Duplex/PassThrough are invoked by Node.js stream internals, not by explicit application code. These method names are drawn verbatim from the Node.js stream protocol (underscore-prefixed by convention to indicate framework-only invocation). On TypeScript/JavaScript entries, the precise name set is a strong discriminant for this framework-lifecycle pattern.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_framework_lifecycle_override(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = new RegExp("^_(transform|flush|read|write|writev|construct|destroy|final)$").test(entry_point.name);
  const check_1 = detect_language(entry_point.file_path) === "typescript";
  return check_0 && check_1;
}
