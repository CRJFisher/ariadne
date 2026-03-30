/**
 * Type declaration overrides for tree-sitter grammar packages.
 *
 * The grammar packages ship with inaccurate type declarations that don't
 * match tree-sitter@0.25.0's Language interface. These declarations fix
 * the mismatches so the grammar objects are assignable to Parser.setLanguage().
 */

/// <reference types="tree-sitter" />

declare module "tree-sitter-javascript" {
  import Parser = require("tree-sitter");
  const language: Parser.Language;
  export = language;
}

declare module "tree-sitter-python" {
  import Parser = require("tree-sitter");
  const language: Parser.Language;
  export = language;
}

declare module "tree-sitter-rust" {
  import Parser = require("tree-sitter");
  const language: Parser.Language;
  export = language;
}

declare module "tree-sitter-typescript" {
  import Parser = require("tree-sitter");
  const exports: {
    typescript: Parser.Language;
    tsx: Parser.Language;
  };
  export = exports;
}
