/**
 * Validation infrastructure for tree-sitter query captures
 * Task 11.154.3 - Implement Validation Infrastructure
 *
 * Validates .scm files against canonical capture schema using:
 * 1. Positive validation - captures must be in required OR optional lists
 * 2. Fragment detection - warns about captures on child nodes
 * 3. Statistical analysis - tracks capture usage patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Language } from '@ariadnejs/types';
import { CANONICAL_CAPTURE_SCHEMA, is_valid_capture, get_capture_errors } from './capture_schema.js';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  file: string;
  language: Language;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: CaptureStats;
  passed: boolean; // True if errors.length === 0 (warnings don't fail)
}

export interface ValidationError {
  line: number;
  column?: number;
  capture: string;
  rule_violated: string;
  message: string;
  fix?: string;
}

export interface ValidationWarning {
  line: number;
  capture: string;
  message: string;
  suggestion: string;
}

export interface CaptureStats {
  total_captures: number;
  unique_captures: number;
  by_category: Record<string, number>;
  by_entity: Record<string, number>;
  invalid_count: number;
}

export interface ParsedCapture {
  full_name: string;
  category: string;
  entity: string;
  qualifiers: string[];
  line: number;
  column: number;
  context: string;
}

// ============================================================================
// Capture Extraction
// ============================================================================

/**
 * Extract all captures from .scm file content
 */
export function extract_captures(content: string): ParsedCapture[] {
  const captures: ParsedCapture[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match all captures: @capture.name
    const matches = line.matchAll(/@([a-z_]+(?:\.[a-z_]+)*)/g);

    for (const match of matches) {
      const full_capture = match[0]; // @capture.name
      const name_parts = match[1].split('.'); // [capture, name]

      captures.push({
        full_name: full_capture,
        category: name_parts[0] || '',
        entity: name_parts[1] || '',
        qualifiers: name_parts.slice(2),
        line: i + 1,
        column: match.index || 0,
        context: line.trim()
      });
    }
  }

  return captures;
}

// ============================================================================
// Validation Logic
// ============================================================================

/**
 * Validate captures against schema using POSITIVE validation
 */
export function validate_captures(captures: ParsedCapture[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const capture of captures) {
    // Use schema validation helpers
    const capture_errors = get_capture_errors(capture.full_name);

    for (const error_msg of capture_errors) {
      errors.push({
        line: capture.line,
        column: capture.column,
        capture: capture.full_name,
        rule_violated: error_msg.includes('not in required or optional')
          ? 'not_in_schema'
          : error_msg.includes('format')
          ? 'naming_convention'
          : 'max_depth_exceeded',
        message: error_msg,
        fix: error_msg.includes('not in required or optional')
          ? 'Add to capture_schema.ts optional list OR remove from query file'
          : undefined
      });
    }
  }

  // Check for required patterns
  const capture_set = new Set(captures.map(c => c.full_name));
  for (const required of CANONICAL_CAPTURE_SCHEMA.required) {
    const has_match = Array.from(capture_set).some(name =>
      required.pattern.test(name)
    );

    if (!has_match) {
      errors.push({
        line: 0,
        capture: required.pattern.source,
        rule_violated: 'missing_required',
        message: `Missing required capture: ${required.description}`,
        fix: `Add pattern: ${required.example}`
      });
    }
  }

  return errors;
}

/**
 * Detect fragment captures using heuristic patterns
 * Returns warnings (not errors) for manual review
 */
export function detect_fragment_captures(content: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const line_num = i + 1;

    // Pattern 1: property_identifier with @reference.call (TypeScript/JavaScript)
    if (line.match(/property_identifier\)\s+@reference\.call(?!\w)/)) {
      warnings.push({
        line: line_num,
        capture: '@reference.call',
        message: 'Capture on property_identifier (fragment node)',
        suggestion: 'Move @reference.call to parent call_expression node for complete capture'
      });
    }

    // Pattern 2: field_identifier with @reference.call (Rust)
    if (line.match(/field_identifier\)\s+@reference\.call(?!\w)/)) {
      warnings.push({
        line: line_num,
        capture: '@reference.call',
        message: 'Capture on field_identifier (fragment node)',
        suggestion: 'Move @reference.call to parent call_expression node for complete capture'
      });
    }

    // Pattern 3: identifier in attribute context with @reference.call (Python)
    // Exclude top-level function calls which are valid
    if (line.match(/attribute:\s*\(identifier\)\s+@reference\.call(?!\w)/) &&
        !line.match(/function:\s*\(identifier\)/)) {
      warnings.push({
        line: line_num,
        capture: '@reference.call',
        message: 'Capture on attribute identifier (fragment node)',
        suggestion: 'Move @reference.call to parent call node for complete capture'
      });
    }

    // Pattern 4: Duplicate captures on same line
    const call_captures = (line.match(/@reference\.call(\.\w+)?/g) || []);
    if (call_captures.length > 1) {
      warnings.push({
        line: line_num,
        capture: call_captures.join(', '),
        message: `Multiple @reference.call captures on same line (${call_captures.length} found)`,
        suggestion: 'Use single capture on complete node only, remove duplicates'
      });
    }

    // Pattern 5: Qualifiers that indicate duplicates (.full, .chained, .deep)
    const problematic_qualifiers = line.match(/@\w+\.\w+\.(full|chained|deep)\b/);
    if (problematic_qualifiers) {
      warnings.push({
        line: line_num,
        capture: problematic_qualifiers[0],
        message: `Qualifier '.${problematic_qualifiers[1]}' indicates duplicate capture pattern`,
        suggestion: 'Remove qualifier, use single capture on complete node'
      });
    }
  }

  return warnings;
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Collect statistics about captures
 */
export function collect_stats(captures: ParsedCapture[]): CaptureStats {
  const by_category = new Map<string, number>();
  const by_entity = new Map<string, number>();
  const unique = new Set<string>();
  let invalid_count = 0;

  for (const capture of captures) {
    unique.add(capture.full_name);

    // Check if valid
    if (!is_valid_capture(capture.full_name)) {
      invalid_count++;
    }

    if (capture.category) {
      by_category.set(
        capture.category,
        (by_category.get(capture.category) || 0) + 1
      );
    }

    if (capture.entity) {
      by_entity.set(
        capture.entity,
        (by_entity.get(capture.entity) || 0) + 1
      );
    }
  }

  return {
    total_captures: captures.length,
    unique_captures: unique.size,
    by_category: Object.fromEntries(by_category),
    by_entity: Object.fromEntries(by_entity),
    invalid_count
  };
}

// ============================================================================
// File Validation
// ============================================================================

/**
 * Validate a single .scm file
 */
export function validate_scm_file(file_path: string): ValidationResult {
  const content = fs.readFileSync(file_path, 'utf-8');
  const language = path.basename(file_path, '.scm') as Language;
  const captures = extract_captures(content);
  const errors = validate_captures(captures);
  const warnings = detect_fragment_captures(content);
  const stats = collect_stats(captures);

  return {
    file: file_path,
    language,
    errors,
    warnings,
    stats,
    passed: errors.length === 0 // Warnings don't fail validation
  };
}

/**
 * Validate all language query files
 * @param queries_dir - Path to queries directory
 */
export function validate_all_languages(queries_dir: string): ValidationResult[] {
  const languages: Language[] = ['typescript', 'javascript', 'python', 'rust'];
  const results: ValidationResult[] = [];

  for (const lang of languages) {
    const file_path = path.join(queries_dir, `${lang}.scm`);
    if (fs.existsSync(file_path)) {
      const result = validate_scm_file(file_path);
      results.push(result);
    } else {
      console.error(`Warning: Query file not found: ${file_path}`);
    }
  }

  return results;
}

// ============================================================================
// Report Formatting
// ============================================================================

/**
 * Format validation result as human-readable report
 */
export function format_validation_report(result: ValidationResult): string {
  const { file, language, errors, warnings, stats, passed } = result;

  let output = '\n' + '='.repeat(80) + '\n';
  output += `Language: ${language.toUpperCase()}\n`;
  output += `File: ${file}\n`;
  output += '='.repeat(80) + '\n\n';

  // Status
  if (passed && warnings.length === 0) {
    output += '✅ PASSED - No issues found\n\n';
  } else if (passed) {
    output += `⚠️  PASSED with ${warnings.length} warning(s)\n\n`;
  } else {
    output += `❌ FAILED - ${errors.length} error(s) found\n\n`;
  }

  // Errors
  if (errors.length > 0) {
    output += 'ERRORS (must fix):\n';
    output += '-'.repeat(80) + '\n';

    for (const error of errors) {
      output += `\nLine ${error.line}: ${error.capture}\n`;
      output += `  Rule: ${error.rule_violated}\n`;
      output += `  Issue: ${error.message}\n`;
      if (error.fix) {
        output += `  Fix: ${error.fix}\n`;
      }
    }
    output += '\n';
  }

  // Warnings
  if (warnings.length > 0) {
    output += 'WARNINGS (should review):\n';
    output += '-'.repeat(80) + '\n';

    for (const warning of warnings) {
      output += `\nLine ${warning.line}: ${warning.capture}\n`;
      output += `  Issue: ${warning.message}\n`;
      output += `  Suggestion: ${warning.suggestion}\n`;
    }
    output += '\n';
  }

  // Statistics
  output += 'STATISTICS:\n';
  output += '-'.repeat(80) + '\n';
  output += `  Total captures: ${stats.total_captures}\n`;
  output += `  Unique captures: ${stats.unique_captures}\n`;
  output += `  Invalid captures: ${stats.invalid_count}\n`;
  output += `  Valid captures: ${stats.unique_captures - stats.invalid_count}\n\n`;

  output += '  By category:\n';
  const sorted_categories = Object.entries(stats.by_category).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sorted_categories) {
    output += `    ${cat}: ${count}\n`;
  }

  output += '\n  By entity (top 10):\n';
  const sorted_entities = Object.entries(stats.by_entity).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [ent, count] of sorted_entities) {
    output += `    ${ent}: ${count}\n`;
  }

  output += '\n';
  return output;
}

/**
 * Format all validation results
 */
export function format_all_results(results: ValidationResult[]): string {
  let output = '\n' + '█'.repeat(80) + '\n';
  output += '  CAPTURE SCHEMA VALIDATION REPORT\n';
  output += '█'.repeat(80) + '\n';

  // Summary table
  output += '\nSUMMARY:\n';
  output += '-'.repeat(80) + '\n';
  output += `${'Language'.padEnd(12)} | ${'Status'.padEnd(8)} | ${'Errors'.padEnd(7)} | ${'Warnings'.padEnd(8)} | ${'Invalid'.padEnd(7)}\n`;
  output += '-'.repeat(80) + '\n';

  let total_errors = 0;
  let total_warnings = 0;
  let total_invalid = 0;

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    output += `${result.language.padEnd(12)} | ${status.padEnd(8)} | ${String(result.errors.length).padEnd(7)} | ${String(result.warnings.length).padEnd(8)} | ${String(result.stats.invalid_count).padEnd(7)}\n`;

    total_errors += result.errors.length;
    total_warnings += result.warnings.length;
    total_invalid += result.stats.invalid_count;
  }

  output += '-'.repeat(80) + '\n';
  output += `${'TOTAL'.padEnd(12)} | ${' '.padEnd(8)} | ${String(total_errors).padEnd(7)} | ${String(total_warnings).padEnd(8)} | ${String(total_invalid).padEnd(7)}\n`;
  output += '\n';

  // Detailed reports
  for (const result of results) {
    output += format_validation_report(result);
  }

  // Final summary
  const all_passed = results.every(r => r.passed);
  output += '█'.repeat(80) + '\n';
  if (all_passed && total_warnings === 0) {
    output += '✅ ALL VALIDATIONS PASSED - No issues found\n';
  } else if (all_passed) {
    output += `⚠️  VALIDATIONS PASSED but ${total_warnings} warnings to review\n`;
  } else {
    output += `❌ VALIDATIONS FAILED - ${total_errors} errors must be fixed\n`;
  }
  output += '█'.repeat(80) + '\n\n';

  return output;
}

/**
 * Format as JSON for CI
 */
export function format_json_output(results: ValidationResult[]): string {
  return JSON.stringify(results, null, 2);
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate all query files and return results
 * Helper for CLI - figures out queries directory path
 */
export function run_validation(queries_dir: string): ValidationResult[] {
  return validate_all_languages(queries_dir);
}
