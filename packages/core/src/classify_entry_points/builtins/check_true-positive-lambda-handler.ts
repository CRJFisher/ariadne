// Classifier for the known-issues registry rule `true-positive-lambda-handler`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// AWS Lambda handler entry points live in files whose path contains the
// `_lambda_handler` marker (e.g. `src/handlers/ingest_lambda_handler.py`).
// They are invoked by AWS infrastructure, never from a source call site, so
// the resolver correctly finds no caller. The discriminator is purely the
// file-path convention — language-agnostic across the ts/js/python handlers
// the rule covers, matching the seed rule `lambda-handler-file-true-positive`
// (precision 1.0), so no content inspection is needed.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_true_positive_lambda_handler(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  return entry_point.file_path.includes("_lambda_handler");
}
