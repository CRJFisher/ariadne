// Classifier for the known-issues registry rule `framework-lifecycle-override`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// Node.js stream lifecycle override methods (_transform, _flush, _read, _write,
// _writev, _construct, _destroy, _final) on subclasses of
// Transform/Readable/Writable/Duplex/PassThrough are invoked by Node.js stream
// internals, not by explicit application code. These method names are drawn
// verbatim from the Node.js stream protocol (underscore-prefixed by convention
// to indicate framework-only invocation). The stream API is untyped JavaScript,
// so subclasses appear in both TypeScript and JavaScript sources; the precise
// name set is the discriminant for either.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_framework_lifecycle_override(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  const is_stream_lifecycle_name = /^_(transform|flush|read|write|writev|construct|destroy|final)$/.test(
    entry_point.name,
  );
  const is_jsts = language === "typescript" || language === "javascript";
  return is_stream_lifecycle_name && is_jsts;
}
