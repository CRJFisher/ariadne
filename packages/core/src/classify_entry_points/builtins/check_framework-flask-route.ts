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

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { extract_decorator_block } from "./extract_decorator_block";

export function check_framework_flask_route(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  const check_0 = language === "python";
  const check_1 = new RegExp("@*.route*").test(
    extract_decorator_block(read_file_lines(entry_point.file_path), entry_point.start_line),
  );
  return check_0 && check_1;
}
