import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Project } from "../project";
import type { FilePath, SymbolName } from "@ariadnejs/types";

// Load the evidence fixtures by content and re-home them under a temp project
// root, so the analyzed path does NOT sit under `.../tests/...` (which the
// file-path test detector would suppress wholesale). This isolates the
// definition-level runner-convention gates under test.
const FIXTURES = path.join(__dirname, "../../tests/fixtures");

function fixture(relative: string): string {
  return readFileSync(path.join(FIXTURES, relative), "utf-8");
}

async function make_project_with(
  files: Record<string, string>
): Promise<Project> {
  const root = await mkdtemp(path.join(tmpdir(), "ariadne-runner-"));
  const project = new Project();
  for (const rel of Object.keys(files)) {
    const dir = path.join(root, path.dirname(rel));
    if (dir !== root) await mkdir(dir, { recursive: true });
    await writeFile(path.join(root, rel), files[rel], "utf8");
  }
  await project.initialize(root as FilePath);
  for (const [rel, content] of Object.entries(files)) {
    project.update_file(path.join(root, rel) as FilePath, content);
  }
  return project;
}

function entry_point_names(project: Project): Set<string> {
  const call_graph = project.get_call_graph();
  return new Set(
    call_graph.entry_points
      .map((id) => project.definitions.get(id)?.name as SymbolName | undefined)
      .filter((n): n is SymbolName => Boolean(n))
  );
}

describe("runner-convention entry-point suppression", () => {
  it("suppresses Rust #[test]/#[cfg(test)] callables while retaining production code", async () => {
    const project = await make_project_with({
      // A non-`tests/` `src` path, matching the actix-web/sqlx/tokio evidence.
      "src/ws/mask.rs": fixture(
        "rust/code/entry_points/test_harness_attributes.rs"
      ),
    });

    const names = entry_point_names(project);

    // Production code remains: the plain function plus the non-test cfg gates
    // `cfg(unix)` and `cfg(not(test))`. Every test-harness callable is gone.
    expect(names).toEqual(
      new Set([
        "run_server",
        "unix_only_entry",
        "prod_only_entry",
      ] as SymbolName[])
    );

    // helper() is reachable from run_server() — never an entry point.
    expect(names.has("helper" as SymbolName)).toBe(false);
    // #[test] directly attributed.
    expect(names.has("top_level_test" as SymbolName)).toBe(false);
    // #[cfg(feature=...)] #[test] — the feature cfg is ignored, the #[test] suppresses.
    expect(names.has("chrono_feature_test" as SymbolName)).toBe(false);
    // #[test] inside a #[cfg(test)] mod.
    expect(names.has("masks_roundtrip" as SymbolName)).toBe(false);
    // Plain helper gated test-only by the enclosing #[cfg(test)].
    expect(names.has("build_fixture" as SymbolName)).toBe(false);
  });

  it("suppresses ASV time_* benchmark methods but retains a same-prefixed method outside asv_bench", async () => {
    const project = await make_project_with({
      "asv_bench/benchmarks/frame_ctor.py": fixture(
        "python/code/asv_bench/benchmarks/frame_ctor.py"
      ),
      "src/stopwatch.py": fixture(
        "python/code/entry_points/timed_outside_asv.py"
      ),
    });

    const names = entry_point_names(project);

    // Every asv_bench time_/mem_/peakmem_ method is suppressed; the only entry
    // point left is the same-prefixed method living outside asv_bench. The
    // exhaustive set proves no benchmark method leaks through.
    expect(names).toEqual(new Set(["time_elapsed"] as SymbolName[]));

    // ASV discovers and invokes these by introspection — suppressed.
    expect(names.has("time_frame_from_scalar_ea_float64" as SymbolName)).toBe(false);
    expect(names.has("mem_frame" as SymbolName)).toBe(false);
    expect(names.has("peakmem_frame" as SymbolName)).toBe(false);

    // Over-suppression guard: a time_-prefixed method outside asv_bench is not a
    // benchmark and stays a genuine entry point.
    expect(names.has("time_elapsed" as SymbolName)).toBe(true);
  });
});
