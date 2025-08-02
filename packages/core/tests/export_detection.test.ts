import { describe, test, expect, beforeEach } from "vitest";
import { Project } from "../src/index";

describe("Export Detection", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  describe("TypeScript/JavaScript ES6 Exports", () => {
    test("detects direct exports", () => {
      const code = `
        export function publicFunc() {}
        export const publicConst = 1;
        export class PublicClass {}
        export interface PublicInterface {}
        
        function privateFunc() {}
        const privateConst = 2;
        class PrivateClass {}
      `;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const publicFunc = defs.find(d => d.name === "publicFunc");
      const publicConst = defs.find(d => d.name === "publicConst");
      const publicClass = defs.find(d => d.name === "PublicClass");
      const privateFunc = defs.find(d => d.name === "privateFunc");
      const privateConst = defs.find(d => d.name === "privateConst");
      const privateClass = defs.find(d => d.name === "PrivateClass");
      
      expect(publicFunc?.is_exported).toBe(true);
      expect(publicConst?.is_exported).toBe(true);
      expect(publicClass?.is_exported).toBe(true);
      expect(privateFunc?.is_exported).toBe(false);
      expect(privateConst?.is_exported).toBe(false);
      expect(privateClass?.is_exported).toBe(false);
    });

    test("detects export list", () => {
      const code = `
        function func1() {}
        function func2() {}
        const const1 = 1;
        
        export { func1, func2 as renamedFunc };
      `;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const func1 = defs.find(d => d.name === "func1");
      const func2 = defs.find(d => d.name === "func2");
      const const1 = defs.find(d => d.name === "const1");
      
      expect(func1?.is_exported).toBe(true);
      expect(func2?.is_exported).toBe(true);
      expect(const1?.is_exported).toBe(false);
    });

    test("detects default exports", () => {
      const code = `
        export default function defaultFunc() {}
        export default class DefaultClass {}
      `;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const defaultFunc = defs.find(d => d.name === "defaultFunc");
      const defaultClass = defs.find(d => d.name === "DefaultClass");
      
      expect(defaultFunc?.is_exported).toBe(true);
      expect(defaultClass?.is_exported).toBe(true);
    });
  });

  describe("JavaScript CommonJS Exports", () => {
    test("detects module.exports object", () => {
      const code = `
        function func1() {}
        function func2() {}
        function internal() {}
        
        module.exports = {
          func1,
          func2
        };
      `;
      
      project.add_or_update_file("test.js", code);
      const defs = project.get_definitions("test.js");
      
      const func1 = defs.find(d => d.name === "func1");
      const func2 = defs.find(d => d.name === "func2");
      const internal = defs.find(d => d.name === "internal");
      
      expect(func1?.is_exported).toBe(true);
      expect(func2?.is_exported).toBe(true);
      expect(internal?.is_exported).toBe(false);
    });

    test("detects exports.name assignments", () => {
      const code = `
        function helper() {}
        exports.helper = helper;
        
        function internal() {}
      `;
      
      project.add_or_update_file("test.js", code);
      const defs = project.get_definitions("test.js");
      
      const helper = defs.find(d => d.name === "helper");
      const internal = defs.find(d => d.name === "internal");
      
      expect(helper?.is_exported).toBe(true);
      expect(internal?.is_exported).toBe(false);
    });
  });

  describe("Python Export Conventions", () => {
    test("detects __all__ exports", () => {
      const code = `
__all__ = ['public_func', 'PublicClass']

def public_func():
    pass

def unlisted_func():
    pass

class PublicClass:
    pass

class UnlistedClass:
    pass
`;
      
      project.add_or_update_file("test.py", code);
      const defs = project.get_definitions("test.py");
      
      const publicFunc = defs.find(d => d.name === "public_func");
      const unlistedFunc = defs.find(d => d.name === "unlisted_func");
      const publicClass = defs.find(d => d.name === "PublicClass");
      const unlistedClass = defs.find(d => d.name === "UnlistedClass");
      
      expect(publicFunc?.is_exported).toBe(true);
      expect(unlistedFunc?.is_exported).toBe(false);
      expect(publicClass?.is_exported).toBe(true);
      expect(unlistedClass?.is_exported).toBe(false);
    });

    test("follows underscore convention without __all__", () => {
      const code = `
def public_func():
    pass

def _private_func():
    pass

def __special_func__():
    pass

class PublicClass:
    pass

class _PrivateClass:
    pass
`;
      
      project.add_or_update_file("test.py", code);
      const defs = project.get_definitions("test.py");
      
      const publicFunc = defs.find(d => d.name === "public_func");
      const privateFunc = defs.find(d => d.name === "_private_func");
      const specialFunc = defs.find(d => d.name === "__special_func__");
      const publicClass = defs.find(d => d.name === "PublicClass");
      const privateClass = defs.find(d => d.name === "_PrivateClass");
      
      expect(publicFunc?.is_exported).toBe(true);
      expect(privateFunc?.is_exported).toBe(false);
      expect(specialFunc?.is_exported).toBe(true);
      expect(publicClass?.is_exported).toBe(true);
      expect(privateClass?.is_exported).toBe(false);
    });

    test("nested definitions are not exported", () => {
      const code = `
def outer_func():
    def inner_func():
        pass
    
    class InnerClass:
        pass

class OuterClass:
    def method(self):
        pass
`;
      
      project.add_or_update_file("test.py", code);
      const defs = project.get_definitions("test.py");
      
      const outerFunc = defs.find(d => d.name === "outer_func");
      const innerFunc = defs.find(d => d.name === "inner_func");
      const innerClass = defs.find(d => d.name === "InnerClass");
      const outerClass = defs.find(d => d.name === "OuterClass");
      
      expect(outerFunc?.is_exported).toBe(true);
      expect(innerFunc?.is_exported).toBe(false);
      expect(innerClass?.is_exported).toBe(false);
      expect(outerClass?.is_exported).toBe(true);
    });
  });

  describe("Rust pub Keyword", () => {
    test("detects pub functions and structs", () => {
      const code = `
pub fn public_function() {}
fn private_function() {}

pub struct PublicStruct {
    field: i32
}

struct PrivateStruct {
    field: i32
}

pub enum PublicEnum {
    Variant
}

enum PrivateEnum {
    Variant
}
`;
      
      project.add_or_update_file("test.rs", code);
      const defs = project.get_definitions("test.rs");
      
      const publicFn = defs.find(d => d.name === "public_function");
      const privateFn = defs.find(d => d.name === "private_function");
      const publicStruct = defs.find(d => d.name === "PublicStruct");
      const privateStruct = defs.find(d => d.name === "PrivateStruct");
      const publicEnum = defs.find(d => d.name === "PublicEnum");
      const privateEnum = defs.find(d => d.name === "PrivateEnum");
      
      expect(publicFn?.is_exported).toBe(true);
      expect(privateFn?.is_exported).toBe(false);
      expect(publicStruct?.is_exported).toBe(true);
      expect(privateStruct?.is_exported).toBe(false);
      expect(publicEnum?.is_exported).toBe(true);
      expect(privateEnum?.is_exported).toBe(false);
    });

    test("detects pub in modules", () => {
      const code = `
pub mod public_module {
    pub fn nested_public() {}
    fn nested_private() {}
}

mod private_module {
    pub fn nested_public() {}
}
`;
      
      project.add_or_update_file("test.rs", code);
      const defs = project.get_definitions("test.rs");
      
      const nestedPublic = defs.find(d => d.name === "nested_public");
      const nestedPrivate = defs.find(d => d.name === "nested_private");
      
      // Note: In Rust, items need pub to be exported from their module
      expect(nestedPublic?.is_exported).toBe(true);
      expect(nestedPrivate?.is_exported).toBe(false);
    });
  });

  describe("get_exported_functions API", () => {
    test("returns only exported functions", () => {
      const tsCode = `
        export function exported1() {}
        export function exported2() {}
        function internal() {}
      `;
      
      const pyCode = `
def public_func():
    pass

def _private_func():
    pass
`;
      
      project.add_or_update_file("test.ts", tsCode);
      project.add_or_update_file("test.py", pyCode);
      
      const tsExported = project.get_exported_functions("test.ts");
      const pyExported = project.get_exported_functions("test.py");
      
      expect(tsExported.map(d => d.name)).toEqual(["exported1", "exported2"]);
      expect(pyExported.map(d => d.name)).toEqual(["public_func"]);
    });
  });
});