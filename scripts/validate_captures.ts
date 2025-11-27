#!/usr/bin/env node
/**
 * CLI tool for validating tree-sitter query captures
 * Task 11.154.3 - Validation Infrastructure
 *
 * Usage:
 *   npm run validate:captures                    # All languages
 *   npm run validate:captures -- --lang=typescript    # Specific language
 *   npm run validate:captures -- --json          # JSON output for CI
 *   npm run validate:captures -- --verbose       # Detailed output
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { run_validation, validate_scm_file, format_all_results, format_json_output, format_validation_report } from '../packages/core/src/index_single_file/query_code_tree/validate_captures.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename_esm = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname_esm = dirname(__filename_esm);

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const json_output = args.includes('--json');
const lang_arg = args.find(arg => arg.startsWith('--lang='));
const specific_lang = lang_arg?.split('=')[1];

async function main() {
  const queries_dir = join(
    __dirname_esm,
    '../packages/core/src/index_single_file/query_code_tree/queries'
  );

  let results;

  if (specific_lang) {
    // Validate specific language
    const file_path = join(queries_dir, `${specific_lang}.scm`);
    const result = validate_scm_file(file_path);
    results = [result];
  } else {
    // Validate all languages
    results = run_validation(queries_dir);
  }

  // Output
  if (json_output) {
    console.log(format_json_output(results));
  } else if (verbose || specific_lang) {
    // Detailed output for specific language or verbose mode
    if (results.length === 1) {
      console.log(format_validation_report(results[0]));
    } else {
      console.log(format_all_results(results));
    }
  } else {
    // Concise summary for all languages
    console.log(format_all_results(results));
  }

  // Exit code
  const failed = results.some(r => !r.passed);
  if (failed) {
    console.error('\n❌ Validation failed. Fix errors above before committing.\n');
    process.exit(1);
  } else {
    const total_warnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
    if (total_warnings > 0) {
      console.log(`\n⚠️  Validation passed but ${total_warnings} warnings found. Consider reviewing.\n`);
    } else {
      console.log('\n✅ All validations passed!\n');
    }
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
