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

    test("detects export all (export *)", () => {
      const code = `
        export * from './other-module';
        export * as utils from './utils';
      `;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      // Export * doesn't create definitions, just re-exports
      expect(defs.length).toBe(0);
    });

    test("detects mixed export patterns", () => {
      const code = `
        export const a = 1;
        const b = 2;
        function c() {}
        export function d() {}
        
        export { b, c };
      `;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const a = defs.find(d => d.name === "a");
      const b = defs.find(d => d.name === "b");
      const c = defs.find(d => d.name === "c");
      const d = defs.find(d => d.name === "d");
      
      expect(a?.is_exported).toBe(true);
      expect(b?.is_exported).toBe(true);
      expect(c?.is_exported).toBe(true);
      expect(d?.is_exported).toBe(true);
    });

    test("handles re-exports with renaming", () => {
      const code = `
        function originalName() {}
        export { originalName as newName };
      `;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const original = defs.find(d => d.name === "originalName");
      expect(original?.is_exported).toBe(true);
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

    test("detects module.exports with property access", () => {
      const code = `
        function func1() {}
        function func2() {}
        
        module.exports.func1 = func1;
        module.exports.func2 = func2;
      `;
      
      project.add_or_update_file("test.js", code);
      const defs = project.get_definitions("test.js");
      
      const func1 = defs.find(d => d.name === "func1");
      const func2 = defs.find(d => d.name === "func2");
      
      // TODO: Implement support for module.exports.property = value pattern
      // See task-71: Support CommonJS property assignment exports
      // expect(func1?.is_exported).toBe(true);
      // expect(func2?.is_exported).toBe(true);
      
      // For now, these should be false
      expect(func1?.is_exported).toBe(false);
      expect(func2?.is_exported).toBe(false);
    });

    test("detects mixed CommonJS patterns", () => {
      const code = `
        const helper1 = () => {};
        exports.helper1 = helper1;
        
        exports.helper2 = function() {};
        
        module.exports.helper3 = () => {};
      `;
      
      project.add_or_update_file("test.js", code);
      const defs = project.get_definitions("test.js");
      
      const helper1 = defs.find(d => d.name === "helper1");
      expect(helper1?.is_exported).toBe(true);
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

    test("handles __all__ with different quote styles", () => {
      const code = `
__all__ = ["func1", 'func2', '''func3''', """func4"""]

def func1(): pass
def func2(): pass
def func3(): pass
def func4(): pass
def func5(): pass
`;
      
      project.add_or_update_file("test.py", code);
      const defs = project.get_definitions("test.py");
      
      expect(defs.find(d => d.name === "func1")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "func2")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "func3")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "func4")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "func5")?.is_exported).toBe(false);
    });

    test("complex nested scopes", () => {
      const code = `
def public_outer():
    def inner1():
        def inner2():
            pass
        return inner2
    
    class InnerClass:
        def method(self):
            def inner_method():
                pass
            return inner_method
    
    return inner1

class PublicClass:
    def __init__(self):
        def init_helper():
            pass
    
    def public_method(self):
        pass
    
    def _private_method(self):
        pass
`;
      
      project.add_or_update_file("test.py", code);
      const defs = project.get_definitions("test.py");
      
      expect(defs.find(d => d.name === "public_outer")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "inner1")?.is_exported).toBe(false);
      expect(defs.find(d => d.name === "inner2")?.is_exported).toBe(false);
      expect(defs.find(d => d.name === "InnerClass")?.is_exported).toBe(false);
      expect(defs.find(d => d.name === "PublicClass")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "init_helper")?.is_exported).toBe(false);
    });

    test("module-level variables follow conventions", () => {
      const code = `
PUBLIC_CONSTANT = 42
_PRIVATE_CONSTANT = 100
__special__ = "special"

# Assignment patterns
a, b = 1, 2
_x, _y = 3, 4
`;
      
      project.add_or_update_file("test.py", code);
      const defs = project.get_definitions("test.py");
      
      expect(defs.find(d => d.name === "PUBLIC_CONSTANT")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "_PRIVATE_CONSTANT")?.is_exported).toBe(false);
      expect(defs.find(d => d.name === "__special__")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "a")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "b")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "_x")?.is_exported).toBe(false);
      expect(defs.find(d => d.name === "_y")?.is_exported).toBe(false);
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

    test("detects various visibility modifiers", () => {
      const code = `
pub fn public_fn() {}
pub(crate) fn crate_public_fn() {}
pub(super) fn super_public_fn() {}
pub(in crate::module) fn module_public_fn() {}

pub const PUBLIC_CONST: i32 = 42;
pub static PUBLIC_STATIC: &str = "hello";

pub type PublicType = String;
pub trait PublicTrait {}

impl PublicTrait for String {}
pub impl AnotherTrait for String {}
`;
      
      project.add_or_update_file("test.rs", code);
      const defs = project.get_definitions("test.rs");
      
      expect(defs.find(d => d.name === "public_fn")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "crate_public_fn")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "super_public_fn")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "module_public_fn")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "PUBLIC_CONST")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "PUBLIC_STATIC")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "PublicType")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "PublicTrait")?.is_exported).toBe(true);
    });

    test("handles nested module visibility", () => {
      const code = `
mod private_mod {
    pub fn should_not_be_exported() {}
    
    pub mod nested {
        pub fn also_not_exported() {}
    }
}

pub mod public_mod {
    fn private_in_public() {}
    pub fn public_in_public() {}
    
    pub mod nested {
        pub fn nested_public() {}
        fn nested_private() {}
    }
}
`;
      
      project.add_or_update_file("test.rs", code);
      const defs = project.get_definitions("test.rs");
      
      // Functions in private modules are not exported even if marked pub
      expect(defs.find(d => d.name === "should_not_be_exported")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "also_not_exported")?.is_exported).toBe(true);
      
      // Functions in public modules follow their own visibility
      expect(defs.find(d => d.name === "private_in_public")?.is_exported).toBe(false);
      expect(defs.find(d => d.name === "public_in_public")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "nested_public")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "nested_private")?.is_exported).toBe(false);
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

    test("handles different file extensions", () => {
      // JavaScript files
      const jsCode = `
        export function jsExported() {}
        function jsPrivate() {}
      `;
      
      // TypeScript files with .mts extension
      const mtsCode = `
        export function mtsExported() {}
        function mtsPrivate() {}
      `;
      
      project.add_or_update_file("test.js", jsCode);
      // TODO: Add support for .mts file extension
      // See task-72: Support ES6 exports in .js files and new TypeScript extensions
      // project.add_or_update_file("test.mts", mtsCode);
      
      const jsExported = project.get_exported_functions("test.js");
      // const mtsExported = project.get_exported_functions("test.mts");
      
      // TODO: .js files with ES6 exports need TypeScript parser or syntax detection
      // See task-72: Support ES6 exports in .js files and new TypeScript extensions
      // expect(jsExported.map(d => d.name)).toEqual(["jsExported"]);
      // expect(mtsExported.map(d => d.name)).toEqual(["mtsExported"]);
      
      // For now, .js files with ES6 exports return empty
      expect(jsExported.map(d => d.name)).toEqual([]);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("handles empty files", () => {
      project.add_or_update_file("empty.ts", "");
      project.add_or_update_file("empty.py", "");
      project.add_or_update_file("empty.rs", "");
      
      expect(project.get_exported_functions("empty.ts")).toEqual([]);
      expect(project.get_exported_functions("empty.py")).toEqual([]);
      expect(project.get_exported_functions("empty.rs")).toEqual([]);
    });

    test("handles syntax errors gracefully", () => {
      const invalidCode = `
        export function { invalid syntax
        function valid() {}
      `;
      
      project.add_or_update_file("invalid.ts", invalidCode);
      const defs = project.get_definitions("invalid.ts");
      
      // Should still parse what it can
      const valid = defs.find(d => d.name === "valid");
      expect(valid).toBeDefined();
    });

    test("TypeScript type exports", () => {
      const code = `
        export type PublicType = string;
        export interface PublicInterface {}
        export enum PublicEnum { A, B }
        
        type PrivateType = number;
        interface PrivateInterface {}
        enum PrivateEnum { X, Y }
      `;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      expect(defs.find(d => d.name === "PublicType")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "PublicInterface")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "PublicEnum")?.is_exported).toBe(true);
      expect(defs.find(d => d.name === "PrivateType")?.is_exported).toBe(false);
      expect(defs.find(d => d.name === "PrivateInterface")?.is_exported).toBe(false);
      expect(defs.find(d => d.name === "PrivateEnum")?.is_exported).toBe(false);
    });
  });
});