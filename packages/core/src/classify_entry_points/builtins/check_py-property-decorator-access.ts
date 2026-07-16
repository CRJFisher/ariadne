// Classifier for the known-issues registry rule `py-property-decorator-access`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A Python property-descriptor method is invoked implicitly by attribute
// access (`obj.value`), not by an explicit `obj.value()`. Tree-sitter captures
// only emit `@reference.call` on call expressions, so these entry points look
// unreachable — a permanent capture-model limitation. The discriminator is a
// property-descriptor decorator in the block immediately above the definition,
// in a Python file.
//
// The family covers every bare decorator whose descriptor `__get__` runs on
// attribute read: the builtin `@property`, `functools`/Django `@cached_property`,
// pandas' `@cache_readonly`, and class-level `@classproperty`. A module prefix
// (`@functools.cached_property`) is tolerated. Memoization decorators that keep
// call syntax (`@cache`, `@lru_cache`) are deliberately excluded — their methods
// are still invoked with parentheses, so an uncalled one is a real finding.
//
// The functional form `x = property(_get_x)` is out of scope here: its accessor
// function carries no decorator, so the decorator-block mechanism cannot see it.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { extract_decorator_block } from "./extract_decorator_block";

const PROPERTY_DESCRIPTOR_DECORATOR =
  /@(?:\w+\.)*(?:property|cached_property|cache_readonly|classproperty)\b/;

export function check_py_property_decorator_access(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  const check_0 = language === "python";
  const check_1 = PROPERTY_DESCRIPTOR_DECORATOR.test(
    extract_decorator_block(read_file_lines(entry_point.file_path), entry_point.start_line),
  );
  return check_0 && check_1;
}
