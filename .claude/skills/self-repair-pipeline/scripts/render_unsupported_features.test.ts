import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  LANGUAGES,
  QUERIES_DIR,
  render_all,
  render_language,
} from "./render_unsupported_features.js";
import { load_registry } from "../src/known_issues_registry.js";
import type { KnownIssue } from "../src/known_issues_types.js";

describe("render_unsupported_features — golden file pinning", () => {
  const registry = load_registry();
  const queries_dir = QUERIES_DIR;

  for (const language of LANGUAGES) {
    it(`${language}.md on disk matches the rendered output`, () => {
      const file_path = path.join(queries_dir, `unsupported_features.${language}.md`);
      expect(fs.existsSync(file_path)).toBe(true);
      const on_disk = fs.readFileSync(file_path, "utf8");
      const rendered = render_language(language, registry);
      expect(on_disk).toEqual(rendered);
    });
  }

  it("emits exactly 4 outputs — one per language", () => {
    const outputs = render_all(registry);
    expect(outputs.map((o) => o.language).sort()).toEqual([...LANGUAGES].sort());
    expect(outputs.map((o) => o.file_name).sort()).toEqual(
      LANGUAGES.map((l) => `unsupported_features.${l}.md`).sort(),
    );
  });
});

describe("render_unsupported_features — per-language filtering", () => {
  it("only includes entries whose languages list contains the target", () => {
    const registry = load_registry();
    for (const language of LANGUAGES) {
      const expected_count = registry.filter((e: KnownIssue) => e.languages.includes(language)).length;
      const content = render_language(language, registry);
      expect(content).toContain(`Entries: ${expected_count}`);
    }
  });

  it("renders a stable header regardless of registry content", () => {
    const registry = load_registry();
    for (const language of LANGUAGES) {
      const content = render_language(language, registry);
      expect(content.startsWith(`# Unsupported features — ${language}`)).toBe(true);
    }
  });
});

describe("render_unsupported_features — classifier rendering", () => {
  it("labels predicate classifiers with axis + min_confidence, and marks 'none' classifiers", () => {
    const registry = load_registry();
    const content = render_language("typescript", registry);
    const has_predicate = registry.some(
      (e) => e.languages.includes("typescript") && e.classifier.kind === "predicate",
    );
    const has_none = registry.some(
      (e) => e.languages.includes("typescript") && e.classifier.kind === "none",
    );
    if (has_predicate) expect(content).toMatch(/predicate, axis [ABC]/);
    if (has_none) expect(content).toContain("_none — known, no automated classifier_");
  });

  it("renders the full predicate DSL block when a predicate classifier is present", () => {
    const registry = load_registry();
    const content = render_language("python", registry);
    const has_predicate = registry.some(
      (e) => e.languages.includes("python") && e.classifier.kind === "predicate",
    );
    if (has_predicate) {
      expect(content).toContain("**Predicate**");
    }
  });
});
