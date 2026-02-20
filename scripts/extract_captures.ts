/**
 * Extract all captures from tree-sitter query files (.scm)
 * Part of Task 11.154.1 - Document Current Capture State
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename_esm = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname_esm = dirname(__filename_esm);

export interface CaptureInfo {
  name: string;           // Full capture name: @category.entity.qualifier
  category: string;       // First part: scope, definition, reference, etc.
  entity: string;         // Second part: function, class, call, etc.
  qualifiers: string[];   // Third+ parts: body, full, chained, etc.
  line: number;           // Line number in .scm file
  column: number;         // Column position
  context: string;        // The line containing the capture
}

/**
 * Extract all captures from a .scm file
 */
export function extract_captures_from_scm(file_path: string): CaptureInfo[] {
  const content = fs.readFileSync(file_path, "utf-8");
  const captures: CaptureInfo[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match capture patterns: @capture_name or @capture.name.qualifier
    const matches = line.matchAll(/@([a-z_]+(?:\.[a-z_]+)*)/g);

    for (const match of matches) {
      const full_capture = match[0]; // @capture.name
      const name_without_at = match[1]; // capture.name
      const parts = name_without_at.split(".");

      captures.push({
        name: full_capture,
        category: parts[0] || "",
        entity: parts[1] || "",
        qualifiers: parts.slice(2),
        line: i + 1,
        column: match.index || 0,
        context: line.trim()
      });
    }
  }

  return captures;
}

/**
 * Extract captures from all language query files
 */
export function extract_all_captures() {
  const queries_dir = path.join(__dirname_esm, "../packages/core/src/index_single_file/query_code_tree/queries");
  const languages = ["typescript", "javascript", "python", "rust"];

  const by_language = new Map<string, CaptureInfo[]>();

  for (const lang of languages) {
    const file_path = path.join(queries_dir, `${lang}.scm`);
    if (fs.existsSync(file_path)) {
      const captures = extract_captures_from_scm(file_path);
      by_language.set(lang, captures);
      console.log(`✓ Extracted ${captures.length} captures from ${lang}.scm`);
    } else {
      console.error(`✗ File not found: ${file_path}`);
    }
  }

  return by_language;
}

// Run if executed directly
if (process.argv[1] === __filename_esm) {
  console.log("Extracting captures from query files...\n");
  const results = extract_all_captures();

  console.log("\nSummary:");
  for (const [lang, captures] of results) {
    const unique = new Set(captures.map(c => c.name)).size;
    console.log(`  ${lang}: ${captures.length} total, ${unique} unique`);
  }
}
