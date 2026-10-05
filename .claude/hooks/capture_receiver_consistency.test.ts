import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  parse_emitted_captures,
  strip_scm_comments,
  parse_registry,
  check_consistency,
  check_project,
  is_trigger_file,
  format_dead_handlers,
  format_orphan_captures,
  REGISTRY_TOPOLOGY,
  RegistryModel,
  DEFINITION_DISPATCH_CATEGORIES,
} from "./capture_receiver_consistency.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Build a registry object literal fixture. `spreads` become `...SYMBOL` lines,
// which parse_registry reads — the model derives spread edges from these, not
// from any separately-declared topology.
function registry(symbol: string, entries: Record<string, string>, spreads: string[] = []): string {
  const spread_lines = spreads.map((s) => `  ...${s},`).join("\n");
  const entry_lines = Object.entries(entries)
    .map(([k, v]) => `  "${k}": ${v},`)
    .join("\n");
  return `export const ${symbol}: HandlerRegistry = {\n${spread_lines}\n${entry_lines}\n} as const;\n`;
}

function model(
  language: string,
  registry_symbol: string,
  registry_ts: string,
  emitted: string[],
): RegistryModel {
  return {
    source: {
      language,
      registry_symbol,
      registry_file: `${language}.ts`,
      query_file: `${language}.scm`,
    },
    parsed: parse_registry(registry_ts, registry_symbol),
    emitted: new Set(emitted),
  };
}

describe("strip_scm_comments", () => {
  it("removes a full-line comment", () => {
    expect(strip_scm_comments("; a comment\n(node)")).toBe("\n(node)");
  });

  it("removes a trailing comment but keeps the code before it", () => {
    expect(strip_scm_comments("(node) @definition.x  ; trailing")).toBe("(node) @definition.x  ");
  });

  it("does not treat a semicolon inside a string as a comment", () => {
    expect(strip_scm_comments('(#eq? @x ";keep")')).toBe('(#eq? @x ";keep")');
  });
});

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

  it("does not count a capture named only inside a comment", () => {
    const captures = parse_emitted_captures("; narrates @definition.ghost\n(node) @definition.real");
    expect([...captures]).toEqual(["definition.real"]);
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
    expect(check_consistency([js]).dead_handlers).toEqual([
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
    );
    expect(check_consistency([js, ts]).dead_handlers).toEqual([]);
  });

  it("flags the JS handler dead when TypeScript redeclares its key, even though the TS query emits the capture", () => {
    // Discriminating fixture for the spread/override wrinkle: the TS query DOES
    // emit definition.variable, so a model without the override cutoff would find
    // the JS handler reachable-via-TS and NOT flag it. The correct model cuts the
    // inherited JS entry off from the TS query because TS redeclares the key, so
    // only the JS handler is dead; the TS handler stays live.
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
      ["definition.variable"],
    );
    expect(check_consistency([js, ts]).dead_handlers).toEqual([
      { language: "javascript", capture: "definition.variable", handler: "handle_js_variable" },
    ]);
  });

  it("reports a handler dead when its capture appears only in a query comment", () => {
    const js = model(
      "javascript",
      "JS_HANDLERS",
      registry("JS_HANDLERS", { "definition.ghost": "handle_ghost" }),
      [],
    );
    const from_comment: RegistryModel = {
      ...js,
      emitted: parse_emitted_captures("; @definition.ghost\n(x) @definition.other"),
    };
    expect(check_consistency([from_comment]).dead_handlers).toEqual([
      { language: "javascript", capture: "definition.ghost", handler: "handle_ghost" },
    ]);
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

  it("flags an emitted import-family capture with no handler", () => {
    const js = model(
      "javascript",
      "JS_HANDLERS",
      registry("JS_HANDLERS", { "import.reexport": "handle_reexport" }),
      ["import.reexport", "import.reexport.named"],
    );
    expect(check_consistency([js]).orphan_captures).toEqual([
      { language: "javascript", capture: "import.reexport.named" },
    ]);
  });

  it("flags an emitted decorator-family capture with no handler", () => {
    const py = model(
      "python",
      "PY_HANDLERS",
      registry("PY_HANDLERS", { "decorator.method": "handle_decorator_method" }),
      ["decorator.method", "decorator.macro"],
    );
    expect(check_consistency([py]).orphan_captures).toEqual([
      { language: "python", capture: "decorator.macro" },
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
    );
    expect(check_consistency([js, ts]).orphan_captures).toEqual([]);
  });

  it("scopes categories to definition, decorator, and import", () => {
    expect([...DEFINITION_DISPATCH_CATEGORIES]).toEqual(["definition", "decorator", "import"]);
  });
});

describe("is_trigger_file", () => {
  const base = "packages/core/src/index_single_file/query_code_tree";

  it("triggers on a query file", () => {
    expect(is_trigger_file(`${base}/queries/rust.scm`)).toBe(true);
  });

  it("triggers on a receiver file", () => {
    expect(is_trigger_file(`${base}/capture_handlers/capture_handlers.rust.ts`)).toBe(true);
  });

  it("skips a receiver test file", () => {
    expect(is_trigger_file(`${base}/capture_handlers/capture_handlers.rust.test.ts`)).toBe(false);
  });

  it("skips an unrelated source file", () => {
    expect(is_trigger_file("packages/core/src/index_single_file/index_single_file.ts")).toBe(false);
  });
});

describe("formatters", () => {
  it("renders a dead handler with its count and capture", () => {
    const out = format_dead_handlers([
      { language: "python", capture: "definition.lambda", handler: "handle_definition_lambda" },
    ]);
    expect(out).toContain("Dead capture handlers (1)");
    expect(out).toContain(
      'python: "definition.lambda" → handle_definition_lambda (no query emits @definition.lambda)',
    );
  });

  it("renders an orphan capture with its count and @name", () => {
    const out = format_orphan_captures([{ language: "rust", capture: "decorator.macro" }]);
    expect(out).toContain("Orphan definition captures (1)");
    expect(out).toContain("rust: @decorator.macro (emitted, no handler registered)");
  });
});

describe("check_project against the live repository", () => {
  it("reports zero dead handlers — every registered handler is reachable", () => {
    expect(check_project(REPO_ROOT).dead_handlers).toEqual([]);
  });

  it("reports exactly the two known orphan captures", () => {
    // These are emitted by a query with no handler — genuine latent gaps left as
    // warn-level (see TASK-364.10 Implementation Notes). Pinning them here turns
    // orphan drift (a new orphan, or one of these silently gaining/losing a
    // handler) into a failing test.
    expect(check_project(REPO_ROOT).orphan_captures).toEqual([
      { language: "typescript", capture: "definition.type_parameter" },
      { language: "rust", capture: "decorator.macro" },
    ]);
  });

  it("resolves every REGISTRY_TOPOLOGY path — guards against silent topology rot", () => {
    for (const entry of REGISTRY_TOPOLOGY) {
      expect(fs.existsSync(path.join(REPO_ROOT, entry.registry_file))).toBe(true);
      expect(fs.existsSync(path.join(REPO_ROOT, entry.query_file))).toBe(true);
    }
  });
});
