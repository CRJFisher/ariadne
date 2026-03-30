/**
 * Tests for Rust import extraction
 *
 * Tests extract_imports_from_use_declaration and extract_import_from_extern_crate
 * against real tree-sitter ASTs to verify module_path correctly separates
 * module path from item name.
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import type { SyntaxNode } from "tree-sitter";
import { create_module_path, create_symbol_name } from "@ariadnejs/types";
import type { SymbolName } from "@ariadnejs/types";
import {
  extract_imports_from_use_declaration,
  extract_import_from_extern_crate,
  type ImportInfo,
} from "./imports.rust";

function parse_rust(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(Rust);
  const tree = parser.parse(code);
  return tree.rootNode;
}

function find_use_declaration(root: SyntaxNode): SyntaxNode | null {
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child && child.type === "use_declaration") return child;
  }
  return null;
}

function find_extern_crate(root: SyntaxNode): SyntaxNode | null {
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child && child.type === "extern_crate_declaration") return child;
  }
  return null;
}

describe("extract_imports_from_use_declaration", () => {
  it("simple use: use foo", () => {
    const root = parse_rust("use foo;");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "foo" as SymbolName,
        module_path: create_module_path("foo"),
      },
    ]);
  });

  it("scoped use: use std::fmt::Display — module_path excludes the item name", () => {
    const root = parse_rust("use std::fmt::Display;");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "Display" as SymbolName,
        module_path: create_module_path("std::fmt"),
      },
    ]);
  });

  it("scoped use with two segments: use utils::helper", () => {
    const root = parse_rust("use utils::helper;");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "helper" as SymbolName,
        module_path: create_module_path("utils"),
      },
    ]);
  });

  it("scoped use list: use utils::{helper, process_data} — module_path is the prefix", () => {
    const root = parse_rust("use utils::{helper, process_data};");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "helper" as SymbolName,
        module_path: create_module_path("utils"),
      },
      {
        name: "process_data" as SymbolName,
        module_path: create_module_path("utils"),
      },
    ]);
  });

  it("scoped use list with deeper path: use std::{cmp::Ordering}", () => {
    const root = parse_rust("use std::{cmp::Ordering};");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "Ordering" as SymbolName,
        module_path: create_module_path("std::cmp"),
      },
    ]);
  });

  it("nested scoped use list: use std::{collections::{HashMap, HashSet}}", () => {
    const root = parse_rust("use std::{collections::{HashMap, HashSet}};");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "HashMap" as SymbolName,
        module_path: create_module_path("std::collections"),
      },
      {
        name: "HashSet" as SymbolName,
        module_path: create_module_path("std::collections"),
      },
    ]);
  });

  it("scoped use list with alias: use utils::{helper as h}", () => {
    const root = parse_rust("use utils::{helper as h};");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "h" as SymbolName,
        module_path: create_module_path("utils"),
        original_name: create_symbol_name("helper"),
      },
    ]);
  });

  it("scoped use list with scoped alias: use std::{cmp::Ordering as Ord}", () => {
    const root = parse_rust("use std::{cmp::Ordering as Ord};");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "Ord" as SymbolName,
        module_path: create_module_path("std::cmp"),
        original_name: create_symbol_name("Ordering"),
      },
    ]);
  });

  it("top-level alias: use self::math::add as add_numbers", () => {
    const root = parse_rust("use self::math::add as add_numbers;");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "add_numbers" as SymbolName,
        module_path: create_module_path("self::math"),
        original_name: create_symbol_name("add"),
      },
    ]);
  });

  it("simple alias: use foo as bar", () => {
    const root = parse_rust("use foo as bar;");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "bar" as SymbolName,
        module_path: create_module_path("foo"),
        original_name: create_symbol_name("foo"),
      },
    ]);
  });

  it("wildcard: use std::fmt::*", () => {
    const root = parse_rust("use std::fmt::*;");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "*" as SymbolName,
        module_path: create_module_path("std::fmt"),
        is_wildcard: true,
      },
    ]);
  });

  it("crate-relative scoped list: use crate::models::{User, Post}", () => {
    const root = parse_rust("use crate::models::{User, Post};");
    const use_node = find_use_declaration(root)!;
    const result = extract_imports_from_use_declaration(use_node);

    expect(result).toEqual([
      {
        name: "User" as SymbolName,
        module_path: create_module_path("crate::models"),
      },
      {
        name: "Post" as SymbolName,
        module_path: create_module_path("crate::models"),
      },
    ]);
  });

  it("returns empty array for non-use_declaration nodes", () => {
    const root = parse_rust("fn main() {}");
    const result = extract_imports_from_use_declaration(root);

    expect(result).toEqual([]);
  });
});

describe("extract_import_from_extern_crate", () => {
  it("simple extern crate", () => {
    const root = parse_rust("extern crate serde;");
    const crate_node = find_extern_crate(root)!;
    const result = extract_import_from_extern_crate(crate_node);

    expect(result).toEqual({
      name: "serde" as SymbolName,
      module_path: create_module_path("serde"),
      original_name: undefined,
    });
  });

  it("extern crate with alias", () => {
    const root = parse_rust("extern crate serde as s;");
    const crate_node = find_extern_crate(root)!;
    const result = extract_import_from_extern_crate(crate_node);

    expect(result).toEqual({
      name: "s" as SymbolName,
      module_path: create_module_path("serde"),
      original_name: "serde" as SymbolName,
    });
  });

  it("returns undefined for non-extern_crate nodes", () => {
    const root = parse_rust("fn main() {}");
    const result = extract_import_from_extern_crate(root);

    expect(result).toBeUndefined();
  });
});
