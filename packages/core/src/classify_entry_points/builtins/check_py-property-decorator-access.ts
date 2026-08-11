// Classifier for the known-issues registry rule `py-property-decorator-access`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A Python property-descriptor method is invoked implicitly by attribute
// access (`obj.value`), not by an explicit `obj.value()`. A read whose receiver
// resolves to a type becomes a real edge to the getter; this rule covers the
// reads that carry no resolvable receiver — an untyped parameter, a chained
// receiver, a read in another file whose type never resolves. The discriminator
// is a property-descriptor decorator in the block immediately above the
// definition, in a Python file.
//
// The functional form `x = property(_get_x)` is out of scope here: its accessor
// function carries no decorator, so the decorator-block mechanism cannot see it.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { extract_decorator_block } from "./extract_decorator_block";
import { PROPERTY_DESCRIPTOR_DECORATORS } from "../../index_single_file/query_code_tree/symbol_factories/symbol_factories.python";

// Built from the same family the indexer derives `accessor_kind` from, so a
// decorator recognised as a getter there can never be missed here.
const PROPERTY_DESCRIPTOR_DECORATOR = new RegExp(
  `@(?:\\w+\\.)*(?:${PROPERTY_DESCRIPTOR_DECORATORS.join("|")})\\b`
);

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
