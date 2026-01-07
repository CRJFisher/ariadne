/**
 * Tests for query_code_tree.validate_captures.ts
 */

import { describe, it, expect } from "vitest";
import {
  extract_captures,
  validate_captures,
  detect_fragment_captures,
  collect_stats,
  format_validation_report,
  format_all_results,
  format_json_output,
  type ParsedCapture,
  type ValidationResult,
} from "./validate_captures";

describe("extract_captures", () => {
  it("should extract captures from .scm content", () => {
    const content = `
(function_declaration name: (identifier) @definition.function)
(class_declaration name: (identifier) @definition.class)
    `;

    const captures = extract_captures(content);

    expect(captures.length).toBe(2);
    expect(captures[0].full_name).toBe("@definition.function");
    expect(captures[1].full_name).toBe("@definition.class");
  });

  it("should extract capture category and entity", () => {
    const content = "(call_expression) @reference.call";

    const captures = extract_captures(content);

    expect(captures.length).toBe(1);
    expect(captures[0].category).toBe("reference");
    expect(captures[0].entity).toBe("call");
  });

  it("should extract qualifiers from multi-part captures", () => {
    const content = "(identifier) @reference.variable.base";

    const captures = extract_captures(content);

    expect(captures.length).toBe(1);
    expect(captures[0].qualifiers).toEqual(["base"]);
  });

  it("should track line numbers", () => {
    const content = `line1
(function_declaration) @definition.function
line3`;

    const captures = extract_captures(content);

    expect(captures[0].line).toBe(2);
  });

  it("should handle multiple captures per line", () => {
    const content =
      "(assignment_expression left: (_) @reference.write right: (_) @reference.variable)";

    const captures = extract_captures(content);

    expect(captures.length).toBe(2);
  });

  it("should handle empty content", () => {
    const captures = extract_captures("");
    expect(captures).toEqual([]);
  });

  it("should handle content with no captures", () => {
    const content = "; This is a comment\n; Another comment";
    const captures = extract_captures(content);
    expect(captures).toEqual([]);
  });
});

describe("validate_captures", () => {
  it("should return no errors for valid captures", () => {
    const captures: ParsedCapture[] = [
      {
        full_name: "@definition.function",
        category: "definition",
        entity: "function",
        qualifiers: [],
        line: 1,
        column: 0,
        context: "",
      },
      {
        full_name: "@scope.module",
        category: "scope",
        entity: "module",
        qualifiers: [],
        line: 2,
        column: 0,
        context: "",
      },
    ];

    const errors = validate_captures(captures);

    // May have "missing required" errors for patterns not present
    const invalid_capture_errors = errors.filter(
      (e) => e.rule_violated === "not_in_schema"
    );
    expect(invalid_capture_errors).toEqual([]);
  });

  it("should return errors for invalid captures", () => {
    const captures: ParsedCapture[] = [
      {
        full_name: "@invalid.capture",
        category: "invalid",
        entity: "capture",
        qualifiers: [],
        line: 1,
        column: 0,
        context: "",
      },
    ];

    const errors = validate_captures(captures);
    const invalid_errors = errors.filter(
      (e) => e.rule_violated === "not_in_schema"
    );

    expect(invalid_errors.length).toBeGreaterThan(0);
  });

  it("should include line number in errors", () => {
    const captures: ParsedCapture[] = [
      {
        full_name: "@bad.capture",
        category: "bad",
        entity: "capture",
        qualifiers: [],
        line: 42,
        column: 5,
        context: "",
      },
    ];

    const errors = validate_captures(captures);

    expect(errors.some((e) => e.line === 42)).toBe(true);
  });
});

describe("detect_fragment_captures", () => {
  it("should warn about property_identifier with @reference.call", () => {
    const content =
      "(member_expression property: (property_identifier) @reference.call)";

    const warnings = detect_fragment_captures(content);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].capture).toBe("@reference.call");
    expect(warnings[0].message).toContain("fragment");
  });

  it("should warn about field_identifier with @reference.call", () => {
    const content =
      "(field_expression field: (field_identifier) @reference.call)";

    const warnings = detect_fragment_captures(content);

    expect(warnings.length).toBeGreaterThan(0);
  });

  it("should warn about duplicate captures on same line", () => {
    const content =
      "(call_expression) @reference.call @reference.call.method";

    const warnings = detect_fragment_captures(content);

    expect(warnings.some((w) => w.message.includes("Multiple"))).toBe(true);
  });

  it("should return no warnings for clean content", () => {
    const content = `
(call_expression) @reference.call
(function_declaration name: (identifier) @definition.function)
    `;

    const warnings = detect_fragment_captures(content);

    expect(warnings).toEqual([]);
  });
});

describe("collect_stats", () => {
  it("should count total captures", () => {
    const captures: ParsedCapture[] = [
      {
        full_name: "@definition.function",
        category: "definition",
        entity: "function",
        qualifiers: [],
        line: 1,
        column: 0,
        context: "",
      },
      {
        full_name: "@definition.class",
        category: "definition",
        entity: "class",
        qualifiers: [],
        line: 2,
        column: 0,
        context: "",
      },
      {
        full_name: "@definition.function",
        category: "definition",
        entity: "function",
        qualifiers: [],
        line: 3,
        column: 0,
        context: "",
      },
    ];

    const stats = collect_stats(captures);

    expect(stats.total_captures).toBe(3);
    expect(stats.unique_captures).toBe(2);
  });

  it("should group by category", () => {
    const captures: ParsedCapture[] = [
      {
        full_name: "@definition.function",
        category: "definition",
        entity: "function",
        qualifiers: [],
        line: 1,
        column: 0,
        context: "",
      },
      {
        full_name: "@reference.call",
        category: "reference",
        entity: "call",
        qualifiers: [],
        line: 2,
        column: 0,
        context: "",
      },
      {
        full_name: "@definition.class",
        category: "definition",
        entity: "class",
        qualifiers: [],
        line: 3,
        column: 0,
        context: "",
      },
    ];

    const stats = collect_stats(captures);

    expect(stats.by_category["definition"]).toBe(2);
    expect(stats.by_category["reference"]).toBe(1);
  });

  it("should group by entity", () => {
    const captures: ParsedCapture[] = [
      {
        full_name: "@definition.function",
        category: "definition",
        entity: "function",
        qualifiers: [],
        line: 1,
        column: 0,
        context: "",
      },
      {
        full_name: "@scope.function",
        category: "scope",
        entity: "function",
        qualifiers: [],
        line: 2,
        column: 0,
        context: "",
      },
    ];

    const stats = collect_stats(captures);

    expect(stats.by_entity["function"]).toBe(2);
  });

  it("should count invalid captures", () => {
    const captures: ParsedCapture[] = [
      {
        full_name: "@definition.function",
        category: "definition",
        entity: "function",
        qualifiers: [],
        line: 1,
        column: 0,
        context: "",
      },
      {
        full_name: "@invalid.capture",
        category: "invalid",
        entity: "capture",
        qualifiers: [],
        line: 2,
        column: 0,
        context: "",
      },
    ];

    const stats = collect_stats(captures);

    expect(stats.invalid_count).toBe(1);
  });

  it("should handle empty captures array", () => {
    const stats = collect_stats([]);

    expect(stats.total_captures).toBe(0);
    expect(stats.unique_captures).toBe(0);
    expect(stats.invalid_count).toBe(0);
  });
});

describe("format_validation_report", () => {
  it("should format a passing result", () => {
    const result: ValidationResult = {
      file: "/path/to/javascript.scm",
      language: "javascript",
      errors: [],
      warnings: [],
      stats: {
        total_captures: 10,
        unique_captures: 8,
        by_category: { definition: 5, reference: 3 },
        by_entity: { function: 4, class: 2 },
        invalid_count: 0,
      },
      passed: true,
    };

    const report = format_validation_report(result);

    expect(report).toContain("javascript");
    expect(report).toContain("PASSED");
    expect(report).toContain("Total captures: 10");
  });

  it("should format a failing result with errors", () => {
    const result: ValidationResult = {
      file: "/path/to/test.scm",
      language: "typescript",
      errors: [
        {
          line: 5,
          capture: "@invalid.capture",
          rule_violated: "not_in_schema",
          message: "Invalid capture",
        },
      ],
      warnings: [],
      stats: {
        total_captures: 5,
        unique_captures: 5,
        by_category: {},
        by_entity: {},
        invalid_count: 1,
      },
      passed: false,
    };

    const report = format_validation_report(result);

    expect(report).toContain("FAILED");
    expect(report).toContain("ERRORS");
    expect(report).toContain("@invalid.capture");
  });

  it("should include warnings section when present", () => {
    const result: ValidationResult = {
      file: "/path/to/test.scm",
      language: "python",
      errors: [],
      warnings: [
        {
          line: 10,
          capture: "@reference.call",
          message: "Fragment capture",
          suggestion: "Use complete capture",
        },
      ],
      stats: {
        total_captures: 3,
        unique_captures: 3,
        by_category: {},
        by_entity: {},
        invalid_count: 0,
      },
      passed: true,
    };

    const report = format_validation_report(result);

    expect(report).toContain("WARNINGS");
    expect(report).toContain("Fragment capture");
  });
});

describe("format_all_results", () => {
  it("should format multiple results with summary", () => {
    const results: ValidationResult[] = [
      {
        file: "/path/to/javascript.scm",
        language: "javascript",
        errors: [],
        warnings: [],
        stats: {
          total_captures: 10,
          unique_captures: 10,
          by_category: {},
          by_entity: {},
          invalid_count: 0,
        },
        passed: true,
      },
      {
        file: "/path/to/typescript.scm",
        language: "typescript",
        errors: [],
        warnings: [],
        stats: {
          total_captures: 15,
          unique_captures: 15,
          by_category: {},
          by_entity: {},
          invalid_count: 0,
        },
        passed: true,
      },
    ];

    const report = format_all_results(results);

    expect(report).toContain("SUMMARY");
    expect(report).toContain("javascript");
    expect(report).toContain("typescript");
    expect(report).toContain("ALL VALIDATIONS PASSED");
  });
});

describe("format_json_output", () => {
  it("should return valid JSON", () => {
    const results: ValidationResult[] = [
      {
        file: "/path/to/test.scm",
        language: "javascript",
        errors: [],
        warnings: [],
        stats: {
          total_captures: 5,
          unique_captures: 5,
          by_category: {},
          by_entity: {},
          invalid_count: 0,
        },
        passed: true,
      },
    ];

    const json = format_json_output(results);
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].language).toBe("javascript");
  });
});
