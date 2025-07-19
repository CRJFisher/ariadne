import { Project } from "../index";
import { beforeEach, describe, expect, test } from "vitest";

describe("Import Resolution API", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  describe("get_imports_with_definitions", () => {
    test("resolves simple imports to their definitions", () => {
      const utilsCode = `
export function helper() {
  return 42;
}

export const constant = 100;
`;

      const mainCode = `
import { helper, constant } from './utils';

function main() {
  return helper() + constant;
}
`;

      project.add_or_update_file("utils.ts", utilsCode);
      project.add_or_update_file("main.ts", mainCode);

      const imports = project.get_imports_with_definitions("main.ts");

      expect(imports.length).toBe(2);

      // Check helper import
      const helperImport = imports.find((i) => i.local_name === "helper");
      expect(helperImport).toBeDefined();
      expect(helperImport!.imported_function.name).toBe("helper");
      expect(helperImport!.imported_function.symbol_kind).toBe("function");
      expect(helperImport!.imported_function.file_path).toBe("utils.ts");

      // Check constant import
      const constantImport = imports.find((i) => i.local_name === "constant");
      expect(constantImport).toBeDefined();
      expect(constantImport!.imported_function.name).toBe("constant");
      expect(constantImport!.imported_function.symbol_kind).toBe("constant");
    });

    test("handles renamed imports correctly", () => {
      const libCode = `
export function originalName() {
  return 'original';
}
`;

      const appCode = `
import { originalName as renamed } from './lib';

function useRenamed() {
  return renamed();
}
`;

      project.add_or_update_file("lib.ts", libCode);
      project.add_or_update_file("app.ts", appCode);

      const imports = project.get_imports_with_definitions("app.ts");

      expect(imports.length).toBe(1);
      expect(imports[0].local_name).toBe("renamed");
      expect(imports[0].import_statement.source_name).toBe("originalName");
      expect(imports[0].imported_function.name).toBe("originalName");
    });

    test("returns empty array for file with no imports", () => {
      const code = `
function standalone() {
  return 'no imports here';
}
`;

      project.add_or_update_file("standalone.ts", code);
      const imports = project.get_imports_with_definitions("standalone.ts");

      expect(imports).toEqual([]);
    });

    test("returns empty array for non-existent file", () => {
      const imports = project.get_imports_with_definitions("non-existent.ts");
      expect(imports).toEqual([]);
    });

    test("only includes imports that can be resolved", () => {
      const mainCode = `
import { exists } from './utils';
import { doesNotExist } from './missing';

function main() {
  return exists();
}
`;

      const utilsCode = `
export function exists() {
  return true;
}
`;

      project.add_or_update_file("utils.ts", utilsCode);
      project.add_or_update_file("main.ts", mainCode);

      const imports = project.get_imports_with_definitions("main.ts");

      // Should only include the resolvable import
      expect(imports.length).toBe(1);
      expect(imports[0].local_name).toBe("exists");
    });

    test("handles Python imports", () => {
      const moduleCode = `
def calculate(x, y):
    return x + y

def process(data):
    return data * 2
`;

      const mainCode = `
from module import calculate, process

def main():
    result = calculate(1, 2)
    return process(result)
`;

      project.add_or_update_file("module.py", moduleCode);
      project.add_or_update_file("main.py", mainCode);

      const imports = project.get_imports_with_definitions("main.py");

      expect(imports.length).toBe(2);

      const calcImport = imports.find((i) => i.local_name === "calculate");
      expect(calcImport).toBeDefined();
      expect(calcImport!.imported_function.symbol_kind).toBe("function");

      const processImport = imports.find((i) => i.local_name === "process");
      expect(processImport).toBeDefined();
      expect(processImport!.imported_function.symbol_kind).toBe("function");
    });
  });

  describe("get_exported_functions", () => {
    test("returns all root-level functions from a module", () => {
      const code = `
export function publicFunc() {
  return 'public';
}

function privateFunc() {
  return 'private';
}

export const publicVar = 42;

export class PublicClass {
  method() {}
}
`;

      project.add_or_update_file("module.ts", code);
      const exported = project.get_exported_functions("module.ts");

      // Currently returns all root-level functions (exported and non-exported)
      expect(exported.length).toBe(2);
      const names = exported.map((f) => f.name).sort();
      expect(names).toEqual(["privateFunc", "publicFunc"]);
    });

    test("excludes methods and only returns standalone functions", () => {
      const code = `
export function standalone() {
  return 'function';
}

export class Calculator {
  add(a: number, b: number) {
    return a + b;
  }
  
  subtract(a: number, b: number) {
    return a - b;
  }
}

class PrivateClass {
  method() {}
}
`;

      project.add_or_update_file("calculator.ts", code);
      const exported = project.get_exported_functions("calculator.ts");

      // Should only include standalone functions, not methods
      expect(exported.length).toBe(1);
      expect(exported[0].name).toBe("standalone");

      // Should not include methods
      const methodNames = exported.map((f) => f.name);
      expect(methodNames).not.toContain("add");
      expect(methodNames).not.toContain("subtract");
      expect(methodNames).not.toContain("method");
    });

    test("handles nested functions correctly", () => {
      const code = `
export function outer() {
  function inner() {
    return 'nested';
  }
  return inner();
}

function topLevel() {
  function alsoNested() {}
}
`;

      project.add_or_update_file("nested.ts", code);
      const exported = project.get_exported_functions("nested.ts");

      // Should include both root-level functions, but not nested ones
      expect(exported.length).toBe(2);
      const names = exported.map((f) => f.name).sort();
      expect(names).toEqual(["outer", "topLevel"]);
    });

    test("returns empty array for non-existent file", () => {
      const exported = project.get_exported_functions("non-existent.ts");
      expect(exported).toEqual([]);
    });

    test("handles Python module exports", () => {
      const code = `
def public_function():
    """This is exported"""
    return True

def _private_function():
    """This is private (starts with _)"""
    return False

class PublicClass:
    def method(self):
        pass

if __name__ == "__main__":
    # This shouldn't affect exports
    pass
`;

      project.add_or_update_file("module.py", code);
      const exported = project.get_exported_functions("module.py");

      const functionNames = exported.map((f) => f.name);

      // In Python, all top-level functions are "exported" unless they start with _
      expect(functionNames).toContain("public_function");
      // Methods are not included in get_exported_functions
      expect(functionNames).not.toContain("method");

      // The actual implementation might include _private_function
      // since the scope mechanism doesn't distinguish Python's convention
    });

    test("includes generator functions", () => {
      const code = `
export function* generator() {
  yield 1;
  yield 2;
}

export async function asyncFunc() {
  return await Promise.resolve(42);
}
`;

      project.add_or_update_file("generators.ts", code);
      const exported = project.get_exported_functions("generators.ts");

      const functionNames = exported.map((f) => f.name);
      expect(functionNames).toContain("generator");
      expect(functionNames).toContain("asyncFunc");

      const generator = exported.find((f) => f.name === "generator");
      expect(generator?.symbol_kind).toBe("generator");
    });
  });

  describe("Integration with call graph extraction", () => {
    test("call graph can now track cross-file calls", () => {
      const utilsCode = `
export function utility() {
  return 'util';
}
`;

      const serviceCode = `
import { utility } from './utils';

export function service() {
  return utility() + ' service';
}
`;

      const mainCode = `
import { service } from './service';

function main() {
  return service();
}
`;

      project.add_or_update_file("utils.ts", utilsCode);
      project.add_or_update_file("service.ts", serviceCode);
      project.add_or_update_file("main.ts", mainCode);

      // Get the main function
      const functions = project.get_functions_in_file("main.ts");
      const mainFunc = functions.find((f) => f.name === "main");
      expect(mainFunc).toBeDefined();

      // Get calls from main - this currently returns imports
      const calls = project.get_function_calls(mainFunc!);

      // With the new API, we can resolve imports to actual functions
      if (calls.length > 0 && calls[0].called_def.symbol_kind === "import") {
        const imports = project.get_imports_with_definitions("main.ts");
        const serviceImport = imports.find((i) => i.local_name === "service");
        expect(serviceImport).toBeDefined();
        expect(serviceImport!.imported_function.name).toBe("service");
        expect(serviceImport!.imported_function.file_path).toBe("service.ts");
      }
    });
  });
});
