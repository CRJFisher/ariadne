import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parse_known_issues_registry_json,
  type KnownIssuesRegistry,
} from "@ariadnejs/types";
import {
  RegistryValidationError,
  active_rules_for_classification,
  load_registry,
  validate_registry,
} from "./known_issues_registry.js";
import { known_issues_registry_path } from "@ariadnejs/skill-protocol";
import type { KnownIssue } from "@ariadnejs/types";

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

  it("points at .claude/skills/triage/known_issues/registry.json", () => {
    const p = known_issues_registry_path();
    expect(p.endsWith(path.join("triage", "known_issues", "registry.json"))).toBe(true);
    expect(fs.existsSync(p)).toBe(true);
  });

  it("loads non-permanent statuses (does not filter to permanent only)", () => {
    const registry = load_registry();
    // The catalog's resting state is permanent limitations plus fixed/retired
    // closure rows; the loader returns every status (active-set filtering is the
    // job of active_rules_for_classification, not load_registry).
    const has_non_permanent = registry.some((e) => e.status !== "permanent");
    expect(has_non_permanent).toBe(true);
  });

  it("loads `kind: \"none\"` rules (registry placeholders without a classifier)", () => {
    const registry = load_registry();
    const has_kind_none = registry.some((e) => e.classifier.kind === "none");
    expect(has_kind_none).toBe(true);
  });
});

// ===== Lifecycle filter =====

describe("active_rules_for_classification", () => {
  function rule(
    group_id: string,
    overrides: Partial<KnownIssue> = {},
  ): KnownIssue {
    return {
      group_id,
      title: group_id,
      description: "",
      status: "wip",
      languages: ["typescript"],
      examples: [],
      classifier: { kind: "builtin", function_name: group_id, min_confidence: 0.9 },
      ...overrides,
    };
  }

  it("excludes rules whose status is 'fixed' (loop-closure: stop firing reconciler-fixed rules)", () => {
    const registry = [
      rule("a", { status: "wip" }),
      rule("b", { status: "fixed" }),
      rule("c", { status: "permanent" }),
    ];
    const active = active_rules_for_classification(registry);
    expect(active.map((r) => r.group_id)).toEqual(["a", "c"]);
  });

  it("excludes wip rules with drift_detected=true (prevents drifting classifiers from auto-suppressing entries)", () => {
    const registry = [
      rule("a", { status: "wip", drift_detected: true }),
      rule("b", { status: "wip", drift_detected: false }),
      rule("c", { status: "wip" }), // undefined drift_detected → treated as not drifting
    ];
    const active = active_rules_for_classification(registry);
    expect(active.map((r) => r.group_id)).toEqual(["b", "c"]);
  });

  it("keeps permanent rules even if drift_detected is set (drift only gates wip)", () => {
    // A permanent rule with drift_detected is an operator-resolved anomaly;
    // automatic disable would be too disruptive for the bundled core slice.
    const registry = [rule("a", { status: "permanent", drift_detected: true })];
    expect(active_rules_for_classification(registry)).toEqual(registry);
  });

  it("is pure (returns a new array; preserves order)", () => {
    const registry = [rule("a"), rule("b"), rule("c")];
    const active = active_rules_for_classification(registry);
    expect(active).not.toBe(registry);
    expect(active.map((r) => r.group_id)).toEqual(["a", "b", "c"]);
  });

  it("excludes a retired rule (status fixed; classifier never fires again)", () => {
    const registry = [
      rule("a", { status: "wip" }),
      rule("b", {
        status: "fixed",
        classifier: {
          kind: "retired",
          from: { kind: "builtin", function_name: "check_b", min_confidence: 0.9 },
          reason: "subsumed by TASK-348",
        },
      }),
    ];
    const active = active_rules_for_classification(registry);
    expect(active.map((r) => r.group_id)).toEqual(["a"]);
  });
});

// ===== Wire-format envelope =====

describe("registry.json envelope", () => {
  it("is a `{ schema_version, rules }` object with schema_version=1", () => {
    const raw = fs.readFileSync(known_issues_registry_path(), "utf8");
    const parsed = JSON.parse(raw) as { schema_version: number; rules: unknown };
    expect(parsed.schema_version).toEqual(1);
    expect(Array.isArray(parsed.rules)).toBe(true);
  });

  it("rejects a JSON array (legacy bare-array shape)", () => {
    expect(() => validate_registry_envelope_via_load_registry([])).toThrow(/schema_version/);
  });

  it("rejects a `{ schema_version: 2, rules: [] }` mismatch", () => {
    expect(() =>
      validate_registry_envelope_via_load_registry({ schema_version: 2, rules: [] }),
    ).toThrow(/schema_version mismatch/);
  });

  it("rejects an envelope with a missing `rules` array", () => {
    expect(() =>
      validate_registry_envelope_via_load_registry({ schema_version: 1 }),
    ).toThrow(/rules/);
  });
});

/**
 * Drive the wire-format parser the loader uses with a synthetic JSON value.
 * Lets envelope-shape tests assert without writing to a tmp file or rewiring
 * `known_issues_registry_path`.
 */
function validate_registry_envelope_via_load_registry(value: unknown): void {
  parse_known_issues_registry_json(JSON.stringify(value));
}

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

  it("every classifier uses kind in {none, builtin, retired}", () => {
    for (const e of registry) {
      expect(["none", "builtin", "retired"]).toContain(e.classifier.kind);
      if (e.classifier.kind === "builtin") {
        expect(e.classifier.function_name.length).toBeGreaterThan(0);
        expect(e.classifier.min_confidence).toBeGreaterThanOrEqual(0);
        expect(e.classifier.min_confidence).toBeLessThanOrEqual(1);
      }
      if (e.classifier.kind === "retired") {
        expect(e.classifier.from.kind).toEqual("builtin");
        expect(e.classifier.reason.length).toBeGreaterThan(0);
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

  it("rejects a malformed backlog_task reference", () => {
    const registry = clone(load_registry());
    registry[0].backlog_task = "task-123";
    expect(() => validate_registry(registry)).toThrow(/backlog_task/);
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

  it("rejects a wip entry with an authored classifier and no observation evidence", () => {
    const bad: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    bad[0]["status"] = "wip";
    bad[0]["classifier"] = { kind: "builtin", function_name: "check_unobserved", min_confidence: 0.9 };
    delete bad[0]["observed_count"];
    expect(() => validate_registry(bad)).toThrow(/observed_count.*must record observed_count >= 1/);
  });

  it("rejects a wip entry with an authored classifier and observed_count 0", () => {
    const bad: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    bad[0]["status"] = "wip";
    bad[0]["classifier"] = { kind: "builtin", function_name: "check_zero_obs", min_confidence: 0.9 };
    bad[0]["observed_count"] = 0;
    expect(() => validate_registry(bad)).toThrow(/observed_count.*must record observed_count >= 1/);
  });

  it("accepts a wip authored classifier that records observed_count >= 1", () => {
    const ok: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    ok[0]["status"] = "wip";
    ok[0]["classifier"] = { kind: "builtin", function_name: "check_observed", min_confidence: 0.9 };
    ok[0]["observed_count"] = 1;
    expect(() => validate_registry(ok)).not.toThrow();
  });

  it("exempts kind:none wip stubs and permanent rows from the evidence gate", () => {
    const ok: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    // wip + kind:none, no observation → allowed (no classifier to validate)
    ok[0]["status"] = "wip";
    ok[0]["classifier"] = { kind: "none" };
    delete ok[0]["observed_count"];
    // permanent + authored, no observation → allowed (past decision)
    ok[1]["status"] = "permanent";
    ok[1]["classifier"] = { kind: "builtin", function_name: "check_permanent", min_confidence: 0.9 };
    delete ok[1]["observed_count"];
    expect(() => validate_registry(ok)).not.toThrow();
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

// ===== retired classifier (the structured retirement marker) =====

describe("validate_registry — retired classifier", () => {
  function with_first_classifier(classifier: unknown, status = "fixed"): Record<string, unknown>[] {
    const bad: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    bad[0]["status"] = status;
    bad[0]["classifier"] = classifier;
    return bad;
  }

  it("accepts a well-formed retired classifier carrying its former builtin", () => {
    const registry = with_first_classifier({
      kind: "retired",
      from: { kind: "builtin", function_name: "check_x", min_confidence: 0.9 },
      reason: "subsumed by TASK-348",
    });
    expect(() => validate_registry(registry)).not.toThrow();
  });

  it("accepts a retired classifier carrying its former builtin", () => {
    const registry = with_first_classifier({
      kind: "retired",
      from: { kind: "builtin", function_name: "check_former", min_confidence: 1 },
      reason: "resolver now resolves it",
    });
    expect(() => validate_registry(registry)).not.toThrow();
  });

  it("rejects a retired classifier whose `from.kind` is not predicate or builtin", () => {
    const registry = with_first_classifier({
      kind: "retired",
      from: { kind: "none" },
      reason: "x",
    });
    expect(() => validate_registry(registry)).toThrow(/from\.kind/);
  });

  it("rejects a nested retired classifier in `from`", () => {
    const registry = with_first_classifier({
      kind: "retired",
      from: {
        kind: "retired",
        from: { kind: "builtin", function_name: "check_x", min_confidence: 1 },
        reason: "inner",
      },
      reason: "outer",
    });
    expect(() => validate_registry(registry)).toThrow(/from\.kind/);
  });

  it("rejects a retired classifier whose `from` builtin is malformed", () => {
    const registry = with_first_classifier({
      kind: "retired",
      from: { kind: "builtin", function_name: "", min_confidence: 1 },
      reason: "x",
    });
    expect(() => validate_registry(registry)).toThrow(/function_name/);
  });

  it("rejects a retired classifier on a non-fixed row", () => {
    const registry = with_first_classifier(
      {
        kind: "retired",
        from: { kind: "builtin", function_name: "check_x", min_confidence: 1 },
        reason: "x",
      },
      "wip",
    );
    expect(() => validate_registry(registry)).toThrow(/requires status="fixed"/);
  });

  it("rejects a retired classifier whose `from` is not an object", () => {
    const registry = with_first_classifier({ kind: "retired", from: "check_x", reason: "x" });
    expect(() => validate_registry(registry)).toThrow(/from/);
  });

  it("rejects a retired classifier with an empty reason", () => {
    const registry = with_first_classifier({
      kind: "retired",
      from: { kind: "builtin", function_name: "check_x", min_confidence: 1 },
      reason: "",
    });
    expect(() => validate_registry(registry)).toThrow(/reason/);
  });

  it("rejects a retired classifier carrying extra fields", () => {
    const registry = with_first_classifier({
      kind: "retired",
      from: { kind: "builtin", function_name: "check_x", min_confidence: 1 },
      reason: "x",
      bogus: 1,
    });
    expect(() => validate_registry(registry)).toThrow(/extra fields/);
  });

  it("builtin uniqueness ignores a retired rule's former function_name", () => {
    const bad: Record<string, unknown>[] = JSON.parse(JSON.stringify(load_registry()));
    bad[0]["status"] = "permanent";
    bad[0]["classifier"] = { kind: "builtin", function_name: "check_dup", min_confidence: 1 };
    bad[1]["status"] = "fixed";
    bad[1]["classifier"] = {
      kind: "retired",
      from: { kind: "builtin", function_name: "check_dup", min_confidence: 1 },
      reason: "retired but name reused live elsewhere",
    };
    expect(() => validate_registry(bad)).not.toThrow();
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

// ===== Permanent-limitations catalog content =====

describe("permanent-limitations catalog content", () => {
  const registry = load_registry();
  const by_id = new Map(registry.map((e) => [e.group_id, e] as const));

  it("the genuine static-analysis impossibilities are permanent entries carrying builtin classifiers", () => {
    for (const id of [
      "dynamic-dispatch",                      // webpack constructor-keyed Map dispatch
      "string-keyed-dispatch",                 // Angular ɵɵ compiler instructions
      "eval-based-dynamic-dispatch",           // eval / new Function locals
      "dynamic-new-function-dispatch",
      "dynamic-dispatch-reporter-constructor", // mocha string-keyed reporter ctor
      "bundler-module-substitution",           // esbuild fill-plugin substitution
      "dynamic-require-constructor",           // runtime require() + new
      "dynamic-property-keyed-callback",
      "untyped-attribute-receiver",            // untyped Cython self-attribute receiver
      "py-dunder-protocol",
    ]) {
      const entry = by_id.get(id);
      expect(entry?.status).toBe("permanent");
      expect(entry?.classifier.kind).toBe("builtin");
    }
  });

  it("framework-contract invocation patterns are permanent entries", () => {
    for (const id of [
      "framework-lifecycle-handler",           // yargs CommandModule.handler
      "framework-lifecycle-dispatch",          // NestJS reflect-metadata dispatch
      "framework-lifecycle-override",          // Node stream protocol overrides
      "framework-pytest-fixture",
      "framework-flask-route",
      "framework-component-decorator",
    ]) {
      expect(by_id.get(id)?.status).toBe("permanent");
    }
  });

  it("has no wip entries — the catalog's resting state is fully decided", () => {
    // Every classifier has resolved to permanent (a true static-analysis limit),
    // fixed/retired (the bug landed), or out of the registry entirely (deferred
    // fixable bugs tracked only in backlog/tasks/). The last four wip residuals —
    // all confirmed fixable CommonJS/cast/generic-inference gaps — were removed and
    // routed to TASK-353/354/360/361.
    expect(registry.filter((e) => e.status === "wip")).toEqual([]);
  });

  it("classifiers migrated to backlog tasks or removed are absent from the registry", () => {
    // Capture/coverage gaps migrated to TASK-357/358/359; three over-broad,
    // never-observed (obs-absent) taxonomy-seed predicates removed outright. None
    // remains in the permanent-limitations catalog.
    for (const id of [
      "jsx-mdx-component-usage",
      "ts-jsx-component-call",
      "ts-decorator-factory-call",
      "super-inherited-method",
      "module-attribute-alias",
      "aliased-receiver-type-lost",
      // Removed by the follow-up triage (fixable, routed to backlog tasks):
      "dependency-injection-type-resolution",
      "dynamic-cast-structural-type-dispatch",
      "unresolved-receiver-type",
      "receiver-type-unknown",
    ]) {
      expect(by_id.has(id)).toBe(false);
    }
  });

  it("every permanent builtin pins a min_confidence in [0,1]", () => {
    const permanent_builtins = registry.filter(
      (e) => e.status === "permanent" && e.classifier.kind === "builtin",
    );
    expect(permanent_builtins.length).toBeGreaterThan(0);
    for (const e of permanent_builtins) {
      if (e.classifier.kind !== "builtin") continue;
      expect(e.classifier.min_confidence).toBeGreaterThanOrEqual(0);
      expect(e.classifier.min_confidence).toBeLessThanOrEqual(1);
    }
  });
});
