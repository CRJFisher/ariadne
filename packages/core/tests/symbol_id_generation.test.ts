import { Project } from "../src/index";

describe("Symbol ID Generation During Parsing", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test("generates symbol IDs for function definitions", () => {
    const code = `
function processData(input) {
  return input * 2;
}

class User {
  validate() {
    return true;
  }
}
`;

    project.add_or_update_file("src/utils/helpers.ts", code);
    const graph = project.get_scope_graph("src/utils/helpers.ts");
    expect(graph).not.toBeNull();

    const defs = graph!.getAllDefs();

    // Find the processData function
    const processDataDef = defs.find((d) => d.name === "processData");
    expect(processDataDef).toBeDefined();
    expect(processDataDef!.symbol_id).toBe("src/utils/helpers#processData");

    // Find the User class
    const userDef = defs.find((d) => d.name === "User");
    expect(userDef).toBeDefined();
    expect(userDef!.symbol_id).toBe("src/utils/helpers#User");

    // Find the validate method
    const validateDef = defs.find((d) => d.name === "validate");
    expect(validateDef).toBeDefined();
    expect(validateDef!.symbol_id).toBe("src/utils/helpers#User.validate");
  });

  test("generates symbol IDs for Python definitions", () => {
    const code = `
def process_data(input):
    return input * 2

class User:
    def validate(self):
        return True
`;

    project.add_or_update_file("src/models/user.py", code);
    const graph = project.get_scope_graph("src/models/user.py");
    expect(graph).not.toBeNull();

    const defs = graph!.getAllDefs();

    // Find the process_data function
    const processDataDef = defs.find((d) => d.name === "process_data");
    expect(processDataDef).toBeDefined();
    expect(processDataDef!.symbol_id).toBe("src/models/user#process_data");

    // Find the validate method
    const validateDef = defs.find((d) => d.name === "validate");
    expect(validateDef).toBeDefined();
    expect(validateDef!.symbol_id).toBe("src/models/user#User.validate");
  });

  test("handles anonymous functions correctly", () => {
    const code = `
const handler = () => {
  console.log('handler');
};

[1, 2, 3].map(function(x) { return x * 2; });
`;

    project.add_or_update_file("src/handlers.js", code);
    const graph = project.get_scope_graph("src/handlers.js");
    expect(graph).not.toBeNull();

    const defs = graph!.getAllDefs();

    // Log all definitions found for debugging
    console.log(
      "All definitions found:",
      defs.map((d) => ({ name: d.name, kind: d.symbol_kind, id: d.symbol_id }))
    );

    // The handler variable should be defined
    const handlerDef = defs.find((d) => d.name === "handler");
    expect(handlerDef).toBeDefined();
    expect(handlerDef!.symbol_id).toBe("src/handlers#handler");
  });

  test("handles cross-platform paths correctly", () => {
    const code = `function test() { return 42; }`;

    // Simulate Windows-style path
    const windowsPath = "src\\components\\Button.tsx";
    project.add_or_update_file(windowsPath, code);

    const graph = project.get_scope_graph(windowsPath);
    expect(graph).not.toBeNull();

    const defs = graph!.getAllDefs();
    const testDef = defs.find((d) => d.name === "test");
    expect(testDef).toBeDefined();

    // Symbol ID should use forward slashes even on Windows paths
    expect(testDef!.symbol_id).toBe("src/components/Button#test");
  });
});
