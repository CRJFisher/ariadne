import { describe, expect, it } from "vitest";
import {
  check_barrels,
  check_boundaries,
  check_stage,
  extract_module_edges,
  format_violation,
  type SourceFile,
  type Violation,
} from "./stage_boundary.js";

const CORE = "packages/core/src";

function file(path: string, content: string): SourceFile {
  return { path, content };
}

describe("extract_module_edges", () => {
  it("reports the statement line for a multi-line import", () => {
    const edges = extract_module_edges(
      file(
        `${CORE}/index_single_file/parsed_file.ts`,
        `import { a } from "./a";\nimport {\n  b,\n  c,\n} from "./b";\n`
      )
    );
    expect(edges).toEqual([
      { specifier: "./a", line: 1, is_export_from: false, is_value: true },
      { specifier: "./b", line: 2, is_export_from: false, is_value: true },
    ]);
  });

  it("ignores import-like text in comments and template literals", () => {
    const edges = extract_module_edges(
      file(
        `${CORE}/index_single_file/parsed_file.ts`,
        `// import { x } from "../resolve_references/x";\n` +
          `const s = \`import y from "../resolve_references/y"\`;\n`
      )
    );
    expect(edges).toEqual([]);
  });

  it("ignores dynamic import() expressions", () => {
    const edges = extract_module_edges(
      file(
        `${CORE}/index_single_file/parsed_file.ts`,
        `const m = await import("../resolve_references/registries/definition");\n`
      )
    );
    expect(edges).toEqual([]);
  });

  it("marks a side-effect import as a value edge", () => {
    const edges = extract_module_edges(
      file(`${CORE}/project/project.ts`, `import "./side_effect";\n`)
    );
    expect(edges).toEqual([
      { specifier: "./side_effect", line: 1, is_export_from: false, is_value: true },
    ]);
  });
});

describe("check_stage", () => {
  it("blocks a value import from a lower stage to a later stage", () => {
    const violations = check_stage([
      file(
        `${CORE}/index_single_file/parsed_file.ts`,
        `import { DefinitionRegistry } from "../resolve_references/registries/definition";\n`
      ),
    ]);
    expect(violations).toEqual<Violation[]>([
      {
        kind: "stage_import",
        file: `${CORE}/index_single_file/parsed_file.ts`,
        line: 1,
        specifier: "../resolve_references/registries/definition",
        importer_stage: 1,
        target_stage: 2,
      },
    ]);
  });

  it("blocks a stage value-importing the project orchestrator", () => {
    const violations = check_stage([
      file(
        `${CORE}/resolve_references/name_resolution.ts`,
        `import { Project } from "../project/project";\n`
      ),
    ]);
    expect(violations).toEqual<Violation[]>([
      {
        kind: "stage_import",
        file: `${CORE}/resolve_references/name_resolution.ts`,
        line: 1,
        specifier: "../project/project",
        importer_stage: 2,
        target_stage: Number.POSITIVE_INFINITY,
      },
    ]);
  });

  it("blocks a value export-from that crosses to a later stage", () => {
    const violations = check_stage([
      file(
        `${CORE}/index_single_file/definitions.ts`,
        `export { TypeRegistry } from "../resolve_references/registries/type";\n`
      ),
    ]);
    expect(violations).toEqual<Violation[]>([
      {
        kind: "stage_import",
        file: `${CORE}/index_single_file/definitions.ts`,
        line: 1,
        specifier: "../resolve_references/registries/type",
        importer_stage: 1,
        target_stage: 2,
      },
    ]);
  });

  it("blocks registries value-importing call_resolution (review violation 2)", () => {
    const violations = check_stage([
      file(
        `${CORE}/resolve_references/registries/type.ts`,
        `import { resolve_namespace_export } from "../call_resolution/method_lookup";\n`
      ),
    ]);
    expect(violations).toEqual<Violation[]>([
      {
        kind: "registries_import",
        file: `${CORE}/resolve_references/registries/type.ts`,
        line: 1,
        specifier: "../call_resolution/method_lookup",
      },
    ]);
  });

  it("allows a later stage importing an earlier stage (review violation 3 is a relocation call, not a direction breach)", () => {
    const violations = check_stage([
      file(
        `${CORE}/resolve_references/call_resolution/call_resolver.ts`,
        `import { find_enclosing_function_scope } from "../../index_single_file/scopes/utils";\n`
      ),
    ]);
    expect(violations).toEqual([]);
  });

  it("allows project importing any stage (review violation 4 is a relocation call, not a direction breach)", () => {
    const violations = check_stage([
      file(
        `${CORE}/project/import_graph.ts`,
        `import { resolve_module_path } from "../resolve_references/import_resolution/import_resolution";\n`
      ),
    ]);
    expect(violations).toEqual([]);
  });

  it("allows a same-stage import across stage-3 directories", () => {
    const violations = check_stage([
      file(
        `${CORE}/trace_call_graph/call_graph.ts`,
        `import { classify } from "../classify_entry_points/classify";\n`
      ),
    ]);
    expect(violations).toEqual([]);
  });

  it("exempts a whole-statement import type across stages", () => {
    const violations = check_stage([
      file(
        `${CORE}/index_single_file/parsed_file.ts`,
        `import type { TypeRegistry } from "../resolve_references/registries/type";\n`
      ),
    ]);
    expect(violations).toEqual([]);
  });

  it("exempts an inline all-type import across stages", () => {
    const violations = check_stage([
      file(
        `${CORE}/index_single_file/parsed_file.ts`,
        `import { type TypeRegistry, type DefinitionRegistry } from "../resolve_references/registries/type";\n`
      ),
    ]);
    expect(violations).toEqual([]);
  });

  it("blocks a mixed import when any binding is a value", () => {
    const violations = check_stage([
      file(
        `${CORE}/index_single_file/parsed_file.ts`,
        `import { type TypeRegistry, build_registry } from "../resolve_references/registries/type";\n`
      ),
    ]);
    expect(violations).toEqual<Violation[]>([
      {
        kind: "stage_import",
        file: `${CORE}/index_single_file/parsed_file.ts`,
        line: 1,
        specifier: "../resolve_references/registries/type",
        importer_stage: 1,
        target_stage: 2,
      },
    ]);
  });

  it("exempts an export type from across stages", () => {
    const violations = check_stage([
      file(
        `${CORE}/index_single_file/definitions.ts`,
        `export type { TypeRegistry } from "../resolve_references/registries/type";\n`
      ),
    ]);
    expect(violations).toEqual([]);
  });

  it("blocks a default import carrying only type named bindings across stages", () => {
    const violations = check_stage([
      file(
        `${CORE}/index_single_file/parsed_file.ts`,
        `import DefinitionRegistry, { type Options } from "../resolve_references/registries/definition";\n`
      ),
    ]);
    expect(violations).toEqual<Violation[]>([
      {
        kind: "stage_import",
        file: `${CORE}/index_single_file/parsed_file.ts`,
        line: 1,
        specifier: "../resolve_references/registries/definition",
        importer_stage: 1,
        target_stage: 2,
      },
    ]);
  });

  it("blocks an export star as namespace crossing to a later stage", () => {
    const violations = check_stage([
      file(
        `${CORE}/index_single_file/definitions.ts`,
        `export * as registries from "../resolve_references/registries/type";\n`
      ),
    ]);
    expect(violations).toEqual<Violation[]>([
      {
        kind: "stage_import",
        file: `${CORE}/index_single_file/definitions.ts`,
        line: 1,
        specifier: "../resolve_references/registries/type",
        importer_stage: 1,
        target_stage: 2,
      },
    ]);
  });

  it("blocks a cross-stage value import written with a .js specifier suffix", () => {
    const violations = check_stage([
      file(
        `${CORE}/index_single_file/parsed_file.ts`,
        `import { build_registry } from "../resolve_references/registries/type.js";\n`
      ),
    ]);
    expect(violations).toEqual<Violation[]>([
      {
        kind: "stage_import",
        file: `${CORE}/index_single_file/parsed_file.ts`,
        line: 1,
        specifier: "../resolve_references/registries/type.js",
        importer_stage: 1,
        target_stage: 2,
      },
    ]);
  });

  it("ignores cross-package and bare specifiers", () => {
    const violations = check_stage([
      file(
        `${CORE}/index_single_file/parsed_file.ts`,
        `import { SemanticIndex } from "@ariadnejs/types";\nimport * as path from "path";\n`
      ),
    ]);
    expect(violations).toEqual([]);
  });

  it("ignores importers without a stage (cross-cutting and root files)", () => {
    const violations = check_stage([
      file(
        `${CORE}/logging/logger.ts`,
        `import { Project } from "../project/project";\n`
      ),
      file(
        `${CORE}/detect_language.ts`,
        `import { Project } from "./project/project";\n`
      ),
    ]);
    expect(violations).toEqual([]);
  });

  it("ignores files outside packages/core/src", () => {
    const violations = check_stage([
      file(
        "packages/mcp/src/server.ts",
        `import { x } from "../../core/src/resolve_references/x";\n`
      ),
    ]);
    expect(violations).toEqual([]);
  });

  it("exempts the two grandfathered 362.6 back-edges", () => {
    const violations = check_stage([
      file(
        `${CORE}/trace_call_graph/trace_call_graph.ts`,
        `import { is_test_file } from "../project/detect_test_file";\n`
      ),
      file(
        `${CORE}/classify_entry_points/attach_out_of_index_grep_hits.ts`,
        `import { find_source_files } from "../project/file_loading";\n`
      ),
    ]);
    expect(violations).toEqual([]);
  });

  it("blocks a new project import from a file holding a grandfathered edge", () => {
    const violations = check_stage([
      file(
        `${CORE}/trace_call_graph/trace_call_graph.ts`,
        `import { is_test_file } from "../project/detect_test_file";\n` +
          `import { load_project } from "../project/load_project";\n`
      ),
    ]);
    expect(violations).toEqual<Violation[]>([
      {
        kind: "stage_import",
        file: `${CORE}/trace_call_graph/trace_call_graph.ts`,
        line: 2,
        specifier: "../project/load_project",
        importer_stage: 3,
        target_stage: Number.POSITIVE_INFINITY,
      },
    ]);
  });

  it("exempts test files from the direction rule", () => {
    const violations = check_stage([
      file(
        `${CORE}/index_single_file/parsed_file.test.ts`,
        `import { TypeRegistry } from "../resolve_references/registries/type";\n`
      ),
    ]);
    expect(violations).toEqual([]);
  });
});

describe("check_barrels", () => {
  it("blocks an index.ts re-export that escapes its subtree (review violation 1)", () => {
    const barrel = file(
      `${CORE}/project/index.ts`,
      `export { DefinitionRegistry } from "../resolve_references/registries/definition";\n` +
        `export { Project } from "./project";\n`
    );
    expect(check_barrels([barrel], [])).toEqual<Violation[]>([
      {
        kind: "barrel_escape",
        file: `${CORE}/project/index.ts`,
        line: 1,
        specifier: "../resolve_references/registries/definition",
      },
    ]);
  });

  it("blocks a re-export from a sibling directory sharing the barrel dir's name prefix", () => {
    const barrel = file(
      `${CORE}/project/index.ts`,
      `export { x } from "../project_queries/x";\n`
    );
    expect(check_barrels([barrel], [])).toEqual<Violation[]>([
      {
        kind: "barrel_escape",
        file: `${CORE}/project/index.ts`,
        line: 1,
        specifier: "../project_queries/x",
      },
    ]);
  });

  it("allows a barrel re-exporting its own subtree at any depth", () => {
    const barrel = file(
      `${CORE}/resolve_references/index.ts`,
      `export { TypeRegistry } from "./registries/type";\nexport * from "./name_resolution";\n`
    );
    expect(check_barrels([barrel], [])).toEqual([]);
  });

  it("blocks an escaping export star", () => {
    const barrel = file(
      `${CORE}/project/index.ts`,
      `export * from "../trace_call_graph/call_graph";\n`
    );
    expect(check_barrels([barrel], [])).toEqual<Violation[]>([
      {
        kind: "barrel_escape",
        file: `${CORE}/project/index.ts`,
        line: 1,
        specifier: "../trace_call_graph/call_graph",
      },
    ]);
  });

  it("blocks an escaping type-only re-export (surface ownership includes types)", () => {
    const barrel = file(
      `${CORE}/project/index.ts`,
      `export type { CallGraph } from "../trace_call_graph/call_graph";\n`
    );
    expect(check_barrels([barrel], [])).toEqual<Violation[]>([
      {
        kind: "barrel_escape",
        file: `${CORE}/project/index.ts`,
        line: 1,
        specifier: "../trace_call_graph/call_graph",
      },
    ]);
  });

  it("allows the package entry barrel to re-export the top-level surface", () => {
    const barrel = file(
      `${CORE}/index.ts`,
      `export { Project } from "./project";\nexport { detect_language } from "./detect_language";\n`
    );
    expect(check_barrels([barrel], [])).toEqual([]);
  });

  it("flags a barrel with zero exports and zero importers as dead", () => {
    const barrel = file(`${CORE}/logging/index.ts`, `// re-export hub\n`);
    const corpus = [
      barrel,
      file(`${CORE}/logging/logger.ts`, `export const log = 1;\n`),
    ];
    expect(check_barrels([barrel], corpus)).toEqual<Violation[]>([
      { kind: "dead_barrel", file: `${CORE}/logging/index.ts` },
    ]);
  });

  it("spares a zero-export barrel imported via its directory specifier", () => {
    const barrel = file(`${CORE}/logging/index.ts`, `// re-export hub\n`);
    const corpus = [
      barrel,
      file(`${CORE}/project/project.ts`, `import { log } from "../logging";\n`),
    ];
    expect(check_barrels([barrel], corpus)).toEqual([]);
  });

  it("spares a zero-export barrel imported via an explicit index specifier", () => {
    const barrel = file(`${CORE}/logging/index.ts`, `// re-export hub\n`);
    const corpus = [
      barrel,
      file(
        `${CORE}/project/project.ts`,
        `import { log } from "../logging/index.js";\n`
      ),
    ];
    expect(check_barrels([barrel], corpus)).toEqual([]);
  });

  it("spares a barrel that still exports, even with no importers", () => {
    const barrel = file(
      `${CORE}/persistence/index.ts`,
      `export * from "./storage";\n`
    );
    expect(check_barrels([barrel], [barrel])).toEqual([]);
  });

  it("never flags the package entry barrel as dead", () => {
    const barrel = file(`${CORE}/index.ts`, `// entry\n`);
    expect(check_barrels([barrel], [barrel])).toEqual([]);
  });
});

describe("check_boundaries", () => {
  it("reports exactly the deterministic violations across a mixed change set", () => {
    const changed = [
      file(
        `${CORE}/project/index.ts`,
        `export { DefinitionRegistry } from "../resolve_references/registries/definition";\n` +
          `export { Project } from "./project";\n`
      ),
      file(
        `${CORE}/resolve_references/registries/type.ts`,
        `import { resolve_namespace_export } from "../call_resolution/method_lookup";\n`
      ),
      file(
        `${CORE}/resolve_references/call_resolution/call_resolver.ts`,
        `import { find_enclosing_function_scope } from "../../index_single_file/scopes/utils";\n`
      ),
      file(
        `${CORE}/project/import_graph.ts`,
        `import { resolve_module_path } from "../resolve_references/import_resolution/import_resolution";\n`
      ),
    ];
    expect(check_boundaries(changed, [])).toEqual<Violation[]>([
      {
        kind: "registries_import",
        file: `${CORE}/resolve_references/registries/type.ts`,
        line: 1,
        specifier: "../call_resolution/method_lookup",
      },
      {
        kind: "barrel_escape",
        file: `${CORE}/project/index.ts`,
        line: 1,
        specifier: "../resolve_references/registries/definition",
      },
    ]);
  });
});

describe("format_violation", () => {
  it("names file, line, and specifier for a stage violation", () => {
    expect(
      format_violation({
        kind: "stage_import",
        file: `${CORE}/index_single_file/parsed_file.ts`,
        line: 3,
        specifier: "../resolve_references/registries/type",
        importer_stage: 1,
        target_stage: 2,
      })
    ).toEqual(
      `packages/core/src/index_single_file/parsed_file.ts:3 value-imports ` +
        `"../resolve_references/registries/type" — stage 1 must not import later stage 2; ` +
        `use import type or move the code to the owning stage`
    );
  });

  it("names the orchestrator when the target is project", () => {
    expect(
      format_violation({
        kind: "stage_import",
        file: `${CORE}/resolve_references/name_resolution.ts`,
        line: 7,
        specifier: "../project/project",
        importer_stage: 2,
        target_stage: Number.POSITIVE_INFINITY,
      })
    ).toEqual(
      `packages/core/src/resolve_references/name_resolution.ts:7 value-imports ` +
        `"../project/project" — stage 2 must not import project (the orchestrator); ` +
        `use import type or move the code to the owning stage`
    );
  });

  it("names the forbidden edge for a registries import", () => {
    expect(
      format_violation({
        kind: "registries_import",
        file: `${CORE}/resolve_references/registries/type.ts`,
        line: 20,
        specifier: "../call_resolution/method_lookup",
      })
    ).toEqual(
      `packages/core/src/resolve_references/registries/type.ts:20 value-imports ` +
        `"../call_resolution/method_lookup" — registries never import call_resolution`
    );
  });

  it("names the escaping re-export for a barrel escape", () => {
    expect(
      format_violation({
        kind: "barrel_escape",
        file: `${CORE}/project/index.ts`,
        line: 1,
        specifier: "../resolve_references/registries/definition",
      })
    ).toEqual(
      `packages/core/src/project/index.ts:1 re-exports ` +
        `"../resolve_references/registries/definition" — an index.ts re-exports only ` +
        `its own directory subtree`
    );
  });

  it("states the delete instruction for a dead barrel", () => {
    expect(
      format_violation({ kind: "dead_barrel", file: `${CORE}/logging/index.ts` })
    ).toEqual(
      `packages/core/src/logging/index.ts has zero exports and zero importers — delete this dead barrel`
    );
  });
});
