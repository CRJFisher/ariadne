// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// Functions defined in files under a bundler fill-plugin's fillers directory are module-substitution polyfills (browser shims for Node.js built-ins like 'buffer', 'decimal.js', 'fs', 'perf_hooks'). The bundler intercepts imports of the original module name at build time via an esbuild onResolve hook (or equivalent) and redirects them to the filler file. Static call graph analysis follows the literal import string to the original built-in, so callers never link to the filler's exports. Match definitions whose file_path lives under a `/fill-plugin/fillers/` directory and that have zero resolved callers — they are reachable through the bundler's runtime path substitution, not the static call graph.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_bundler_module_substitution(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  const check_0 = language === "typescript";
  const check_1 = new RegExp("/fill-plugin/fillers/").test(entry_point.file_path);
  const check_2 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  return check_0 && check_1 && check_2;
}
