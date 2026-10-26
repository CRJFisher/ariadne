import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  clone_relative_path,
  load_benchmark_suite,
  rebase_clone_paths,
  validate_gold_label,
  type GoldLabel,
} from "./load_benchmark_suite.js";

const CLONE = "/Users/me/.ariadne/triage-entrypoints/repos/acme--lib";

describe("rebase_clone_paths", () => {
  it("rebases a container clone path onto the local clone", () => {
    expect(
      rebase_clone_paths("/home/node/.ariadne/triage-entrypoints/repos/acme--lib/src/a.js", "acme--lib", CLONE),
    ).toEqual(`${CLONE}/src/a.js`);
  });

  it("rebases nested strings and leaves other values alone", () => {
    const input = {
      file_path: "/home/node/.ariadne/triage-entrypoints/repos/acme--lib/src/a.js",
      line: 4,
      sites: [{ file_path: "/Users/other/.ariadne/triage-entrypoints/repos/acme--lib/test/b.js" }],
      unrelated: "/home/node/.ariadne/triage-entrypoints/repos/other--lib/src/a.js",
      empty: null,
    };
    expect(rebase_clone_paths(input, "acme--lib", CLONE)).toEqual({
      file_path: `${CLONE}/src/a.js`,
      line: 4,
      sites: [{ file_path: `${CLONE}/test/b.js` }],
      unrelated: "/home/node/.ariadne/triage-entrypoints/repos/other--lib/src/a.js",
      empty: null,
    });
  });
});

describe("clone_relative_path", () => {
  it("relativizes an absolute path from any machine's clone", () => {
    expect(
      clone_relative_path("/home/node/.ariadne/triage-entrypoints/repos/acme--lib/src/a.js", "acme--lib", CLONE),
    ).toEqual("src/a.js");
  });

  it("passes a relative path through", () => {
    expect(clone_relative_path("src/a.js", "acme--lib", CLONE)).toEqual("src/a.js");
  });
});

const VALID_LABEL: GoldLabel = {
  case_id: "acme--lib__run__L3",
  gold_kind: "fp-classifier-regression",
  acceptable_kinds: ["fp-classifier-regression", "fp-novel"],
  gold_rule_id: "some-rule",
  caller_evidence: [{ file: "src/b.js", line: 9, snippet: "run()" }],
  tp_search_summary: null,
  confidence: "medium",
  rationale: "r",
  prior_verdicts_assessment: "p",
};

describe("validate_gold_label", () => {
  it("accepts a well-formed label", () => {
    expect(validate_gold_label(VALID_LABEL, "x.json")).toEqual(VALID_LABEL);
  });

  it("rejects acceptable_kinds that omit gold_kind", () => {
    expect(() => validate_gold_label({ ...VALID_LABEL, acceptable_kinds: ["fp-novel"] }, "x.json")).toThrow(
      "x.json: acceptable_kinds must be an array containing gold_kind",
    );
  });

  it("rejects a regression-acceptable label without a rule id", () => {
    expect(() => validate_gold_label({ ...VALID_LABEL, gold_rule_id: null }, "x.json")).toThrow(
      "x.json: gold_rule_id is required exactly when fp-classifier-regression is acceptable",
    );
  });

  it("rejects a rule id on a label where no regression is acceptable", () => {
    expect(() =>
      validate_gold_label(
        { ...VALID_LABEL, gold_kind: "fp-novel", acceptable_kinds: ["fp-novel"], gold_rule_id: "some-rule" },
        "x.json",
      ),
    ).toThrow("x.json: gold_rule_id is required exactly when fp-classifier-regression is acceptable");
  });

  it("rejects an unknown verdict kind", () => {
    expect(() => validate_gold_label({ ...VALID_LABEL, gold_kind: "fp" }, "x.json")).toThrow(
      "x.json: gold_kind must be one of tp, fp-novel, fp-classifier-regression, uncertain; got \"fp\"",
    );
  });
});

const FULL_DIAGNOSTICS = {
  grep_call_sites: [],
  grep_call_sites_outside_index: [],
  reference_sites: [],
  ariadne_call_refs: [],
};

describe("load_benchmark_suite", () => {
  let dir: string;
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  function write(rel: string, value: unknown): void {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), JSON.stringify(value));
  }

  it("pairs each label with its case and reads the registry snapshot", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-suite-"));
    const kase = { case_id: VALID_LABEL.case_id, project: "acme--lib", entry: { diagnostics: FULL_DIAGNOSTICS } };
    write(`labels/${VALID_LABEL.case_id}.json`, VALID_LABEL);
    write(`cases/${VALID_LABEL.case_id}.json`, kase);
    write("registry_snapshot.json", { schema_version: 1, rules: [] });
    expect(load_benchmark_suite(dir)).toEqual({
      suite_dir: dir,
      cases: [{ case: kase, label: VALID_LABEL }],
      registry_snapshot: [],
    });
  });

  it("fails when a case file names a different case than its label", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-suite-"));
    write(`labels/${VALID_LABEL.case_id}.json`, VALID_LABEL);
    write(`cases/${VALID_LABEL.case_id}.json`, { case_id: "other" });
    write("registry_snapshot.json", { schema_version: 1, rules: [] });
    expect(() => load_benchmark_suite(dir)).toThrow(
      `cases/${VALID_LABEL.case_id}.json names case other, its label names ${VALID_LABEL.case_id}`,
    );
  });

  it("fails when a case's entry lacks a diagnostics list the context script formats", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-suite-"));
    const { reference_sites: _, ...older } = FULL_DIAGNOSTICS;
    write(`labels/${VALID_LABEL.case_id}.json`, VALID_LABEL);
    write(`cases/${VALID_LABEL.case_id}.json`, { case_id: VALID_LABEL.case_id, entry: { diagnostics: older } });
    write("registry_snapshot.json", { schema_version: 1, rules: [] });
    expect(() => load_benchmark_suite(dir)).toThrow(
      `cases/${VALID_LABEL.case_id}.json: entry diagnostics lack reference_sites`,
    );
  });

  it("fails when a case's diagnosis differs from the route its entry carries", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-suite-"));
    write(`labels/${VALID_LABEL.case_id}.json`, VALID_LABEL);
    write(`cases/${VALID_LABEL.case_id}.json`, {
      case_id: VALID_LABEL.case_id,
      diagnosis: "no-textual-callers",
      entry: { diagnosis: "callers-outside-indexed-corpus", diagnostics: FULL_DIAGNOSTICS },
    });
    write("registry_snapshot.json", { schema_version: 1, rules: [] });
    expect(() => load_benchmark_suite(dir)).toThrow(
      `cases/${VALID_LABEL.case_id}.json: diagnosis no-textual-callers differs from the entry's callers-outside-indexed-corpus`,
    );
  });

  it("loads every case of the shipped suite", () => {
    expect(load_benchmark_suite().cases.length).toEqual(63);
  });
});
