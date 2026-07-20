import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  parse_emitted_captures,
  parse_registry,
  check_consistency,
  check_project,
  RegistryModel,
  DEFINITION_DISPATCH_CATEGORIES,
} from "./capture_receiver_consistency.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function model(
  language: string,
  registry_symbol: string,
  registry_ts: string,
  emitted: string[],
  spreads: string[] = [],
): RegistryModel {
  return {
    source: {
      language,
      registry_symbol,
      registry_file: `${language}.ts`,
      query_file: `${language}.scm`,
      spreads,
    },
    parsed: parse_registry(registry_ts, registry_symbol),
    emitted: new Set(emitted),
  };
}

function registry(symbol: string, entries: Record<string, string>, spreads: string[] = []): string {
  const spread_lines = spreads.map((s) => `  ...${s},`).join("\n");
  const entry_lines = Object.entries(entries)
    .map(([k, v]) => `  "${k}": ${v},`)
    .join("\n");
  return `export const ${symbol}: HandlerRegistry = {\n${spread_lines}\n${entry_lines}\n} as const;\n`;
}

describe("parse_emitted_captures", () => {
  it("extracts dotted capture names", () => {
    const captures = parse_emitted_captures("(x) @definition.function\n(y) @reference.call");
    expect([...captures].sort()).toEqual(["definition.function", "reference.call"]);
  });

  it("extracts deeply-qualified capture names whole", () => {
    const captures = parse_emitted_captures("(x) @definition.import.require.simple");
    expect([...captures]).toEqual(["definition.import.require.simple"]);
  });

  it("ignores hidden underscore-prefixed captures", () => {
    const captures = parse_emitted_captures("(x) @_require\n(y) @definition.import");
    expect([...captures]).toEqual(["definition.import"]);
  });

  it("ignores bare single-segment predicate anchors", () => {
    const captures = parse_emitted_captures("(#eq? @classmethod)\n(x) @definition.method");
    expect([...captures]).toEqual(["definition.method"]);
  });

  it("deduplicates repeated captures", () => {
    const captures = parse_emitted_captures("@definition.class\n@definition.class");
    expect(captures.size).toBe(1);
  });
});

describe("parse_registry", () => {
  it("extracts keys and handler names in declaration order", () => {
    const src = registry("FOO_HANDLERS", {
      "definition.class": "handle_class",
      "definition.method": "handle_method",
    });
    const parsed = parse_registry(src, "FOO_HANDLERS");
    expect(parsed.keys).toEqual(["definition.class", "definition.method"]);
    expect(parsed.key_to_handler.get("definition.method")).toBe("handle_method");
  });

  it("extracts spread symbols", () => {
    const src = registry("TS_HANDLERS", { "definition.interface": "handle_interface" }, [
      "JS_HANDLERS",
    ]);
    expect(parse_registry(src, "TS_HANDLERS").spreads).toEqual(["JS_HANDLERS"]);
  });

  it("does not capture string literals outside the object body", () => {
    const src =
      `const NOTE = "definition.not_a_key: false";\n` +
      registry("FOO_HANDLERS", { "definition.class": "handle_class" });
    expect(parse_registry(src, "FOO_HANDLERS").keys).toEqual(["definition.class"]);
  });

  it("throws when the registry symbol is absent", () => {
    expect(() => parse_registry("const OTHER = {}", "FOO_HANDLERS")).toThrow();
  });
});

describe("check_consistency dead handlers", () => {
  it("flags a registry key no feeding query emits", () => {
    const js = model(
      "javascript",
      "JS_HANDLERS",
      registry("JS_HANDLERS", { "definition.arrow": "handle_arrow" }),
      [],
    );
    const report = check_consistency([js]);
    expect(report.dead_handlers).toEqual([
      { language: "javascript", capture: "definition.arrow", handler: "handle_arrow" },
    ]);
  });

  it("keeps a handler whose capture the query emits", () => {
    const js = model(
      "javascript",
      "JS_HANDLERS",
      registry("JS_HANDLERS", { "definition.function": "handle_function" }),
      ["definition.function"],
    );
    expect(check_consistency([js]).dead_handlers).toEqual([]);
  });

  it("treats a JS handler as live when only the TypeScript query emits it (spread reachability)", () => {
    const js = model(
      "javascript",
      "JS_HANDLERS",
      registry("JS_HANDLERS", { "definition.namespace": "handle_namespace" }),
      [],
    );
    const ts = model(
      "typescript",
      "TS_HANDLERS",
      registry("TS_HANDLERS", {}, ["JS_HANDLERS"]),
      ["definition.namespace"],
      ["JS_HANDLERS"],
    );
    expect(check_consistency([js, ts]).dead_handlers).toEqual([]);
  });

  it("flags a JS handler dead when TypeScript overrides its key and neither query emits it", () => {
    const js = model(
      "javascript",
      "JS_HANDLERS",
      registry("JS_HANDLERS", { "definition.variable": "handle_js_variable" }),
      [],
    );
    const ts = model(
      "typescript",
      "TS_HANDLERS",
      registry("TS_HANDLERS", { "definition.variable": "handle_ts_variable" }, ["JS_HANDLERS"]),
      [],
      ["JS_HANDLERS"],
    );
    const dead = check_consistency([js, ts]).dead_handlers;
    // The JS entry is unreachable: TS shadows it, and no query emits the capture.
    expect(dead).toContainEqual({
      language: "javascript",
      capture: "definition.variable",
      handler: "handle_js_variable",
    });
  });
});

describe("check_consistency orphan captures", () => {
  it("flags an emitted definition-family capture with no handler", () => {
    const js = model(
      "javascript",
      "JS_HANDLERS",
      registry("JS_HANDLERS", { "definition.function": "handle_function" }),
      ["definition.function", "definition.type_parameter"],
    );
    expect(check_consistency([js]).orphan_captures).toEqual([
      { language: "javascript", capture: "definition.type_parameter" },
    ]);
  });

  it("does not flag emitted captures outside the definition-dispatch categories", () => {
    const js = model(
      "javascript",
      "JS_HANDLERS",
      registry("JS_HANDLERS", { "definition.function": "handle_function" }),
      ["definition.function", "reference.call", "scope.block", "assignment.variable"],
    );
    expect(check_consistency([js]).orphan_captures).toEqual([]);
  });

  it("resolves inherited keys so a spread-covered capture is not an orphan", () => {
    const js = model(
      "javascript",
      "JS_HANDLERS",
      registry("JS_HANDLERS", { "definition.class": "handle_class" }),
      [],
    );
    const ts = model(
      "typescript",
      "TS_HANDLERS",
      registry("TS_HANDLERS", {}, ["JS_HANDLERS"]),
      ["definition.class"],
      ["JS_HANDLERS"],
    );
    expect(check_consistency([js, ts]).orphan_captures).toEqual([]);
  });

  it("scopes categories to definition, decorator, and import", () => {
    expect([...DEFINITION_DISPATCH_CATEGORIES]).toEqual(["definition", "decorator", "import"]);
  });
});

describe("check_project against the live repository", () => {
  it("reports zero dead handlers — every registered handler is reachable", () => {
    const report = check_project(REPO_ROOT);
    expect(report.dead_handlers).toEqual([]);
  });

  it("reads the four language registries and their queries without error", () => {
    // Guards the topology paths: a moved registry or query file would throw here.
    expect(() => check_project(REPO_ROOT)).not.toThrow();
    expect(fs.existsSync(path.join(REPO_ROOT, "packages/core/src/index_single_file"))).toBe(true);
  });
});
