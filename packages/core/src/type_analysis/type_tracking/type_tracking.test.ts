import { describe, it, expect } from "vitest";
import { get_language_parser } from "../../scope_queries/loader";
import { Language, SourceCode, FilePath } from "@ariadnejs/types";
import {
  create_file_type_tracker,
  set_variable_type,
  set_imported_class,
  get_imported_class,
  mark_as_exported,
  is_exported,
  infer_type_kind,
  process_file_for_types,
} from "./index";
import { TypeTrackingContext } from "./type_tracking";
import { get_variable_type } from "./test_utils";

describe("type_tracking", () => {
  describe("Core type tracking", () => {
    it("should create and manage file type tracker", () => {
      const tracker = create_file_type_tracker();
      expect(tracker.variable_types.size).toBe(0);
      expect(tracker.imported_classes.size).toBe(0);
      expect(tracker.exported_definitions.size).toBe(0);
    });

    it("should track variable types", () => {
      let tracker = create_file_type_tracker();

      tracker = set_variable_type(tracker, "myVar", {
        type_name: "string",
        type_kind: "primitive",
        location: {
          file_path: "test.js" as FilePath,
          line: 10,
          column: 5,
          end_line: 10,
          end_column: 5,
        },
        confidence: "explicit",
        source: "annotation",
      });

      const type_info = get_variable_type(tracker, "myVar", {
        file_path: "test.js" as FilePath,
        line: 11,
        column: 0,
        end_line: 11,
        end_column: 0,
      });
      expect(type_info).toBeDefined();
      expect(type_info?.type_name).toBe("string");
      expect(type_info?.type_kind).toBe("primitive");
    });

    it("should track multiple type assignments at different positions", () => {
      let tracker = create_file_type_tracker();

      // First assignment
      tracker = set_variable_type(tracker, "x", {
        type_name: "number",
        type_kind: "primitive",
        location: {
          file_path: "test.js" as FilePath,
          line: 5,
          column: 0,
          end_line: 5,
          end_column: 0,
        },
        confidence: "explicit",
        source: "assignment",
      });

      // Second assignment
      tracker = set_variable_type(tracker, "x", {
        type_name: "string",
        type_kind: "primitive",
        location: {
          file_path: "test.js" as FilePath,
          line: 10,
          column: 0,
          end_line: 10,
          end_column: 0,
        },
        confidence: "explicit",
        source: "assignment",
      });

      // Get type at different positions
      const type_at_7 = get_variable_type(tracker, "x", {
        file_path: "test.js" as FilePath,
        line: 7,
        column: 0,
        end_line: 7,
        end_column: 0,
      });
      expect(type_at_7?.type_name).toBe("number");

      const type_at_12 = get_variable_type(tracker, "x", {
        file_path: "test.js" as FilePath,
        line: 12,
        column: 0,
        end_line: 12,
        end_column: 0,
      });
      expect(type_at_12?.type_name).toBe("string");
    });

    it("should track imported classes", () => {
      let tracker = create_file_type_tracker();

      tracker = set_imported_class(tracker, "MyClass", {
        class_name: "MyClass",
        source_module: "./my-module",
        local_name: "MyClass",
        is_default: false,
      });

      const import_info = get_imported_class(tracker, "MyClass");
      expect(import_info).toBeDefined();
      expect(import_info?.source_module).toBe("./my-module");
    });

    it("should track exported definitions", () => {
      let tracker = create_file_type_tracker();

      tracker = mark_as_exported(tracker, "myFunction");
      tracker = mark_as_exported(tracker, "MyClass");

      expect(is_exported(tracker, "myFunction")).toBe(true);
      expect(is_exported(tracker, "MyClass")).toBe(true);
      expect(is_exported(tracker, "notExported")).toBe(false);
    });
  });

  describe("JavaScript type tracking", () => {
    it("should track JavaScript variable assignments", () => {
      const code = `
        const str = "hello";
        const num = 42;
        const bool = true;
        const arr = [];
        const obj = {};
        const func = () => {};
      ` as SourceCode;

      const parser = get_language_parser("javascript" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "javascript",
        file_path: "test.js" as FilePath,
        source_code: code,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      expect(get_variable_type(tracker, "str")?.type_name).toBe("string");
      expect(get_variable_type(tracker, "num")?.type_name).toBe("number");
      expect(get_variable_type(tracker, "bool")?.type_name).toBe("boolean");
      expect(get_variable_type(tracker, "arr")?.type_kind).toBe("array");
      expect(get_variable_type(tracker, "obj")?.type_kind).toBe("object");
      expect(get_variable_type(tracker, "func")?.type_kind).toBe("function");
    });

    it("should track constructor calls", () => {
      const code = `
        const date = new Date();
        const map = new Map();
        const custom = new MyClass();
      `;

      const parser = get_language_parser("javascript" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "javascript",
        file_path: "test.js" as FilePath,
        source_code: code as SourceCode,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      expect(get_variable_type(tracker, "date")?.type_name).toBe("Date");
      expect(get_variable_type(tracker, "map")?.type_name).toBe("Map");
      expect(get_variable_type(tracker, "custom")?.type_name).toBe("MyClass");
    });

    it("should track ES6 imports", () => {
      const code = `
        import React from 'react';
        import { Component, useState } from 'react';
        import * as utils from './utils';
      `;

      const parser = get_language_parser("javascript" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "javascript",
        file_path: "test.js" as FilePath,
        source_code: code as SourceCode,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      expect(get_imported_class(tracker, "React")?.source_module).toBe("react");
      expect(get_imported_class(tracker, "Component")?.source_module).toBe(
        "react"
      );
      expect(get_imported_class(tracker, "useState")?.source_module).toBe(
        "react"
      );
    });

    it("should track CommonJS requires", () => {
      const code = `
        const fs = require('fs');
        const { readFile } = require('fs/promises');
      `;

      const parser = get_language_parser("javascript" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "javascript",
        file_path: "test.js" as FilePath,
        source_code: code as SourceCode,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      expect(get_imported_class(tracker, "fs")?.source_module).toBe("fs");
    });
  });

  describe("TypeScript type tracking", () => {
    it("should track TypeScript type annotations", () => {
      const code = `
        const str: string = "hello";
        const num: number = 42;
        const arr: string[] = [];
        const tuple: [number, string] = [1, "a"];
        const union: string | number = "test";
        const generic: Array<string> = [];
      `;

      const parser = get_language_parser("typescript" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "typescript",
        file_path: "test.ts" as FilePath,
        source_code: code as SourceCode,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      expect(get_variable_type(tracker, "str")?.type_name).toBe("string");
      expect(get_variable_type(tracker, "num")?.type_name).toBe("number");
      expect(get_variable_type(tracker, "arr")?.type_name).toBe("string[]");
      expect(get_variable_type(tracker, "tuple")?.type_name).toBe(
        "(number, string)"
      );
      expect(get_variable_type(tracker, "union")?.type_name).toBe(
        "string | number"
      );
      expect(get_variable_type(tracker, "generic")?.type_name).toBe(
        "Array<string>"
      );
    });

    it("should track type-only imports", () => {
      const code = `
        import type { MyType } from './types';
        import { type AnotherType, someValue } from './module';
      `;

      const parser = get_language_parser("typescript" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "typescript",
        file_path: "test.ts" as FilePath,
        source_code: code as SourceCode,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      const my_type = get_imported_class(tracker, "MyType");
      expect(my_type?.is_type_only).toBe(true);
    });
  });

  describe("Python type tracking", () => {
    it("should track Python type hints", () => {
      const code = `
str_var: str = "hello"
num_var: int = 42
list_var: List[str] = []
dict_var: Dict[str, int] = {}
optional_var: Optional[str] = None
union_var: Union[str, int] = "test"
      `;

      const parser = get_language_parser("python" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "python",
        file_path: "test.py" as FilePath,
        source_code: code as SourceCode,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      expect(get_variable_type(tracker, "str_var")?.type_name).toBe("str");
      expect(get_variable_type(tracker, "num_var")?.type_name).toBe("int");
      expect(get_variable_type(tracker, "list_var")?.type_name).toBe(
        "List[str]"
      );
      expect(get_variable_type(tracker, "dict_var")?.type_name).toBe(
        "Dict[str, int]"
      );
      expect(get_variable_type(tracker, "optional_var")?.type_name).toBe(
        "Optional[str]"
      );
      expect(get_variable_type(tracker, "union_var")?.type_name).toBe(
        "Union[str, int]"
      );
    });

    it("should track Python imports", () => {
      const code = `
import os
from typing import List, Dict, Optional
from mymodule import MyClass
from package.module import SomeClass as Alias
      `;

      const parser = get_language_parser("python" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "python",
        file_path: "test.py" as FilePath,
        source_code: code as SourceCode,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      expect(get_imported_class(tracker, "os")?.source_module).toBe("os");
      expect(get_imported_class(tracker, "List")?.source_module).toBe("typing");
      expect(get_imported_class(tracker, "MyClass")?.source_module).toBe(
        "mymodule"
      );
      expect(get_imported_class(tracker, "Alias")?.class_name).toBe(
        "SomeClass"
      );
    });

    it("should infer Python types from literals", () => {
      const code = `
str_var = "hello"
num_var = 42
float_var = 3.14
bool_var = True
list_var = [1, 2, 3]
dict_var = {"key": "value"}
set_var = {1, 2, 3}
none_var = None
      `;

      const parser = get_language_parser("python" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "python",
        file_path: "test.py" as FilePath,
        source_code: code as SourceCode,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      expect(get_variable_type(tracker, "str_var")?.type_name).toBe("str");
      expect(get_variable_type(tracker, "num_var")?.type_name).toBe("int");
      expect(get_variable_type(tracker, "float_var")?.type_name).toBe("float");
      expect(get_variable_type(tracker, "bool_var")?.type_name).toBe("bool");
      expect(get_variable_type(tracker, "list_var")?.type_kind).toBe("array");
      expect(get_variable_type(tracker, "dict_var")?.type_name).toBe("dict");
      expect(get_variable_type(tracker, "set_var")?.type_name).toBe("set");
      expect(get_variable_type(tracker, "none_var")?.type_name).toBe("None");
    });
  });

  describe("Rust type tracking", () => {
    it("should track Rust type annotations", () => {
      const code = `
let str_var: &str = "hello";
let num_var: i32 = 42;
let vec_var: Vec<String> = Vec::new();
let option_var: Option<i32> = None;
let result_var: Result<String, Error> = Ok("success".to_string());
let array_var: [i32; 5] = [1, 2, 3, 4, 5];
let tuple_var: (i32, String) = (42, "test".to_string());
      `;

      const parser = get_language_parser("rust" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "rust",
        file_path: "test.rs" as FilePath,
        source_code: code as SourceCode,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      expect(get_variable_type(tracker, "str_var")?.type_name).toBe("&str");
      expect(get_variable_type(tracker, "num_var")?.type_name).toBe("i32");
      expect(get_variable_type(tracker, "vec_var")?.type_name).toBe(
        "Vec<String>"
      );
      expect(get_variable_type(tracker, "option_var")?.type_name).toBe(
        "Option<i32>"
      );
      expect(get_variable_type(tracker, "result_var")?.type_name).toBe(
        "Result<String, Error>"
      );
      expect(get_variable_type(tracker, "array_var")?.type_name).toBe(
        "[i32; 5]"
      );
      expect(get_variable_type(tracker, "tuple_var")?.type_name).toBe(
        "(i32, String)"
      );
    });

    it("should track Rust use statements", () => {
      const code = `
use std::collections::HashMap;
use std::io::{Read, Write};
use super::module::MyStruct;
use crate::utils::helper as h;
      `;

      const parser = get_language_parser("rust" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "rust",
        file_path: "test.rs" as FilePath,
        source_code: code as SourceCode,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      expect(get_imported_class(tracker, "HashMap")?.source_module).toBe(
        "std::collections::HashMap"
      );
      expect(get_imported_class(tracker, "Read")?.source_module).toBe(
        "std::io::Read"
      );
      expect(get_imported_class(tracker, "Write")?.source_module).toBe(
        "std::io::Write"
      );
      expect(get_imported_class(tracker, "MyStruct")?.source_module).toBe(
        "super::module::MyStruct"
      );
      expect(get_imported_class(tracker, "h")?.class_name).toBe("helper");
    });

    it("should infer Rust types from literals", () => {
      const code = `
let str_lit = "hello";
let int_lit = 42;
let int_typed = 42i64;
let float_lit = 3.14;
let float_typed = 2.71f32;
let bool_lit = true;
let array_lit = [1, 2, 3];
let tuple_lit = (1, "test");
      `;

      const parser = get_language_parser("rust" as Language);
      const tree = parser.parse(code);
      const context: TypeTrackingContext = {
        language: "rust",
        file_path: "test.rs" as FilePath,
        source_code: code as SourceCode,
      };

      const tracker = process_file_for_types(tree.rootNode, context);

      expect(get_variable_type(tracker, "str_lit")?.type_name).toBe("&str");
      expect(get_variable_type(tracker, "int_lit")?.type_name).toBe("i32");
      expect(get_variable_type(tracker, "int_typed")?.type_name).toBe("i64");
      expect(get_variable_type(tracker, "float_lit")?.type_name).toBe("f64");
      expect(get_variable_type(tracker, "float_typed")?.type_name).toBe("f32");
      expect(get_variable_type(tracker, "bool_lit")?.type_name).toBe("bool");
      expect(get_variable_type(tracker, "array_lit")?.type_kind).toBe("array");
      expect(get_variable_type(tracker, "tuple_lit")?.type_name).toBe("tuple");
    });
  });

  describe("Type utilities", () => {
    it("should infer type kind correctly", () => {
      expect(infer_type_kind("string", "javascript")).toBe("primitive");
      expect(infer_type_kind("Array<string>", "typescript")).toBe("array");
      expect(infer_type_kind("MyClass", "javascript")).toBe("class");
      expect(infer_type_kind("() => void", "typescript")).toBe("function");
      expect(infer_type_kind("{ x: number }", "typescript")).toBe("object");
      expect(infer_type_kind("IMyInterface", "typescript")).toBe("interface");
    });

  });
});
