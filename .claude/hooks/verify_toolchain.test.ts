import { describe, expect, it } from "vitest";
import {
  compare_versions,
  distill_probe_error,
  evaluate_toolchain,
  format_report,
  satisfies_range,
  wrap,
} from "./verify_toolchain.mjs";

/** A machine that can run the pipeline: every check passes from these facts. */
function healthy_facts() {
  return {
    node_version: "v22.23.2",
    node_abi: "127",
    node_required: ">=22.13.0 <23.0.0",
    pnpm_required: "11.9.0",
    pnpm_found: "11.9.0",
    pnpm_error: "",
    modules_present: true,
    modules_written_by: "11.9.0",
    parsers: {
      packages: [
        { name: "tree-sitter", required: "0.25.0", found: "0.25.0" },
        { name: "tree-sitter-javascript", required: "0.25.0", found: "0.25.0" },
        { name: "tree-sitter-python", required: "0.25.0", found: "0.25.0" },
        { name: "tree-sitter-rust", required: "0.24.0", found: "0.24.0" },
        { name: "tree-sitter-typescript", required: "0.23.2", found: "0.23.2" },
      ],
      parsed: true,
      parse_error: "",
    },
  };
}

function failing_labels(facts: ReturnType<typeof healthy_facts>): string[] {
  return evaluate_toolchain(facts)
    .filter((check) => !check.ok)
    .map((check) => check.label);
}

describe("compare_versions", () => {
  it("orders dotted numeric versions component-wise", () => {
    expect(compare_versions("22.13.0", "22.5.1")).toEqual(1);
    expect(compare_versions("22.5.1", "22.13.0")).toEqual(-1);
    expect(compare_versions("22.13.0", "22.13.0")).toEqual(0);
  });

  it("ignores a leading v and any prerelease tag", () => {
    expect(compare_versions("v24.19.0", "24.19.0")).toEqual(0);
    expect(compare_versions("23.0.0-nightly", "23.0.0")).toEqual(0);
  });

  it("treats a missing component as zero", () => {
    expect(compare_versions("22", "22.0.0")).toEqual(0);
    expect(compare_versions("22.1", "22.0.9")).toEqual(1);
  });
});

describe("satisfies_range", () => {
  const SUPPORTED = ">=22.13.0 <23.0.0";

  it("rejects the Node that cannot start pnpm", () => {
    expect(satisfies_range("v22.5.1", SUPPORTED)).toEqual(false);
  });

  it("accepts the supported Node line at both ends", () => {
    expect(satisfies_range("v22.13.0", SUPPORTED)).toEqual(true);
    expect(satisfies_range("v22.23.2", SUPPORTED)).toEqual(true);
  });

  it("rejects the Node whose headers tree-sitter cannot compile against", () => {
    expect(satisfies_range("v23.11.1", SUPPORTED)).toEqual(false);
    expect(satisfies_range("v24.19.0", SUPPORTED)).toEqual(false);
  });

  it("throws rather than pass everything when the range form is unreadable", () => {
    expect(() => satisfies_range("v22.23.2", "^22.13.0")).toThrowError(
      /unsupported comparator "\^22\.13\.0"/,
    );
    expect(() => satisfies_range("v22.23.2", "")).toThrowError(/empty version range/);
  });
});

describe("evaluate_toolchain", () => {
  it("passes every check on a machine that can run the pipeline", () => {
    expect(failing_labels(healthy_facts())).toEqual([]);
  });

  it("fails Node and pnpm together when Node is too old for the pinned pnpm", () => {
    const facts = healthy_facts();
    facts.node_version = "v22.5.1";
    facts.pnpm_found = "";
    facts.pnpm_error = "ERROR: This version of pnpm requires at least Node.js v22.13";
    expect(failing_labels(facts)).toEqual(["Node.js", "pnpm"]);
  });

  it("reports the stalled pnpm's own words as the found value", () => {
    const facts = healthy_facts();
    facts.pnpm_found = "";
    facts.pnpm_error = "ERROR: This version of pnpm requires at least Node.js v22.13";
    const pnpm_check = evaluate_toolchain(facts).find((check) => check.label === "pnpm");
    expect(pnpm_check?.found).toEqual(
      "did not run — ERROR: This version of pnpm requires at least Node.js v22.13",
    );
  });

  it("fails the workspace check when a different pnpm major wrote node_modules", () => {
    const facts = healthy_facts();
    facts.modules_written_by = "10.34.3";
    expect(failing_labels(facts)).toEqual(["Workspace install"]);
  });

  it("fails the workspace check when node_modules is absent", () => {
    const facts = healthy_facts();
    facts.modules_present = false;
    facts.modules_written_by = "";
    const install_check = evaluate_toolchain(facts).find(
      (check) => check.label === "Workspace install",
    );
    expect(install_check?.found).toEqual("node_modules/ is absent");
  });

  it("fails the parser check when the binding crashes under a foreign Node build", () => {
    const facts = healthy_facts();
    facts.parsers.parsed = false;
    // The real text from loading a Node 22.23.2 build under Node 22.5.1: the
    // mismatch segfaults rather than throwing, so the probe reports a signal.
    facts.parsers.parse_error =
      "loading the parser crashed with SIGSEGV — these bindings were compiled for a different Node build than v22.5.1";
    const parser_check = evaluate_toolchain(facts).find(
      (check) => check.label === "tree-sitter parsers",
    );
    expect(parser_check?.found).toEqual(
      "parse failed — loading the parser crashed with SIGSEGV — these bindings were compiled for a different Node build than v22.5.1",
    );
  });

  it("fails the parser check when a fresh clone has no parsers installed", () => {
    const facts = healthy_facts();
    facts.parsers.packages = facts.parsers.packages.map((p) => ({ ...p, found: "" }));
    facts.parsers.parsed = false;
    facts.parsers.parse_error = "Cannot find module 'tree-sitter'";
    const parser_check = evaluate_toolchain(facts).find(
      (check) => check.label === "tree-sitter parsers",
    );
    expect(parser_check?.found).toEqual("parse failed — Cannot find module 'tree-sitter'");
  });

  it("names only the drifted grammars when the pins do not match", () => {
    const facts = healthy_facts();
    facts.parsers.packages[3] = {
      name: "tree-sitter-rust",
      required: "0.24.0",
      found: "0.25.0",
    };
    const parser_check = evaluate_toolchain(facts).find(
      (check) => check.label === "tree-sitter parsers",
    );
    expect(parser_check?.found).toEqual("tree-sitter-rust@0.25.0");
  });

  it("fails Node loudly when engines.node is a range it cannot read", () => {
    const facts = healthy_facts();
    facts.node_required = "^22.13.0";
    const node_check = evaluate_toolchain(facts).find((check) => check.label === "Node.js");
    expect(node_check?.ok).toEqual(false);
    expect(node_check?.required).toEqual(
      '^22.13.0 (unreadable: unsupported comparator "^22.13.0" in range "^22.13.0" — ' +
        "verify_toolchain.mjs reads only >=, >, <=, <, = joined by spaces)",
    );
  });
});

describe("format_report", () => {
  it("says nothing when the toolchain is sound", () => {
    expect(format_report(evaluate_toolchain(healthy_facts()))).toEqual("");
  });

  it("leads with the count of unmet requirements", () => {
    const facts = healthy_facts();
    facts.node_version = "v22.5.1";
    facts.pnpm_found = "";
    facts.pnpm_error = "requires at least Node.js v22.13";
    const report = format_report(evaluate_toolchain(facts));
    expect(report.split("\n")[0]).toEqual(
      "Ariadne toolchain check: 2 of 4 requirements not met.",
    );
  });

  it("gives every failure a required, found and fix line", () => {
    const facts = healthy_facts();
    facts.node_version = "v24.19.0";
    const report = format_report(evaluate_toolchain(facts));
    expect(report).toContain("  FAIL  Node.js");
    expect(report).toContain("        required  >=22.13.0 <23.0.0");
    expect(report).toContain("        found     v24.19.0");
    expect(report).toContain("        fix       nvm install 22 && nvm use 22");
  });

  it("still lists what does work, so the report locates the fault", () => {
    const facts = healthy_facts();
    facts.node_version = "v24.19.0";
    const report = format_report(evaluate_toolchain(facts));
    expect(report).toContain("  OK    pnpm · Workspace install · tree-sitter parsers");
  });
});

describe("wrap", () => {
  it("breaks prose on word boundaries within the width", () => {
    expect(wrap("the call graph needs a parser", 12)).toEqual([
      "the call",
      "graph needs",
      "a parser",
    ]);
  });

  it("keeps a word longer than the width on its own line", () => {
    expect(wrap("ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY here", 10)).toEqual([
      "ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY",
      "here",
    ]);
  });
});

describe("distill_probe_error", () => {
  it("reports the missing module, not the loader frame Node prints first", () => {
    const dump = [
      "node:internal/modules/cjs/loader:1433",
      "  throw err;",
      "  ^",
      "",
      "Error: Cannot find module 'tree-sitter'",
      "    at Function._resolveFilename (node:internal/modules/cjs/loader:1433:15)",
    ].join("\n");
    expect(distill_probe_error(dump)).toEqual("Cannot find module 'tree-sitter'");
  });

  it("keeps a bare message that carries no Error: prefix", () => {
    expect(distill_probe_error("parser returned an unexpected root node")).toEqual(
      "parser returned an unexpected root node",
    );
  });

  it("says the parser did not load when the child died silently", () => {
    expect(distill_probe_error("")).toEqual("the parser did not load");
  });
});
