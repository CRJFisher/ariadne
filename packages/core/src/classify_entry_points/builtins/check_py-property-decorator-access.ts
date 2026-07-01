// Classifier for the known-issues registry rule `py-property-decorator-access`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A Python `@property`-decorated method is invoked implicitly by attribute
// access (`obj.value`), not by an explicit `obj.value()`. Tree-sitter captures
// only emit `@reference.call` on call expressions, so these entry points look
// unreachable — a permanent capture-model limitation. The discriminator is a
// `@property` decorator in the block immediately above the definition, in a
// Python file.

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

export function check_py_property_decorator_access(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  const check_0 = detect_language(entry_point.file_path) === "python";
  const check_1 = new RegExp("@property").test(
    extract_decorator_block(read_file_lines(entry_point.file_path), entry_point.start_line),
  );
  return check_0 && check_1;
}
