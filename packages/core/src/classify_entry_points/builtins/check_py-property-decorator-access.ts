// Classifier for the known-issues registry rule `py-property-decorator-access`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A Python `@property`-decorated method is invoked implicitly by attribute
// access (`obj.value`), not by an explicit `obj.value()`. Tree-sitter captures
// only emit `@reference.call` on call expressions, so these entry points look
// unreachable — a permanent capture-model limitation. The discriminator is a
// `@property` decorator in the block immediately above the definition, in a
// Python file.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { extract_decorator_block } from "./extract_decorator_block";

export function check_py_property_decorator_access(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  const check_0 = language === "python";
  const check_1 = new RegExp("@property").test(
    extract_decorator_block(read_file_lines(entry_point.file_path), entry_point.start_line),
  );
  return check_0 && check_1;
}
