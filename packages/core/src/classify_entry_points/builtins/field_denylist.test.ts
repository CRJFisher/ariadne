/**
 * Structural guard: no builtin classifier may key on
 * `EnrichedEntryPoint.tree_size` or `.definition_features`.
 *
 * These two fields are absent from the `TriageEntry` a `classifier-author` agent
 * investigates against, and `definition_features` is language-unstable (defaulted
 * for Python/Rust). A check that discriminates on them can pass schema, builtin
 * membership, and even the `--stage` sample gate on the sampled language, yet
 * misfire on the fields the author never verified. This test walks every non-test
 * `.ts` file under `builtins/` — the checks and the helpers they factor logic into
 * — and fails the build on a direct property, string-literal element, or
 * destructure read of a denylisted field: a closed denylist with low
 * false-positive risk (no production file reads either field).
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript";

import { describe, expect, it } from "vitest";

const HERE = __dirname;

const DENYLISTED_FIELDS: ReadonlySet<string> = new Set(["tree_size", "definition_features"]);

interface FieldAccess {
  file: string;
  line: number;
  field: string;
}

/**
 * Every non-test `.ts` file in this directory: the `check_*.ts` classifiers and
 * the helpers they import (a helper reading a denylisted field would evade a
 * check-prefix-only scan).
 */
function collect_check_sources(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".test.ts"))
    .map((e) => path.join(dir, e.name));
}

/**
 * Flag every read of a denylisted field: `x.tree_size`, `x["tree_size"]`, and
 * `const { tree_size } = x`. Name-based (not receiver-typed): the field names are
 * specific enough that any access is a violation regardless of the receiver.
 */
function scan_check_file(abs_path: string): FieldAccess[] {
  const source_text = fs.readFileSync(abs_path, "utf8");
  const source = ts.createSourceFile(
    abs_path,
    source_text,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const hits: FieldAccess[] = [];
  const record = (field: string, node: ts.Node): void => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    hits.push({ file: abs_path, line: line + 1, field });
  };
  function visit(node: ts.Node): void {
    if (ts.isPropertyAccessExpression(node) && DENYLISTED_FIELDS.has(node.name.text)) {
      record(node.name.text, node);
    } else if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      DENYLISTED_FIELDS.has(node.argumentExpression.text)
    ) {
      record(node.argumentExpression.text, node);
    } else if (ts.isBindingElement(node)) {
      const property = node.propertyName ?? node.name;
      if (ts.isIdentifier(property) && DENYLISTED_FIELDS.has(property.text)) {
        record(property.text, node);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return hits;
}

describe("builtin field denylist (AST scan over builtins/check_*.ts)", () => {
  it("no builtin check reads tree_size or definition_features", () => {
    const violations: FieldAccess[] = [];
    for (const file of collect_check_sources(HERE)) {
      violations.push(...scan_check_file(file));
    }
    if (violations.length > 0) {
      const message = violations
        .map((v) => `${path.relative(HERE, v.file)}:${v.line}  reads .${v.field}`)
        .join("\n");
      throw new Error(
        "Builtin check reads a denylisted EnrichedEntryPoint field:\n" +
          message +
          "\n\n`tree_size` and `definition_features` are absent from the TriageEntry a " +
          "classifier-author investigates, and `definition_features` is language-unstable. " +
          "Discriminate on `name`, `file_path`, `kind`, or the diagnostics block instead.",
      );
    }
    expect(violations).toEqual([]);
  });

  it("negative control: a synthetic check reading a denylisted field is flagged", async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "field-denylist-control-"));
    try {
      const synthetic = path.join(tmp, "check_bad.ts");
      await fsp.writeFile(
        synthetic,
        [
          "import type { EnrichedEntryPoint } from \"@ariadnejs/types\";",
          "export function check_bad(entry_point: EnrichedEntryPoint): boolean {",
          "  const { definition_features } = entry_point;",
          "  return entry_point.tree_size > 0 && entry_point[\"definition_features\"] === definition_features;",
          "}",
          "",
        ].join("\n"),
        "utf8",
      );
      const hits = scan_check_file(synthetic);
      expect(hits.map((h) => h.field).sort()).toEqual([
        "definition_features",
        "definition_features",
        "tree_size",
      ]);
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true });
    }
  });
});
