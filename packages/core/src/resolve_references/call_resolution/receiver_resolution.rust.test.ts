/**
 * Rust integration tests for self-reference call resolution
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from "vitest";
import { Project } from "../../project/project";
import type {
  FilePath,
  SymbolName,
  SelfReferenceCall,
} from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Helper to set up a multi-file project with files on disk before initialization.
 */
async function setup_project(
  files: Record<string, string>
): Promise<{
  project: Project;
  temp_dir: string;
  file_paths: Record<string, FilePath>;
}> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-rs-recv-"));

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

describe("Rust Self-Reference Resolution Integration", () => {
  let project: Project;
  let temp_dir: string;

  beforeAll(() => {
    temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-test-"));
  });

  afterAll(() => {
    if (fs.existsSync(temp_dir)) {
      fs.rmSync(temp_dir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    project = new Project();
    await project.initialize(temp_dir as FilePath);
  });

  describe("self.method()", () => {
    it("should resolve self.method() in impl block", () => {
      const code = `
        struct Counter {
          count: i32,
        }

        impl Counter {
          fn new() -> Self {
            Self { count: 0 }
          }

          fn increment(&mut self) {
            self.set_count(self.count + 1);
          }

          fn set_count(&mut self, value: i32) {
            self.count = value;
          }

          fn get_count(&self) -> i32 {
            self.count
          }
        }
      `;

      const file = path.join(temp_dir, "counter.rs") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const counter_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Counter" as SymbolName)
      );
      expect(counter_struct).toBeDefined();

      const type_info = project.get_type_info(counter_struct!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("set_count" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("get_count" as SymbolName)).toBe(true);

      // Verify self.set_count() is detected as a self_reference_call
      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );
      const set_count_call = self_ref_calls.find(
        (c) => c.name === ("set_count" as SymbolName) && c.keyword === "self"
      );
      expect(set_count_call).toBeDefined();

      // set_count should be referenced via self.set_count() in increment
      const referenced = project.resolutions.get_all_referenced_symbols();
      const set_count_id = type_info!.methods.get("set_count" as SymbolName);
      expect(set_count_id).toBeDefined();
      expect(referenced.has(set_count_id!)).toBe(true);
    });

    it("should handle self parameter borrowing patterns", () => {
      const code = `
        struct Data {
          value: String,
        }

        impl Data {
          fn get_value(&self) -> &str {
            &self.value
          }

          fn update(&mut self, new_value: String) {
            self.value = new_value;
          }

          fn process(&mut self) {
            let current = self.get_value();
            self.update(format!("Processed: {}", current));
          }
        }
      `;

      const file = path.join(temp_dir, "data.rs") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const data_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Data" as SymbolName)
      );
      expect(data_struct).toBeDefined();

      const type_info = project.get_type_info(data_struct!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("get_value" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("update" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("process" as SymbolName)).toBe(true);

      // Verify get_value and update are referenced via self calls in process
      const referenced = project.resolutions.get_all_referenced_symbols();
      const get_value_id = type_info!.methods.get("get_value" as SymbolName);
      const update_id = type_info!.methods.get("update" as SymbolName);
      expect(get_value_id).toBeDefined();
      expect(update_id).toBeDefined();
      expect(referenced.has(get_value_id!)).toBe(true);
      expect(referenced.has(update_id!)).toBe(true);
    });

    it("should resolve self.method() with multiple methods calling each other", () => {
      const code = `
        struct Builder {
          data: Vec<String>,
        }

        impl Builder {
          fn new() -> Self {
            Builder { data: Vec::new() }
          }

          fn add(&mut self, item: String) {
            self.data.push(item);
          }

          fn build(&mut self) -> Vec<String> {
            self.validate();
            self.data.clone()
          }

          fn validate(&self) {
            // validation logic
          }
        }
      `;

      const file = path.join(temp_dir, "builder.rs") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const builder_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Builder" as SymbolName)
      );
      expect(builder_struct).toBeDefined();

      const type_info = project.get_type_info(builder_struct!.symbol_id);
      expect(type_info).toBeDefined();

      // validate should be referenced via self.validate() in build
      const referenced = project.resolutions.get_all_referenced_symbols();
      const validate_id = type_info!.methods.get("validate" as SymbolName);
      expect(validate_id).toBeDefined();
      expect(referenced.has(validate_id!)).toBe(true);
    });
  });

  describe("trait method resolution", () => {
    it("should detect trait methods defined in impl blocks", () => {
      const code = `
        trait Drawable {
          fn draw(&self);
          fn resize(&mut self, width: u32, height: u32);
        }

        struct Circle {
          radius: f64,
        }

        impl Drawable for Circle {
          fn draw(&self) {
            // draw circle
          }

          fn resize(&mut self, width: u32, height: u32) {
            self.draw();
          }
        }
      `;

      const file = path.join(temp_dir, "drawable.rs") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Trait should be detected as interface
      const drawable_trait = Array.from(index!.interfaces.values()).find(
        (i) => i.name === ("Drawable" as SymbolName)
      );
      expect(drawable_trait).toBeDefined();
      expect(drawable_trait!.methods.length).toBeGreaterThanOrEqual(2);

      // Circle struct should have trait impl methods
      const circle_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Circle" as SymbolName)
      );
      expect(circle_struct).toBeDefined();

      // self.draw() in resize should create a self_reference_call
      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );
      const draw_call = self_ref_calls.find(
        (c) => c.name === ("draw" as SymbolName) && c.keyword === "self"
      );
      expect(draw_call).toBeDefined();
    });
  });

  describe("property chain resolution", () => {
    it("should detect self.field access in impl methods", () => {
      const code = `
        struct Config {
          host: String,
          port: u16,
        }

        struct Server {
          config: Config,
        }

        impl Server {
          fn new(host: String, port: u16) -> Self {
            Server {
              config: Config { host, port },
            }
          }

          fn get_host(&self) -> &str {
            &self.config.host
          }

          fn start(&self) {
            let host = self.get_host();
          }
        }
      `;

      const file = path.join(temp_dir, "server.rs") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const server_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Server" as SymbolName)
      );
      expect(server_struct).toBeDefined();

      const type_info = project.get_type_info(server_struct!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("get_host" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("start" as SymbolName)).toBe(true);

      // self.get_host() in start should be resolved
      const referenced = project.resolutions.get_all_referenced_symbols();
      const get_host_id = type_info!.methods.get("get_host" as SymbolName);
      expect(get_host_id).toBeDefined();
      expect(referenced.has(get_host_id!)).toBe(true);
    });
  });
});

describe("Rust Cross-File Receiver Resolution Integration", () => {
  const temp_dirs: string[] = [];

  afterEach(() => {
    // Intentionally deferred cleanup to afterAll below
  });

  afterAll(() => {
    for (const dir of temp_dirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("should resolve self.method() in struct defined in another file", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "lib.rs": `mod engine;\n`,
      "engine.rs": `pub struct Engine {
    running: bool,
}

impl Engine {
    pub fn new() -> Self {
        Engine { running: false }
    }

    pub fn start(&mut self) {
        self.set_running(true);
    }

    fn set_running(&mut self, state: bool) {
        self.running = state;
    }
}
`,
    });
    temp_dirs.push(temp_dir);

    const engine_index = project.get_index_single_file(file_paths["engine.rs"]);
    expect(engine_index).toBeDefined();

    const engine_struct = Array.from(engine_index!.classes.values()).find(
      (c) => c.name === ("Engine" as SymbolName)
    );
    expect(engine_struct).toBeDefined();

    const type_info = project.get_type_info(engine_struct!.symbol_id);
    expect(type_info).toBeDefined();

    // set_running should be referenced via self.set_running() in start
    const referenced = project.resolutions.get_all_referenced_symbols();
    const set_running_id = type_info!.methods.get("set_running" as SymbolName);
    expect(set_running_id).toBeDefined();
    expect(referenced.has(set_running_id!)).toBe(true);
  });
});
