// Classifier for the known-issues registry rule `framework-flask-route`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A function decorated with `@app.route(...)` or `@blueprint.route(...)` is
// registered with Flask and invoked by the request dispatcher, not by a Python
// call expression — a framework true-positive with no static call site. The
// discriminator is a `.route` decorator in the block above the definition, in a
// Python file.
//
// The pattern string is passed to `RegExp` verbatim (glob-looking but regex):
// `@*.route*` reads `@*` as zero-or-more `@`, `.` as any char, and the trailing
// `*` as zero-or-more `e`. This preserves the exact match behavior of the
// registry rule it replaces — do not "correct" it into an anchored literal.

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

export function check_framework_flask_route(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  const check_0 = detect_language(entry_point.file_path) === "python";
  const check_1 = new RegExp("@*.route*").test(
    extract_decorator_block(read_file_lines(entry_point.file_path), entry_point.start_line),
  );
  return check_0 && check_1;
}
