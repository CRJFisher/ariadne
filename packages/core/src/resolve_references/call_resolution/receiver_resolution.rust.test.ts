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

      const counter_members = project.definitions
        .get_member_index()
        .get(counter_struct!.symbol_id);
      const set_count_id = counter_members?.get("set_count" as SymbolName);
      const get_count_id = counter_members?.get("get_count" as SymbolName);
      expect(set_count_id).toBe(
        counter_struct!.methods.find((m) => m.name === ("set_count" as SymbolName))!.symbol_id
      );
      expect(get_count_id).toBe(
        counter_struct!.methods.find((m) => m.name === ("get_count" as SymbolName))!.symbol_id
      );

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

      const data_members = project.definitions
        .get_member_index()
        .get(data_struct!.symbol_id);
      const get_value_id = data_members?.get("get_value" as SymbolName);
      const update_id = data_members?.get("update" as SymbolName);
      const process_id = data_members?.get("process" as SymbolName);
      expect(get_value_id).toBe(
        data_struct!.methods.find((m) => m.name === ("get_value" as SymbolName))!.symbol_id
      );
      expect(update_id).toBe(
        data_struct!.methods.find((m) => m.name === ("update" as SymbolName))!.symbol_id
      );
      expect(process_id).toBe(
        data_struct!.methods.find((m) => m.name === ("process" as SymbolName))!.symbol_id
      );

      // Verify get_value and update are referenced via self calls in process
      const referenced = project.resolutions.get_all_referenced_symbols();
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

      // validate should be referenced via self.validate() in build
      const referenced = project.resolutions.get_all_referenced_symbols();
      const validate_id = project.definitions
        .get_member_index()
        .get(builder_struct!.symbol_id)
        ?.get("validate" as SymbolName);
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

      const server_members = project.definitions
        .get_member_index()
        .get(server_struct!.symbol_id);
      const get_host_id = server_members?.get("get_host" as SymbolName);
      const start_id = server_members?.get("start" as SymbolName);
      expect(get_host_id).toBe(
        server_struct!.methods.find((m) => m.name === ("get_host" as SymbolName))!.symbol_id
      );
      expect(start_id).toBe(
        server_struct!.methods.find((m) => m.name === ("start" as SymbolName))!.symbol_id
      );

      // self.get_host() in start should be resolved
      const referenced = project.resolutions.get_all_referenced_symbols();
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
      "lib.rs": "mod engine;\n",
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

    // set_running should be referenced via self.set_running() in start
    const referenced = project.resolutions.get_all_referenced_symbols();
    const set_running_id = project.definitions
      .get_member_index()
      .get(engine_struct!.symbol_id)
      ?.get("set_running" as SymbolName);
    expect(set_running_id).toBeDefined();
    expect(referenced.has(set_running_id!)).toBe(true);
  });
});

/**
 * An `impl` block is a `block` scope that names the type it implements, so a
 * `self` receiver inside it reads that name rather than being inferred from the
 * members the block happens to hold. Each case here is a shape the member scan
 * this replaced could not name.
 */
describe("Rust self-receiver resolution through the impl block's self type (TASK-376.5)", () => {
  const temp_dirs: string[] = [];

  afterAll(() => {
    for (const dir of temp_dirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  /** Whether the named member of the named type is reached by some call. */
  function is_referenced(
    project: Project,
    type_name: string,
    member: string,
    file: FilePath
  ): boolean {
    const index = project.get_index_single_file(file);
    const declaration = [
      ...index!.classes.values(),
      ...index!.enums.values(),
    ].find((c) => c.name === (type_name as SymbolName));
    expect(declaration).toBeDefined();
    const member_id = project.definitions
      .get_member_index()
      .get(declaration!.symbol_id)
      ?.get(member as SymbolName);
    expect(member_id).toBeDefined();
    return project.resolutions.get_all_referenced_symbols().has(member_id!);
  }

  // sqlx PgCube (sqlx-postgres/src/types/cube.rs) — two chained self hops across
  // two types, each named by its own impl block.
  it("resolves self.method().method() across two types' impl blocks", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "lib.rs": "mod cube;\n",
      "cube.rs": `pub struct PgCube {
    dims: u8,
}

impl PgCube {
    fn header(&self) -> Header {
        Header { size: self.dims }
    }

    pub fn total(&self) -> u8 {
        self.header().encoded_size()
    }
}

pub struct Header {
    size: u8,
}

impl Header {
    fn encoded_size(&self) -> u8 {
        self.size
    }
}
`,
    });
    temp_dirs.push(temp_dir);
    const file = file_paths["cube.rs"];

    expect(is_referenced(project, "PgCube", "header", file)).toBe(true);
    expect(is_referenced(project, "Header", "encoded_size", file)).toBe(true);
  });

  it("resolves self.method() across two impl blocks on one enum", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "lib.rs": "mod shape;\n",
      "shape.rs": `pub enum Shape {
    Square,
    Round,
}

impl Shape {
    fn sides(&self) -> u8 {
        match self {
            Shape::Square => 4,
            Shape::Round => 0,
        }
    }
}

impl Shape {
    pub fn describe(&self) -> u8 {
        self.sides()
    }
}
`,
    });
    temp_dirs.push(temp_dir);

    expect(is_referenced(project, "Shape", "sides", file_paths["shape.rs"])).toBe(
      true
    );
  });

  it("resolves self.name() to the method when a field shares the name", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "lib.rs": "mod node;\n",
      "node.rs": `pub struct Node {
    size: u8,
}

impl Node {
    fn size(&self) -> u8 {
        self.size
    }

    pub fn report(&self) -> u8 {
        self.size()
    }
}
`,
    });
    temp_dirs.push(temp_dir);

    expect(is_referenced(project, "Node", "size", file_paths["node.rs"])).toBe(
      true
    );
  });
});
