import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import type { SyntaxNode } from "tree-sitter";
import { create_module_path, create_symbol_name } from "@ariadnejs/types";
import type { SymbolName } from "@ariadnejs/types";
import {
  extract_imports_from_use_declaration,
  extract_import_from_extern_crate,
} from "./imports.rust";

function parse_rust(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(Rust);
  const tree = parser.parse(code);
  return tree.rootNode;
}

function find_use_declaration(root: SyntaxNode): SyntaxNode {
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child && child.type === "use_declaration") return child;
  }
  throw new Error("no use_declaration found");
}

function find_extern_crate(root: SyntaxNode): SyntaxNode {
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child && child.type === "extern_crate_declaration") return child;
  }
  throw new Error("no extern_crate_declaration found");
}

function imports_of(code: string) {
  return extract_imports_from_use_declaration(find_use_declaration(parse_rust(code)));
}

describe("extract_imports_from_use_declaration", () => {
  it("keeps the bare name as both name and module_path for use foo", () => {
    expect(imports_of("use foo;")).toEqual([
      {
        name: "foo" as SymbolName,
        module_path: create_module_path("foo"),
      },
    ]);
  });

  it("drops the item name from module_path for use std::fmt::Display", () => {
    expect(imports_of("use std::fmt::Display;")).toEqual([
      {
        name: "Display" as SymbolName,
        module_path: create_module_path("std::fmt"),
      },
    ]);
  });

  it("splits a two-segment path into module and item for use utils::helper", () => {
    expect(imports_of("use utils::helper;")).toEqual([
      {
        name: "helper" as SymbolName,
        module_path: create_module_path("utils"),
      },
    ]);
  });

  it("keeps every segment but the item for a deep path use a::b::c::d", () => {
    expect(imports_of("use a::b::c::d;")).toEqual([
      {
        name: "d" as SymbolName,
        module_path: create_module_path("a::b::c"),
      },
    ]);
  });

  it("keeps the crate prefix in module_path for use crate::models::User", () => {
    expect(imports_of("use crate::models::User;")).toEqual([
      {
        name: "User" as SymbolName,
        module_path: create_module_path("crate::models"),
      },
    ]);
  });

  it("keeps the super prefix in module_path for use super::foo", () => {
    expect(imports_of("use super::foo;")).toEqual([
      {
        name: "foo" as SymbolName,
        module_path: create_module_path("super"),
      },
    ]);
  });

  it("keeps the self prefix in module_path for use self::bar", () => {
    expect(imports_of("use self::bar;")).toEqual([
      {
        name: "bar" as SymbolName,
        module_path: create_module_path("self"),
      },
    ]);
  });

  it("gives each group member the shared prefix as module_path", () => {
    expect(imports_of("use utils::{helper, process_data};")).toEqual([
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

  it("emits the group module itself for a self member alongside an item", () => {
    expect(imports_of("use std::io::{self, Write};")).toEqual([
      {
        name: "io" as SymbolName,
        module_path: create_module_path("std"),
      },
      {
        name: "Write" as SymbolName,
        module_path: create_module_path("std::io"),
      },
    ]);
  });

  it("emits both the module and the item for use a::b::{self, C}", () => {
    expect(imports_of("use a::b::{self, C};")).toEqual([
      {
        name: "b" as SymbolName,
        module_path: create_module_path("a"),
      },
      {
        name: "C" as SymbolName,
        module_path: create_module_path("a::b"),
      },
    ]);
  });

  it("treats a single-segment self group like a bare module import", () => {
    expect(imports_of("use foo::{self};")).toEqual([
      {
        name: "foo" as SymbolName,
        module_path: create_module_path("foo"),
      },
    ]);
  });

  it("keeps the crate prefix in module_path for a self group member", () => {
    expect(imports_of("use crate::utils::{self, helper};")).toEqual([
      {
        name: "utils" as SymbolName,
        module_path: create_module_path("crate"),
      },
      {
        name: "helper" as SymbolName,
        module_path: create_module_path("crate::utils"),
      },
    ]);
  });

  it("resolves self inside a nested group against the accumulated prefix", () => {
    expect(imports_of("use a::{b::{self, C}};")).toEqual([
      {
        name: "b" as SymbolName,
        module_path: create_module_path("a"),
      },
      {
        name: "C" as SymbolName,
        module_path: create_module_path("a::b"),
      },
    ]);
  });

  it("binds the group module under the alias for use a::b::{self as c}", () => {
    expect(imports_of("use a::b::{self as c};")).toEqual([
      {
        name: "c" as SymbolName,
        module_path: create_module_path("a"),
        original_name: create_symbol_name("b"),
      },
    ]);
  });

  it("extends the prefix with a group member's own path", () => {
    expect(imports_of("use std::{cmp::Ordering};")).toEqual([
      {
        name: "Ordering" as SymbolName,
        module_path: create_module_path("std::cmp"),
      },
    ]);
  });

  it("flattens a nested group into one import per leaf", () => {
    expect(imports_of("use std::{collections::{HashMap, HashSet}};")).toEqual([
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

  it("flattens a two-level nested group use a::{b::{c}}", () => {
    expect(imports_of("use a::{b::{c}};")).toEqual([
      {
        name: "c" as SymbolName,
        module_path: create_module_path("a::b"),
      },
    ]);
  });

  it("resolves mixed group members with differing depths", () => {
    expect(imports_of("use a::b::{c::d, e::{f, g}};")).toEqual([
      {
        name: "d" as SymbolName,
        module_path: create_module_path("a::b::c"),
      },
      {
        name: "f" as SymbolName,
        module_path: create_module_path("a::b::e"),
      },
      {
        name: "g" as SymbolName,
        module_path: create_module_path("a::b::e"),
      },
    ]);
  });

  it("returns no imports for an empty group use utils::{}", () => {
    expect(imports_of("use utils::{};")).toEqual([]);
  });

  it("records the original name for an aliased group member use utils::{helper as h}", () => {
    expect(imports_of("use utils::{helper as h};")).toEqual([
      {
        name: "h" as SymbolName,
        module_path: create_module_path("utils"),
        original_name: create_symbol_name("helper"),
      },
    ]);
  });

  it("records the original name for a scoped aliased group member use std::{cmp::Ordering as Ord}", () => {
    expect(imports_of("use std::{cmp::Ordering as Ord};")).toEqual([
      {
        name: "Ord" as SymbolName,
        module_path: create_module_path("std::cmp"),
        original_name: create_symbol_name("Ordering"),
      },
    ]);
  });

  it("names each member by the group prefix for a bare group use {foo, bar}", () => {
    expect(imports_of("use {foo, bar};")).toEqual([
      {
        name: "foo" as SymbolName,
        module_path: create_module_path("foo"),
      },
      {
        name: "bar" as SymbolName,
        module_path: create_module_path("bar"),
      },
    ]);
  });

  it("uses the alias as name and the scoped path as module_path for use self::math::add as add_numbers", () => {
    expect(imports_of("use self::math::add as add_numbers;")).toEqual([
      {
        name: "add_numbers" as SymbolName,
        module_path: create_module_path("self::math"),
        original_name: create_symbol_name("add"),
      },
    ]);
  });

  it("uses the alias as name and the original as module_path for use foo as bar", () => {
    expect(imports_of("use foo as bar;")).toEqual([
      {
        name: "bar" as SymbolName,
        module_path: create_module_path("foo"),
        original_name: create_symbol_name("foo"),
      },
    ]);
  });

  it("marks a glob import with name * and is_wildcard for use std::fmt::*", () => {
    expect(imports_of("use std::fmt::*;")).toEqual([
      {
        name: "*" as SymbolName,
        module_path: create_module_path("std::fmt"),
        is_wildcard: true,
      },
    ]);
  });

  it("marks a single-segment glob for use foo::*", () => {
    expect(imports_of("use foo::*;")).toEqual([
      {
        name: "*" as SymbolName,
        module_path: create_module_path("foo"),
        is_wildcard: true,
      },
    ]);
  });

  it("marks a crate-prefixed glob for use crate::*", () => {
    expect(imports_of("use crate::*;")).toEqual([
      {
        name: "*" as SymbolName,
        module_path: create_module_path("crate"),
        is_wildcard: true,
      },
    ]);
  });

  it("marks a super-prefixed glob for use super::*", () => {
    expect(imports_of("use super::*;")).toEqual([
      {
        name: "*" as SymbolName,
        module_path: create_module_path("super"),
        is_wildcard: true,
      },
    ]);
  });

  it("marks a self-prefixed glob for use self::*", () => {
    expect(imports_of("use self::*;")).toEqual([
      {
        name: "*" as SymbolName,
        module_path: create_module_path("self"),
        is_wildcard: true,
      },
    ]);
  });

  it("ignores the pub visibility modifier on a scoped re-export pub use foo::bar", () => {
    expect(imports_of("pub use foo::bar;")).toEqual([
      {
        name: "bar" as SymbolName,
        module_path: create_module_path("foo"),
      },
    ]);
  });

  it("ignores the pub visibility modifier on a group re-export pub use crate::models::{User, Post}", () => {
    expect(imports_of("pub use crate::models::{User, Post};")).toEqual([
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

  it("returns an empty array for a non-use_declaration node", () => {
    const root = parse_rust("fn main() {}");
    expect(extract_imports_from_use_declaration(root)).toEqual([]);
  });
});

describe("extract_import_from_extern_crate", () => {
  it("maps a crate name to name and module_path with no original_name", () => {
    const result = extract_import_from_extern_crate(
      find_extern_crate(parse_rust("extern crate serde;"))
    );

    expect(result).toEqual({
      name: "serde" as SymbolName,
      module_path: create_module_path("serde"),
      original_name: undefined,
    });
  });

  it("uses the alias as name and records the crate as original_name", () => {
    const result = extract_import_from_extern_crate(
      find_extern_crate(parse_rust("extern crate serde as s;"))
    );

    expect(result).toEqual({
      name: "s" as SymbolName,
      module_path: create_module_path("serde"),
      original_name: "serde" as SymbolName,
    });
  });

  it("returns undefined for a non-extern_crate node", () => {
    const root = parse_rust("fn main() {}");
    expect(extract_import_from_extern_crate(root)).toBeUndefined();
  });
});
