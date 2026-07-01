// Classifier for the known-issues registry rule `framework-component-decorator`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// Angular `@Component`, NestJS `@Controller`, or similar framework class
// decorators register the class with the framework's dependency-injection
// runtime; the constructor and lifecycle methods are invoked by the framework
// without an explicit call site — a permanent framework-dispatch limitation.
// The discriminator is a `@Component`-style decorator in the block above the
// definition. There is no language guard: the bare decorator match runs
// regardless of language, matching the registry rule it replaces.
//
// The pattern string is passed to `RegExp` verbatim (glob-looking but regex):
// `@Component*` reads the trailing `*` as zero-or-more `t`. This preserves the
// exact match behavior of the registry rule — do not "correct" it.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

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

export function check_framework_component_decorator(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  return new RegExp("@Component*").test(
    extract_decorator_block(read_file_lines(entry_point.file_path), entry_point.start_line),
  );
}
