/**
 * Language-specific hoisting behavior for symbol resolution
 */

import type {
  Language,
  LexicalScope,
  SymbolId,
  SymbolName,
  SymbolDefinition,
} from "@ariadnejs/types";

import type {
  HoistingRules,
  ScopeResolutionContext,
  BuiltinSymbol,
} from "./scope_types";

/**
 * Find a hoisted symbol in a scope
 *
 * @param symbol_name - The name to find
 * @param scope - The scope to search in
 * @param context - Resolution context
 * @returns The hoisted symbol ID if found, null otherwise
 */
export function find_hoisted_symbol_in_scope(
  symbol_name: SymbolName,
  scope: LexicalScope,
  context: ScopeResolutionContext
): SymbolId | null {
  const hoisting_rules = get_hoisting_rules(context.language);

  // Search through all symbols in scope for hoisted declarations
  const symbol_entries = Array.from(context.symbols.entries());
  for (const [symbol_id, symbol_def] of symbol_entries) {
    if (symbol_def.scope_id !== scope.id || symbol_def.name !== symbol_name) {
      continue;
    }

    if (is_symbol_hoisted(symbol_def, hoisting_rules)) {
      return symbol_id;
    }
  }

  // Check child scopes for hoisted function declarations that bubble up
  if (hoisting_rules.function_declarations && scope.type !== "block") {
    for (const child_scope_id of scope.child_ids) {
      const child_scope = context.scopes.get(child_scope_id);
      if (child_scope) {
        const hoisted_from_child = find_hoisted_function_declarations(
          symbol_name,
          child_scope,
          context
        );
        if (hoisted_from_child) {
          return hoisted_from_child;
        }
      }
    }
  }

  return null;
}

/**
 * Find hoisted function declarations in child scopes
 *
 * @param symbol_name - The function name to find
 * @param scope - The scope to search in
 * @param context - Resolution context
 * @returns The hoisted function ID if found
 */
function find_hoisted_function_declarations(
  symbol_name: SymbolName,
  scope: LexicalScope,
  context: ScopeResolutionContext
): SymbolId | null {
  // Only function declarations are hoisted from child scopes
  const symbol_entries = Array.from(context.symbols.entries());
  for (const [symbol_id, symbol_def] of symbol_entries) {
    if (
      symbol_def.scope_id === scope.id &&
      symbol_def.name === symbol_name &&
      symbol_def.kind === "function" &&
      symbol_def.is_hoisted
    ) {
      return symbol_id;
    }
  }

  // Recursively check child scopes
  for (const child_scope_id of scope.child_ids) {
    const child_scope = context.scopes.get(child_scope_id);
    if (child_scope && child_scope.type !== "function" && child_scope.type !== "method") {
      const result = find_hoisted_function_declarations(
        symbol_name,
        child_scope,
        context
      );
      if (result) {
        return result;
      }
    }
  }

  return null;
}

/**
 * Get hoisting rules for a language
 *
 * @param language - The programming language
 * @returns Language-specific hoisting rules
 */
export function get_hoisting_rules(language: Language): HoistingRules {
  switch (language) {
    case "javascript":
    case "typescript":
      return {
        function_declarations: true,
        var_declarations: true,
        let_const_declarations: false,
        class_declarations: false
      };

    case "python":
      return {
        function_declarations: false,
        var_declarations: false,
        let_const_declarations: false,
        class_declarations: false
      };

    case "rust":
      return {
        function_declarations: true, // Items available throughout module
        var_declarations: false,
        let_const_declarations: false,
        class_declarations: true
      };

    default:
      return {
        function_declarations: false,
        var_declarations: false,
        let_const_declarations: false,
        class_declarations: false
      };
  }
}

/**
 * Check if a symbol is hoisted according to language rules
 *
 * @param symbol_def - The symbol definition
 * @param rules - Language hoisting rules
 * @returns True if the symbol is hoisted
 */
function is_symbol_hoisted(
  symbol_def: SymbolDefinition,
  rules: HoistingRules
): boolean {
  // First check the symbol's own hoisting flag
  if (symbol_def.is_hoisted) {
    return true;
  }

  // Then check language-specific rules
  switch (symbol_def.kind) {
    case "function":
      return rules.function_declarations;
    case "variable":
      // In JS/TS, check if it's a var declaration (would need more context)
      // For now, rely on the is_hoisted flag from semantic index
      return false;
    case "class":
      return rules.class_declarations;
    default:
      return false;
  }
}

/**
 * Resolve a global or built-in symbol
 *
 * @param symbol_name - The symbol name
 * @param language - The programming language
 * @returns The built-in symbol ID if found
 */
export function resolve_global_symbol(
  symbol_name: SymbolName,
  language: Language
): SymbolId | null {
  const global_symbols = get_global_symbols(language);
  const builtin = global_symbols.get(symbol_name);
  return builtin ? builtin.id : null;
}

/**
 * Get global/built-in symbols for a language
 *
 * @param language - The programming language
 * @returns Map of symbol names to built-in symbol information
 */
function get_global_symbols(language: Language): Map<SymbolName, BuiltinSymbol> {
  const globals = new Map<SymbolName, BuiltinSymbol>();

  switch (language) {
    case "javascript":
    case "typescript":
      // Browser/Node.js globals
      add_builtin(globals, "console", language, "Global console object");
      add_builtin(globals, "setTimeout", language, "Schedule function execution");
      add_builtin(globals, "setInterval", language, "Schedule repeated execution");
      add_builtin(globals, "clearTimeout", language, "Cancel scheduled execution");
      add_builtin(globals, "clearInterval", language, "Cancel repeated execution");
      add_builtin(globals, "fetch", language, "Fetch API for HTTP requests");
      add_builtin(globals, "Promise", language, "Promise constructor");
      add_builtin(globals, "Array", language, "Array constructor");
      add_builtin(globals, "Object", language, "Object constructor");
      add_builtin(globals, "String", language, "String constructor");
      add_builtin(globals, "Number", language, "Number constructor");
      add_builtin(globals, "Boolean", language, "Boolean constructor");
      add_builtin(globals, "Date", language, "Date constructor");
      add_builtin(globals, "Math", language, "Math utilities");
      add_builtin(globals, "JSON", language, "JSON utilities");
      add_builtin(globals, "RegExp", language, "RegExp constructor");
      add_builtin(globals, "Error", language, "Error constructor");
      add_builtin(globals, "Map", language, "Map constructor");
      add_builtin(globals, "Set", language, "Set constructor");
      add_builtin(globals, "WeakMap", language, "WeakMap constructor");
      add_builtin(globals, "WeakSet", language, "WeakSet constructor");
      add_builtin(globals, "Symbol", language, "Symbol constructor");
      add_builtin(globals, "BigInt", language, "BigInt constructor");
      add_builtin(globals, "undefined", language, "Undefined value");
      add_builtin(globals, "null", language, "Null value");
      add_builtin(globals, "NaN", language, "Not a number");
      add_builtin(globals, "Infinity", language, "Positive infinity");
      add_builtin(globals, "globalThis", language, "Global object");
      add_builtin(globals, "window", language, "Browser window object");
      add_builtin(globals, "document", language, "Browser document object");
      add_builtin(globals, "process", language, "Node.js process object");
      add_builtin(globals, "require", language, "Node.js require function");
      add_builtin(globals, "__dirname", language, "Node.js directory name");
      add_builtin(globals, "__filename", language, "Node.js file name");
      add_builtin(globals, "module", language, "Node.js module object");
      add_builtin(globals, "exports", language, "Node.js exports object");
      add_builtin(globals, "Buffer", language, "Node.js Buffer constructor");
      break;

    case "python":
      // Python built-ins
      add_builtin(globals, "print", language, "Print to stdout");
      add_builtin(globals, "len", language, "Get length of object");
      add_builtin(globals, "str", language, "String constructor");
      add_builtin(globals, "int", language, "Integer constructor");
      add_builtin(globals, "float", language, "Float constructor");
      add_builtin(globals, "bool", language, "Boolean constructor");
      add_builtin(globals, "list", language, "List constructor");
      add_builtin(globals, "dict", language, "Dictionary constructor");
      add_builtin(globals, "set", language, "Set constructor");
      add_builtin(globals, "tuple", language, "Tuple constructor");
      add_builtin(globals, "range", language, "Create range object");
      add_builtin(globals, "enumerate", language, "Enumerate iterable");
      add_builtin(globals, "zip", language, "Zip iterables");
      add_builtin(globals, "map", language, "Map function over iterable");
      add_builtin(globals, "filter", language, "Filter iterable");
      add_builtin(globals, "sum", language, "Sum numeric iterable");
      add_builtin(globals, "min", language, "Find minimum value");
      add_builtin(globals, "max", language, "Find maximum value");
      add_builtin(globals, "abs", language, "Absolute value");
      add_builtin(globals, "round", language, "Round number");
      add_builtin(globals, "sorted", language, "Sort iterable");
      add_builtin(globals, "reversed", language, "Reverse iterable");
      add_builtin(globals, "open", language, "Open file");
      add_builtin(globals, "input", language, "Read from stdin");
      add_builtin(globals, "isinstance", language, "Check instance type");
      add_builtin(globals, "issubclass", language, "Check subclass");
      add_builtin(globals, "hasattr", language, "Check attribute");
      add_builtin(globals, "getattr", language, "Get attribute");
      add_builtin(globals, "setattr", language, "Set attribute");
      add_builtin(globals, "delattr", language, "Delete attribute");
      add_builtin(globals, "type", language, "Get type of object");
      add_builtin(globals, "id", language, "Get object ID");
      add_builtin(globals, "hash", language, "Get hash of object");
      add_builtin(globals, "help", language, "Get help documentation");
      add_builtin(globals, "dir", language, "List attributes");
      add_builtin(globals, "locals", language, "Get local variables");
      add_builtin(globals, "globals", language, "Get global variables");
      add_builtin(globals, "vars", language, "Get object variables");
      add_builtin(globals, "eval", language, "Evaluate expression");
      add_builtin(globals, "exec", language, "Execute code");
      add_builtin(globals, "compile", language, "Compile code");
      add_builtin(globals, "__import__", language, "Import module");
      add_builtin(globals, "None", language, "None value");
      add_builtin(globals, "True", language, "True boolean");
      add_builtin(globals, "False", language, "False boolean");
      add_builtin(globals, "Exception", language, "Base exception class");
      add_builtin(globals, "object", language, "Base object class");
      break;

    case "rust":
      // Rust standard library (implicitly available macros)
      add_builtin(globals, "println!", language, "Print line macro");
      add_builtin(globals, "print!", language, "Print macro");
      add_builtin(globals, "eprintln!", language, "Print to stderr macro");
      add_builtin(globals, "eprint!", language, "Print to stderr macro");
      add_builtin(globals, "format!", language, "Format string macro");
      add_builtin(globals, "vec!", language, "Vector creation macro");
      add_builtin(globals, "panic!", language, "Panic macro");
      add_builtin(globals, "assert!", language, "Assert macro");
      add_builtin(globals, "assert_eq!", language, "Assert equality macro");
      add_builtin(globals, "assert_ne!", language, "Assert not equal macro");
      add_builtin(globals, "debug_assert!", language, "Debug assert macro");
      add_builtin(globals, "debug_assert_eq!", language, "Debug assert equal macro");
      add_builtin(globals, "debug_assert_ne!", language, "Debug assert not equal macro");
      add_builtin(globals, "todo!", language, "Todo macro");
      add_builtin(globals, "unimplemented!", language, "Unimplemented macro");
      add_builtin(globals, "unreachable!", language, "Unreachable macro");
      add_builtin(globals, "include!", language, "Include file macro");
      add_builtin(globals, "include_str!", language, "Include file as string macro");
      add_builtin(globals, "include_bytes!", language, "Include file as bytes macro");
      add_builtin(globals, "concat!", language, "Concatenate strings macro");
      add_builtin(globals, "env!", language, "Environment variable macro");
      add_builtin(globals, "option_env!", language, "Optional environment variable macro");
      add_builtin(globals, "cfg!", language, "Configuration macro");
      add_builtin(globals, "line!", language, "Current line macro");
      add_builtin(globals, "column!", language, "Current column macro");
      add_builtin(globals, "file!", language, "Current file macro");
      add_builtin(globals, "module_path!", language, "Module path macro");
      add_builtin(globals, "stringify!", language, "Stringify tokens macro");
      add_builtin(globals, "matches!", language, "Pattern match macro");
      break;
  }

  return globals;
}

/**
 * Helper to add a built-in symbol to the map
 */
function add_builtin(
  map: Map<SymbolName, BuiltinSymbol>,
  name: string,
  language: Language,
  documentation: string
): void {
  const symbol_name = name as SymbolName;
  const symbol_id = create_builtin_symbol_id(name, language);

  map.set(symbol_name, {
    id: symbol_id,
    name: symbol_name,
    language,
    is_global: true,
    documentation
  });
}

/**
 * Create a built-in symbol ID
 */
function create_builtin_symbol_id(name: string, language: string): SymbolId {
  return `builtin:${language}:${name}` as SymbolId;
}