import type { Language } from "@ariadnejs/types";
import type TreeSitter from "tree-sitter";
import { JavaScript, Parser, Python, Rust, TypeScript } from "../../native";

type Grammar = TreeSitter.Language;

/**
 * One of the JavaScript classes tree-sitter mints per node type id, and
 * instantiates for every node of that type it hands back.
 */
interface NodeClass {
  new (...args: never[]): object;
  readonly prototype: object;
}

// The default grammar per language. TypeScript maps to the `.typescript`
// grammar; a `.tsx` file overrides this to the `.tsx` grammar (see grammar_for).
export const LANGUAGE_TO_TREESITTER_LANG = new Map<Language, Grammar>([
  ["javascript", JavaScript],
  ["typescript", TypeScript.typescript],
  ["python", Python],
  ["rust", Rust],
]);

export const SUPPORTED_LANGUAGES: readonly Language[] = [
  "javascript",
  "typescript",
  "python",
  "rust",
] as const;

// A `.tsx` file is parsed with the tsx grammar, which yields the
// `jsx_opening_element` / `jsx_self_closing_element` nodes a component usage
// captures against. A `.ts` file keeps the typescript grammar so an
// angle-bracket type assertion (`<T>x`) still parses as a cast rather than a JSX
// element. Both are language "typescript"; only the grammar and the JSX half of
// the query differ, so the distinction stays inside the parse/query layer and
// never reaches the by-language dispatchers downstream.
export function is_tsx_file(language: Language, file_path: string): boolean {
  return language === "typescript" && file_path.endsWith(".tsx");
}

// Grammar for a compiled query, selected by the same tsx dialect the parser
// uses so a query always compiles against the grammar its tree was parsed with.
export function grammar_for_dialect(language: Language, tsx: boolean): Grammar {
  if (language === "typescript" && tsx) {
    return TypeScript.tsx;
  }
  const grammar = LANGUAGE_TO_TREESITTER_LANG.get(language);
  if (!grammar) {
    throw new Error(`No tree-sitter grammar for language: ${language}`);
  }
  return grammar;
}

// Grammar for parsing a file, dispatching `.tsx` to the tsx grammar.
export function grammar_for(language: Language, file_path: string): Grammar {
  return grammar_for_dialect(language, is_tsx_file(language, file_path));
}

/** A parser bound to the grammar a file parses with. */
export function parser_for(language: Language, file_path: string): TreeSitter {
  const parser = new Parser();
  const grammar = grammar_for(language, file_path);
  parser.setLanguage(grammar);
  pin_node_type_names(grammar);
  return parser;
}

const BASE_NODE_CLASS: NodeClass = read_base_node_class();
const READ_TYPE_FROM_BINDING: (this: object) => string = read_type_accessor();
const GRAMMARS_WITH_PINNED_TYPE_NAMES = new WeakSet<Grammar>();

/**
 * Hold each node type's name on the class the binding already picked for that
 * type, so reading a node's type stops crossing into the binding.
 *
 * A node's type name is a function of its type id and nothing else, and the
 * binding derives the node's JavaScript class from that same id — so the name
 * can be read once per id per process instead of once per node visited. Every
 * pass of the index asks nodes for their type, and over a size-stratified
 * sample of vscode's `src/` that is 14,328 crossings per indexed file against
 * one.
 *
 * The anonymous tokens — punctuation and keywords — all share the base class,
 * which cannot hold one name, so each is given a class of its own to hold it.
 */
function pin_node_type_names(grammar: Grammar): void {
  if (GRAMMARS_WITH_PINNED_TYPE_NAMES.has(grammar)) {
    return;
  }
  GRAMMARS_WITH_PINNED_TYPE_NAMES.add(grammar);

  const node_classes = node_classes_of(grammar);
  for (let type_id = 0; type_id < node_classes.length; type_id++) {
    let node_class = node_classes[type_id];
    if (node_class === BASE_NODE_CLASS) {
      node_class = class extends BASE_NODE_CLASS {};
      node_classes[type_id] = node_class;
    }
    pin_type_name(node_class);
  }
}

/**
 * The first node of a type answers from the binding and writes the answer onto
 * its class; every later node of that type reads it as a plain property.
 */
function pin_type_name(node_class: NodeClass): void {
  const prototype = node_class.prototype;
  if (Object.getOwnPropertyDescriptor(prototype, "type")) {
    return;
  }
  Object.defineProperty(prototype, "type", {
    configurable: true,
    get(): string {
      const type_name = READ_TYPE_FROM_BINDING.call(this);
      Object.defineProperty(prototype, "type", {
        configurable: true,
        value: type_name,
      });
      return type_name;
    },
  });
}

/** The node classes tree-sitter built for a grammar, indexed by node type id. */
function node_classes_of(grammar: Grammar): NodeClass[] {
  const node_classes: unknown = Reflect.get(grammar, "nodeSubclasses");
  if (!Array.isArray(node_classes)) {
    throw new Error(
      "tree-sitter built no node classes for this grammar; a parser must bind it first"
    );
  }
  return node_classes;
}

function read_base_node_class(): NodeClass {
  const node_class: unknown = Reflect.get(Parser, "SyntaxNode");
  if (!is_node_class(node_class)) {
    throw new Error("tree-sitter exports no SyntaxNode class");
  }
  return node_class;
}

function is_node_class(value: unknown): value is NodeClass {
  return typeof value === "function";
}

function read_type_accessor(): (this: object) => string {
  const descriptor = Object.getOwnPropertyDescriptor(
    BASE_NODE_CLASS.prototype,
    "type"
  );
  if (!descriptor?.get) {
    throw new Error("tree-sitter's SyntaxNode has no type accessor");
  }
  return descriptor.get;
}
