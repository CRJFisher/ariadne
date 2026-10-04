/**
 * The names each language binds without a declaration.
 *
 * A call to one of these names resolves to nothing the indexed files hold,
 * because the callee is defined by the language's runtime or standard library.
 * The set is the language's, never a union across languages: `window` is a
 * JavaScript global and an ordinary identifier in Rust, and `Some` is a Rust
 * prelude constructor and an ordinary identifier in Python.
 */

import type { Language } from "./location";

/**
 * @language python
 * The names of the `builtins` module: functions, types and exception classes.
 */
const PYTHON_BUILTINS: ReadonlySet<string> = new Set([
  "__build_class__", "__import__", "abs", "aiter", "all", "anext", "any", "ascii",
  "bin", "bool", "breakpoint", "bytearray", "bytes", "callable", "chr",
  "classmethod", "compile", "complex", "copyright", "credits", "delattr", "dict",
  "dir", "divmod", "enumerate", "eval", "exec", "exit", "filter", "float",
  "format", "frozenset", "getattr", "globals", "hasattr", "hash", "help", "hex",
  "id", "input", "int", "isinstance", "issubclass", "iter", "len", "license",
  "list", "locals", "map", "max", "memoryview", "min", "next", "object", "oct",
  "open", "ord", "pow", "print", "property", "quit", "range", "repr", "reversed",
  "round", "set", "setattr", "slice", "sorted", "staticmethod", "str", "sum",
  "super", "tuple", "type", "vars", "zip",
  "ArithmeticError", "AssertionError", "AttributeError", "BaseException",
  "BaseExceptionGroup", "BlockingIOError", "BrokenPipeError", "BufferError",
  "BytesWarning", "ChildProcessError", "ConnectionAbortedError", "ConnectionError",
  "ConnectionRefusedError", "ConnectionResetError", "DeprecationWarning",
  "EOFError", "EncodingWarning", "EnvironmentError", "Exception", "ExceptionGroup",
  "FileExistsError", "FileNotFoundError", "FloatingPointError", "FutureWarning",
  "GeneratorExit", "IOError", "ImportError", "ImportWarning", "IndentationError",
  "IndexError", "InterruptedError", "IsADirectoryError", "KeyError",
  "KeyboardInterrupt", "LookupError", "MemoryError", "ModuleNotFoundError",
  "NameError", "NotADirectoryError", "NotImplementedError", "OSError",
  "OverflowError", "PendingDeprecationWarning", "PermissionError",
  "ProcessLookupError", "PythonFinalizationError", "RecursionError",
  "ReferenceError", "ResourceWarning", "RuntimeError", "RuntimeWarning",
  "StopAsyncIteration", "StopIteration", "SyntaxError", "SyntaxWarning",
  "SystemError", "SystemExit", "TabError", "TimeoutError", "TypeError",
  "UnboundLocalError", "UnicodeDecodeError", "UnicodeEncodeError", "UnicodeError",
  "UnicodeTranslateError", "UnicodeWarning", "UserWarning", "ValueError",
  "Warning", "ZeroDivisionError",
]);

/**
 * @language javascript,typescript
 * The ECMAScript built-ins plus the host globals of Node.js and the browser.
 * `require`, `module`, `exports`, `__dirname` and `__filename` are bound by
 * Node's CommonJS module wrapper rather than by any declaration.
 */
const JAVASCRIPT_GLOBALS: ReadonlySet<string> = new Set([
  "AbortController", "AbortSignal", "AggregateError", "Array", "ArrayBuffer",
  "Atomics", "BigInt", "BigInt64Array", "BigUint64Array", "Blob", "Boolean",
  "Buffer", "DataView", "Date", "Error", "EvalError", "Event", "EventTarget",
  "FinalizationRegistry", "Float32Array", "Float64Array", "FormData", "Function",
  "Headers", "Infinity", "Int16Array", "Int32Array", "Int8Array", "Intl",
  "Iterator", "JSON", "Map", "Math", "NaN", "Number", "Object", "Promise",
  "Proxy", "RangeError", "ReferenceError", "Reflect", "RegExp", "Request",
  "Response", "Set", "SharedArrayBuffer", "String", "Symbol", "SyntaxError",
  "TextDecoder", "TextEncoder", "TypeError", "URIError", "URL", "URLSearchParams",
  "Uint16Array", "Uint32Array", "Uint8Array", "Uint8ClampedArray", "WeakMap",
  "WeakRef", "WeakSet", "WebAssembly", "__dirname", "__filename", "alert",
  "atob", "btoa", "clearImmediate", "clearInterval", "clearTimeout", "console",
  "decodeURI", "decodeURIComponent", "document", "encodeURI",
  "encodeURIComponent", "escape", "eval", "exports", "fetch", "globalThis",
  "isFinite", "isNaN", "localStorage", "module", "navigator", "parseFloat",
  "parseInt", "performance", "process", "queueMicrotask", "require",
  "requestAnimationFrame", "sessionStorage", "setImmediate", "setInterval",
  "setTimeout", "structuredClone", "undefined", "unescape", "window",
]);

/**
 * @language rust
 * The std prelude's types, traits and functions, the primitive types, and the
 * crate names a path may start from with no `extern crate` or `use`.
 */
const RUST_PRELUDE: ReadonlySet<string> = new Set([
  "AsMut", "AsRef", "Box", "Clone", "Copy", "Default", "Drop", "DoubleEndedIterator",
  "Eq", "Err", "ExactSizeIterator", "Extend", "Fn", "FnMut", "FnOnce",
  "From", "FromIterator", "Into", "IntoIterator", "Iterator", "None", "Ok", "Option",
  "Ord", "PartialEq", "PartialOrd", "Result", "Send", "Sized", "Some", "String",
  "Sync", "ToOwned", "ToString", "TryFrom", "TryInto", "Unpin", "Vec", "drop",
  "bool", "char", "f32", "f64", "i128", "i16", "i32", "i64", "i8", "isize", "str",
  "u128", "u16", "u32", "u64", "u8", "usize",
  "alloc", "core", "std",
]);

const LANGUAGE_GLOBALS: Readonly<Record<Language, ReadonlySet<string>>> = {
  python: PYTHON_BUILTINS,
  javascript: JAVASCRIPT_GLOBALS,
  typescript: JAVASCRIPT_GLOBALS,
  rust: RUST_PRELUDE,
};

/** Whether `name` is bound by `language` itself, with no declaration or import in any file. */
export function is_language_global(language: Language, name: string): boolean {
  return LANGUAGE_GLOBALS[language].has(name);
}
