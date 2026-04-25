import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PREDICATE_OPERATORS,
  type KnownIssuesRegistry,
  type PredicateOperator,
} from "./known_issues_types.js";
import {
  RegistryValidationError,
  get_registry_file_path,
  load_registry,
  validate_predicate_expr,
  validate_registry,
} from "./known_issues_registry.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, "..");
const BACKLOG_TASKS_DIR = path.resolve(SKILL_ROOT, "..", "..", "..", "backlog", "tasks");

// ===== Load =====

describe("load_registry", () => {
  it("reads and validates the on-disk registry", () => {
    const registry = load_registry();
    expect(Array.isArray(registry)).toBe(true);
    expect(registry.length).toBeGreaterThanOrEqual(15);
  });

  it("points at .claude/skills/self-repair-pipeline/known_issues/registry.json", () => {
    const p = get_registry_file_path();
    expect(p.endsWith(path.join("self-repair-pipeline", "known_issues", "registry.json"))).toBe(true);
    expect(fs.existsSync(p)).toBe(true);
  });
});

// ===== Shape =====

describe("validate_registry — on-disk registry shape", () => {
  const registry = load_registry();

  it("every entry has a unique kebab-case group_id", () => {
    const ids = new Set<string>();
    for (const e of registry) {
      expect(e.group_id).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
      expect(ids.has(e.group_id)).toBe(false);
      ids.add(e.group_id);
    }
  });

  it("every entry has a non-empty title and description", () => {
    for (const e of registry) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(0);
    }
  });

  it("every entry has a valid status", () => {
    const allowed = new Set(["permanent", "wip", "fixed"]);
    for (const e of registry) {
      expect(allowed.has(e.status)).toBe(true);
    }
  });

  it("every entry lists at least one supported language", () => {
    const allowed = new Set(["typescript", "javascript", "python", "rust"]);
    for (const e of registry) {
      expect(e.languages.length).toBeGreaterThan(0);
      for (const lang of e.languages) expect(allowed.has(lang)).toBe(true);
    }
  });

  it("every classifier uses kind in {none, predicate, builtin}", () => {
    for (const e of registry) {
      expect(["none", "predicate", "builtin"]).toContain(e.classifier.kind);
      if (e.classifier.kind === "predicate") {
        expect(e.classifier.min_confidence).toBeGreaterThanOrEqual(0);
        expect(e.classifier.min_confidence).toBeLessThanOrEqual(1);
        expect(["A", "B", "C"]).toContain(e.classifier.axis);
      }
      if (e.classifier.kind === "builtin") {
        expect(e.classifier.function_name.length).toBeGreaterThan(0);
        expect(e.classifier.min_confidence).toBeGreaterThanOrEqual(0);
        expect(e.classifier.min_confidence).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ===== Examples are structured =====

describe("validate_registry — examples", () => {
  const registry = load_registry();
  it("every example has file (string), line (number), snippet (string)", () => {
    for (const e of registry) {
      for (const ex of e.examples) {
        expect(typeof ex.file).toBe("string");
        expect(typeof ex.line).toBe("number");
        expect(typeof ex.snippet).toBe("string");
      }
    }
  });
});

// ===== PredicateExpr: 12 operators, no others =====

describe("PredicateExpr operators", () => {
  it("enumerates the predicate operators declared in the design", () => {
    expect([...PREDICATE_OPERATORS].sort()).toEqual(
      [
        "all",
        "any",
        "not",
        "diagnosis_eq",
        "language_eq",
        "decorator_matches",
        "has_capture_at_grep_hit",
        "missing_capture_at_grep_hit",
        "grep_line_regex",
        "resolution_failure_reason_eq",
        "receiver_kind_eq",
        "syntactic_feature_eq",
        "grep_hits_all_intra_file",
        "grep_hit_neighbourhood_matches",
        "definition_feature_eq",
        "accessor_kind_eq",
        "has_unindexed_test_caller",
      ].sort(),
    );
  });

  it("validate_predicate_expr rejects an unknown operator", () => {
    expect(() => validate_predicate_expr({ op: "regex_match", pattern: "x" }, "root")).toThrow(
      RegistryValidationError,
    );
  });

  it("validate_predicate_expr rejects a misspelled known operator", () => {
    expect(() => validate_predicate_expr({ op: "language_equals", value: "python" }, "root")).toThrow(
      RegistryValidationError,
    );
  });

  it("validate_predicate_expr walks combinator children", () => {
    expect(() =>
      validate_predicate_expr(
        { op: "all", of: [{ op: "language_eq", value: "python" }, { op: "bogus" }] },
        "root",
      ),
    ).toThrow(RegistryValidationError);
  });

  it("validate_predicate_expr accepts every operator shape used in the registry", () => {
    const registry = load_registry();
    for (const entry of registry) {
      const classifier = entry.classifier;
      if (classifier.kind !== "predicate") continue;
      expect(() => validate_predicate_expr(classifier.expression, entry.group_id)).not.toThrow();
    }
  });

  it("every operator appearing in the registry is one of the 12 declared operators", () => {
    const registry = load_registry();
    const valid: ReadonlySet<PredicateOperator> = new Set(PREDICATE_OPERATORS);
    const seen = new Set<string>();

    function walk(expr: unknown): void {
      if (typeof expr !== "object" || expr === null) return;
      const op = (expr as { op?: unknown }).op;
      if (typeof op === "string") seen.add(op);
      const of = (expr as { of?: unknown }).of;
      if (Array.isArray(of)) of.forEach(walk);
      else if (of && typeof of === "object") walk(of);
    }
    for (const entry of registry) {
      if (entry.classifier.kind === "predicate") walk(entry.classifier.expression);
    }
    for (const op of seen) {
      expect(valid.has(op as PredicateOperator)).toBe(true);
    }
  });
});

// ===== validate_registry catches common errors =====

describe("validate_registry — negative cases", () => {
  function clone(reg: KnownIssuesRegistry): KnownIssuesRegistry {
    return JSON.parse(JSON.stringify(reg)) as KnownIssuesRegistry;
  }

  it("rejects a non-array input", () => {
    expect(() => validate_registry({})).toThrow(RegistryValidationError);
    expect(() => validate_registry(null)).toThrow(RegistryValidationError);
  });

  it("rejects a duplicate group_id", () => {
    const registry = clone(load_registry());
    if (registry.length < 2) return;
    registry[1].group_id = registry[0].group_id;
    expect(() => validate_registry(registry)).toThrow(/duplicate group_id/);
  });

  it("rejects a group_id that is not kebab-case", () => {
    const registry = clone(load_registry());
    registry[0].group_id = "NotKebabCase";
    expect(() => validate_registry(registry)).toThrow(/kebab-case/);
  });

  it("rejects an unknown language", () => {
    const bad: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    bad[0]["languages"] = ["cobol"];
    expect(() => validate_registry(bad)).toThrow(/invalid language/);
  });

  it("rejects an unknown status", () => {
    const bad: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    bad[0]["status"] = "deprecated";
    expect(() => validate_registry(bad)).toThrow(/status/);
  });

  it("rejects min_confidence outside [0, 1]", () => {
    const registry = clone(load_registry());
    const entry = registry.find((e) => e.classifier.kind === "predicate");
    if (!entry) return;
    if (entry.classifier.kind === "predicate") {
      entry.classifier.min_confidence = 1.5;
    }
    expect(() => validate_registry(registry)).toThrow(/min_confidence/);
  });

  it("rejects a predicate with an unknown axis", () => {
    const registry = clone(load_registry());
    const entry = registry.find((e) => e.classifier.kind === "predicate");
    if (!entry) return;
    if (entry.classifier.kind === "predicate") {
      entry.classifier.axis = "Z" as "A" | "B" | "C";
    }
    expect(() => validate_registry(registry)).toThrow(/axis/);
  });

  it("rejects a malformed backlog_task reference", () => {
    const registry = clone(load_registry());
    registry[0].backlog_task = "task-123";
    expect(() => validate_registry(registry)).toThrow(/backlog_task/);
  });

  it("rejects an invalid regex in grep_line_regex", () => {
    expect(() =>
      validate_predicate_expr({ op: "grep_line_regex", pattern: "[unterminated" }, "root"),
    ).toThrow(/invalid regex/);
  });

  it("rejects an invalid regex in decorator_matches", () => {
    expect(() =>
      validate_predicate_expr({ op: "decorator_matches", pattern: "(unbalanced" }, "root"),
    ).toThrow(/invalid regex/);
  });

  it("rejects an unknown syntactic_feature_eq.name", () => {
    expect(() =>
      validate_predicate_expr(
        { op: "syntactic_feature_eq", name: "is_banana", value: true },
        "root",
      ),
    ).toThrow(/unknown syntactic feature/);
  });

  it("accepts grep_hits_all_intra_file with a boolean value", () => {
    expect(() =>
      validate_predicate_expr({ op: "grep_hits_all_intra_file", value: true }, "root"),
    ).not.toThrow();
  });

  it("rejects grep_hits_all_intra_file with a non-boolean value", () => {
    expect(() =>
      validate_predicate_expr({ op: "grep_hits_all_intra_file", value: "true" }, "root"),
    ).toThrow(/boolean/);
  });

  it("accepts grep_hit_neighbourhood_matches with pattern + positive window", () => {
    expect(() =>
      validate_predicate_expr(
        { op: "grep_hit_neighbourhood_matches", pattern: "require\\(", window: 5 },
        "root",
      ),
    ).not.toThrow();
  });

  it("rejects grep_hit_neighbourhood_matches with non-positive window", () => {
    expect(() =>
      validate_predicate_expr(
        { op: "grep_hit_neighbourhood_matches", pattern: "x", window: 0 },
        "root",
      ),
    ).toThrow(/window/);
  });

  it("rejects grep_hit_neighbourhood_matches with invalid regex", () => {
    expect(() =>
      validate_predicate_expr(
        { op: "grep_hit_neighbourhood_matches", pattern: "[unterm", window: 3 },
        "root",
      ),
    ).toThrow(/invalid regex/);
  });

  it("accepts definition_feature_eq with a known name", () => {
    expect(() =>
      validate_predicate_expr(
        { op: "definition_feature_eq", name: "definition_is_object_literal_method", value: true },
        "root",
      ),
    ).not.toThrow();
  });

  it("rejects definition_feature_eq with an unknown name", () => {
    expect(() =>
      validate_predicate_expr(
        { op: "definition_feature_eq", name: "not_a_feature", value: true },
        "root",
      ),
    ).toThrow(/unknown definition feature/);
  });

  it("accepts accessor_kind_eq with getter/setter/none", () => {
    for (const v of ["getter", "setter", "none"]) {
      expect(() =>
        validate_predicate_expr({ op: "accessor_kind_eq", value: v }, "root"),
      ).not.toThrow();
    }
  });

  it("rejects accessor_kind_eq with an unknown value", () => {
    expect(() =>
      validate_predicate_expr({ op: "accessor_kind_eq", value: "accessor" }, "root"),
    ).toThrow(/getter/);
  });

  it("accepts has_unindexed_test_caller with a boolean value", () => {
    expect(() =>
      validate_predicate_expr({ op: "has_unindexed_test_caller", value: true }, "root"),
    ).not.toThrow();
  });

  it("attaches compiled_pattern to grep_line_regex nodes after validation", () => {
    const node: { op: string; pattern: string; compiled_pattern?: RegExp } = {
      op: "grep_line_regex",
      pattern: "foo.*bar",
    };
    validate_predicate_expr(node, "root");
    if (!(node.compiled_pattern instanceof RegExp)) {
      throw new Error("compiled_pattern was not attached as a RegExp");
    }
    expect(node.compiled_pattern.test("foo zzz bar")).toBe(true);
    expect(node.compiled_pattern.source).toBe("foo.*bar");
  });

  it("accepts a builtin classifier entry", () => {
    const registry = clone(load_registry());
    registry[0].classifier = {
      kind: "builtin",
      function_name: "check_something",
      min_confidence: 0.9,
    };
    expect(() => validate_registry(registry)).not.toThrow();
  });

  it("rejects a builtin classifier with an empty function_name", () => {
    const bad: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    bad[0]["classifier"] = {
      kind: "builtin",
      function_name: "",
      min_confidence: 0.9,
    };
    expect(() => validate_registry(bad)).toThrow(/function_name/);
  });

  it("rejects a builtin classifier with an illegal function_name character", () => {
    const bad: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    bad[0]["classifier"] = {
      kind: "builtin",
      function_name: "Check-Something",
      min_confidence: 0.9,
    };
    expect(() => validate_registry(bad)).toThrow(/function_name/);
  });

  it("rejects a builtin classifier with min_confidence outside [0,1]", () => {
    const bad: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    bad[0]["classifier"] = {
      kind: "builtin",
      function_name: "check_x",
      min_confidence: 2,
    };
    expect(() => validate_registry(bad)).toThrow(/min_confidence/);
  });

  it("rejects an unknown classifier kind", () => {
    const bad: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    bad[0]["classifier"] = { kind: "magic" };
    expect(() => validate_registry(bad)).toThrow(/kind/);
  });

  it("rejects two builtin entries that share a function_name", () => {
    const bad: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    bad[0]["classifier"] = {
      kind: "builtin",
      function_name: "check_collision",
      min_confidence: 0.9,
    };
    bad[1]["classifier"] = {
      kind: "builtin",
      function_name: "check_collision",
      min_confidence: 0.95,
    };
    expect(() => validate_registry(bad)).toThrow(/function_name "check_collision" already used/);
  });
});

// ===== backlog_task either matches an existing task or is intentionally absent =====

describe("backlog_task linkage", () => {
  const registry = load_registry();
  const dir_listing: string[] = fs.existsSync(BACKLOG_TASKS_DIR)
    ? fs.readdirSync(BACKLOG_TASKS_DIR)
    : [];

  function backlog_task_exists(task_id: string): boolean {
    const lower = task_id.toLowerCase();
    const id_part = lower.replace(/^task-/, "");
    return dir_listing.some((f) => f.toLowerCase().startsWith(`task-${id_part} `) || f.toLowerCase().startsWith(`task-${id_part}-`));
  }

  it("each entry's backlog_task (when present) matches a real backlog file", () => {
    if (dir_listing.length === 0) {
      // No backlog present — skip. This keeps the test portable.
      expect(registry.length).toBeGreaterThan(0);
      return;
    }
    for (const entry of registry) {
      if (entry.backlog_task === undefined) continue;
      expect(backlog_task_exists(entry.backlog_task)).toBe(true);
    }
  });
});

// ===== Required seeds =====

describe("required seed content", () => {
  const registry = load_registry();
  const by_id = new Map(registry.map((e) => [e.group_id, e] as const));

  it("webpack-dominant group_ids are present", () => {
    for (const id of [
      "method-chain-dispatch",
      "polymorphic-subtype-dispatch",
      "dynamic-property-keyed-callback",
      "constructor-new-expression",
    ]) {
      expect(by_id.has(id)).toBe(true);
    }
  });

  it("axis A tree-sitter gap group_ids are present", () => {
    for (const id of [
      "ts-jsx-component-call",
      "ts-decorator-factory-call",
      "ts-private-method-unreachable",
      "py-property-decorator-access",
      "py-wildcard-import-caller",
      "rust-macro-invocation-call",
      "rust-trait-method-dispatch",
      "js-commonjs-require-destructure",
    ]) {
      expect(by_id.has(id)).toBe(true);
    }
  });

  it("axis C framework decorator group_ids are present", () => {
    for (const id of [
      "framework-pytest-fixture",
      "framework-flask-route",
      "framework-component-decorator",
    ]) {
      expect(by_id.has(id)).toBe(true);
    }
  });

  it("resolution-failure taxonomy (F1-F10) entries are present (via their registry group_ids)", () => {
    for (const id of [
      "aliased-receiver-type-lost",           // F1
      "factory-return-type-unknown",          // F2
      "inline-constructor-method-chain",      // F3
      "python-module-attribute-call",         // F4
      "aliased-re-export",                    // F5
      "unindexed-external-module",            // F6
      "polymorphic-subtype-dispatch",         // F7 (shared with webpack-dominant)
      "super-inherited-method",               // F8
      "dynamic-property-keyed-callback",      // F9 (shared with webpack-dominant)
      "global-name-collision",                // F10
    ]) {
      expect(by_id.has(id)).toBe(true);
    }
  });

  it("pre-measured predicate patterns carry their declared precision as min_confidence", () => {
    // Only the predicate-classified members of the pre-measured set are pinned
    // here. Entries with `kind: "none"` are known issues awaiting an automated
    // classifier and intentionally omit precision metadata.
    const measured: Array<{ id: string; min_confidence: number }> = [
      { id: "module-attribute-alias", min_confidence: 1.0 },
    ];
    for (const m of measured) {
      const entry = by_id.get(m.id);
      expect(entry, `missing pre-measured entry ${m.id}`).toBeDefined();
      if (!entry) continue;
      if (entry.classifier.kind !== "predicate") {
        throw new Error(`${m.id}: expected classifier kind "predicate", got "${entry.classifier.kind}"`);
      }
      expect(entry.classifier.min_confidence).toBeCloseTo(m.min_confidence, 3);
    }
  });
});
