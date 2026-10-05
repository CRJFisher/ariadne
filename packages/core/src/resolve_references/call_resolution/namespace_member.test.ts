import { describe, it, expect, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Project } from "../../project/project";
import type { FilePath, SymbolId } from "@ariadnejs/types";

/**
 * A call reached through a namespace hop resolves against the namespace's own
 * members: a TypeScript `namespace` block's body scope, a namespace import's
 * module exports, and either of those behind a named import.
 */
describe("namespace member hops through the project pipeline", () => {
  const temp_dirs: string[] = [];

  afterAll(() => {
    for (const dir of temp_dirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  interface LoadedProject {
    readonly project: Project;
    readonly paths: Readonly<Record<string, FilePath>>;
    readonly sources: Readonly<Record<string, string>>;
  }

  async function load_sources(sources: Record<string, string>): Promise<LoadedProject> {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "namespace-member-")));
    temp_dirs.push(dir);
    const paths: Record<string, FilePath> = {};
    for (const [name, source] of Object.entries(sources)) {
      paths[name] = path.join(dir, name) as FilePath;
      fs.writeFileSync(paths[name], source);
    }
    const project = new Project();
    await project.initialize(dir as FilePath);
    for (const [name, source] of Object.entries(sources)) {
      project.update_file(paths[name], source);
    }
    return { project, paths, sources };
  }

  /** The targets of the one call to `name` on the one line of `file` containing `text`. */
  function targets_on_line(
    { project, paths, sources }: LoadedProject,
    file: string,
    name: string,
    text: string
  ): readonly SymbolId[] {
    const lines = sources[file]
      .split("\n")
      .flatMap((line, index) => (line.includes(text) ? [index + 1] : []));
    expect(lines.length).toBe(1);
    const calls = project.resolutions
      .get_calls_for_file(paths[file])
      .filter((call) => call.name === name && call.location.start_line === lines[0]);
    expect(calls.length).toBe(1);
    return calls[0].resolutions.map((resolution) => resolution.symbol_id);
  }

  /** The function named `name` that `file` declares anywhere, nested namespaces included. */
  function function_in({ project, paths }: LoadedProject, file: string, name: string): SymbolId {
    const found = [...(project.get_index_single_file(paths[file])?.functions.values() ?? [])].find(
      (definition) => definition.name === name
    );
    if (!found) throw new Error(`${file} declares no function ${name}`);
    return found.symbol_id;
  }

  it("resolves a hop through a namespace block nested in a namespace block", async () => {
    const loaded = await load_sources({
      "local.ts": `namespace Outer {
  export namespace Inner {
    export function run(): void {}
  }
}
Outer.Inner.run();
`,
    });

    expect(targets_on_line(loaded, "local.ts", "run", "Outer.Inner.run()")).toEqual([
      function_in(loaded, "local.ts", "run"),
    ]);
  });

  it("resolves a hop through a namespace import to the namespace block its module exports", async () => {
    const loaded = await load_sources({
      "lib.ts": `export namespace Inner {
  export function run(): void {}
}
`,
      "main.ts": `import * as lib from "./lib";
lib.Inner.run();
`,
    });

    expect(targets_on_line(loaded, "main.ts", "run", "lib.Inner.run()")).toEqual([
      function_in(loaded, "lib.ts", "run"),
    ]);
  });

  it("follows a named import to the namespace block it names before descending", async () => {
    const loaded = await load_sources({
      "outer.ts": `export namespace Outer {
  export namespace Inner {
    export function run(): void {}
  }
}
`,
      "main.ts": `import { Outer } from "./outer";
Outer.Inner.run();
`,
    });

    expect(targets_on_line(loaded, "main.ts", "run", "Outer.Inner.run()")).toEqual([
      function_in(loaded, "outer.ts", "run"),
    ]);
  });

  it("leaves a hop to a member the namespace does not declare unresolved", async () => {
    const loaded = await load_sources({
      "local.ts": `namespace Outer {
  export namespace Inner {
    export function run(): void {}
  }
}
Outer.Missing.run();
`,
    });

    expect(targets_on_line(loaded, "local.ts", "run", "Outer.Missing.run()")).toEqual([]);
  });
});
