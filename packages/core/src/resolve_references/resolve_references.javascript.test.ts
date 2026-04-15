/**
 * JavaScript multi-file integration tests for resolve_references
 *
 * Verifies cross-file import resolution and call detection through the full
 * pipeline using real files in temp directories.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Project } from "../project/project";
import type { FilePath, SymbolName } from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Helper to set up a project with files already on disk before initialization.
 * The Project scans the file tree at initialize() time, so files must exist first.
 */
async function setup_project(
  files: Record<string, string>
): Promise<{
  project: Project;
  temp_dir: string;
  file_paths: Record<string, FilePath>;
}> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-js-resolve-"));

  const file_paths: Record<string, FilePath> = {};
  for (const [relative_path, content] of Object.entries(files)) {
    const abs_path = path.join(temp_dir, relative_path);
    fs.mkdirSync(path.dirname(abs_path), { recursive: true });
    fs.writeFileSync(abs_path, content);
    file_paths[relative_path] = abs_path as FilePath;
  }

  const project = new Project();
  await project.initialize(temp_dir as FilePath);

  for (const [relative_path, content] of Object.entries(files)) {
    project.update_file(file_paths[relative_path], content);
  }

  return { project, temp_dir, file_paths };
}

const temp_dirs: string[] = [];

afterAll(() => {
  for (const dir of temp_dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("JavaScript Multi-File Resolve References Integration", () => {
  describe("cross-file named import + function call", () => {
    it("should resolve named import function call across files", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "utils.js": `export function formatName(name) {
  return name.toUpperCase();
}
`,
        "main.js": `import { formatName } from "./utils";

export function greet(user) {
  return "Hello, " + formatName(user);
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      // formatName should NOT be an entry point (it's called from main.js)
      const format_entry = call_graph.entry_points.find((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("formatName" as SymbolName) &&
          node.location.file_path === file_paths["utils.js"]
        );
      });
      expect(format_entry).toBeUndefined();
    });

    it("should resolve multiple named imports from the same file", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "math.js": `export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}
`,
        "calc.js": `import { add, multiply } from "./math";

export function compute(x, y) {
  return add(x, y) + multiply(x, y);
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      // Both add and multiply should NOT be entry points
      for (const fn_name of ["add", "multiply"]) {
        const entry = call_graph.entry_points.find((ep) => {
          const node = call_graph.nodes.get(ep);
          return (
            node?.name === (fn_name as SymbolName) &&
            node.location.file_path === file_paths["math.js"]
          );
        });
        expect(entry).toBeUndefined();
      }
    });
  });

  describe("cross-file default export + import", () => {
    it("should resolve default export function call", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "parser.js": `export default function parse(input) {
  return input.split(",");
}
`,
        "consumer.js": `import parse from "./parser";

export function processInput(raw) {
  return parse(raw);
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      // parse should NOT be an entry point
      const parse_entry = call_graph.entry_points.find((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("parse" as SymbolName) &&
          node.location.file_path === file_paths["parser.js"]
        );
      });
      expect(parse_entry).toBeUndefined();
    });
  });

  describe("cross-file re-export chain", () => {
    it("should resolve through barrel file re-exports", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib/helpers.js": `export function helper(x) {
  return x + 1;
}
`,
        "lib/index.js": `export { helper } from "./helpers";
`,
        "app.js": `import { helper } from "./lib/index";

export function run(val) {
  return helper(val);
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      const helper_entry = call_graph.entry_points.find((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("helper" as SymbolName) &&
          node.location.file_path === file_paths["lib/helpers.js"]
        );
      });
      expect(helper_entry).toBeUndefined();
    });
  });

  describe("cross-file class instantiation", () => {
    it("should resolve cross-file constructor call", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "models/user.js": `export class User {
  constructor(name) {
    this.name = name;
  }

  greet() {
    return "Hi, " + this.name;
  }
}
`,
        "service.js": `import { User } from "./models/user";

export function createUser(name) {
  const user = new User(name);
  return user.greet();
}
`,
      });
      temp_dirs.push(temp_dir);

      // Verify the import resolves in name resolution
      const service_scope = project.scopes.get_file_root_scope(
        file_paths["service.js"]
      );
      expect(service_scope).toBeDefined();

      const resolved_user = project.resolutions.resolve(
        service_scope!.id,
        "User" as SymbolName
      );
      expect(resolved_user).not.toBeNull();
      expect(resolved_user).toContain("User");
    });
  });

  describe("cross-file method call via imported object", () => {
    it("should resolve method calls on imported class instances", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "logger.js": `export class Logger {
  log(msg) {
    console.log(msg);
  }

  warn(msg) {
    console.warn(msg);
  }
}
`,
        "app.js": `import { Logger } from "./logger";

const logger = new Logger();

export function doWork() {
  logger.log("starting");
  logger.warn("done");
}
`,
      });
      temp_dirs.push(temp_dir);

      // The Logger class methods should be detectable via type info
      const logger_index = project.get_index_single_file(file_paths["logger.js"]);
      expect(logger_index).toBeDefined();

      const logger_class = Array.from(logger_index!.classes.values()).find(
        (c) => c.name === ("Logger" as SymbolName)
      );
      expect(logger_class).toBeDefined();

      const type_info = project.get_type_info(logger_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("log" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("warn" as SymbolName)).toBe(true);
    });
  });
});
