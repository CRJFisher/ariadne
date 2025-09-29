/**
 * Language configuration for import resolution
 *
 * Contains language-specific constants and patterns
 * for module resolution and import matching.
 */

export interface LanguageConfig {
  file_extensions: readonly string[];
  index_files: readonly string[];
  builtin_modules: ReadonlySet<string>;
  package_config_files: readonly string[];
  supports_namespace_imports: boolean;
  supports_default_exports: boolean;
  module_separator: string;
}

export const JAVASCRIPT_CONFIG: LanguageConfig = {
  file_extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  index_files: ["index.ts", "index.tsx", "index.js", "index.jsx"],
  builtin_modules: new Set([
    "assert", "buffer", "child_process", "cluster", "crypto", "dgram",
    "dns", "domain", "events", "fs", "http", "https", "net", "os",
    "path", "punycode", "querystring", "readline", "repl", "stream",
    "string_decoder", "timers", "tls", "tty", "url", "util", "v8",
    "vm", "zlib", "worker_threads", "inspector", "async_hooks",
    "http2", "perf_hooks", "process", "console",
  ]),
  package_config_files: ["package.json"],
  supports_namespace_imports: true,
  supports_default_exports: true,
  module_separator: "/",
};

export const TYPESCRIPT_CONFIG: LanguageConfig = {
  ...JAVASCRIPT_CONFIG,
};

export const PYTHON_CONFIG: LanguageConfig = {
  file_extensions: [".py", ".pyi", ".pyw"],
  index_files: ["__init__.py"],
  builtin_modules: new Set([
    "abc", "argparse", "array", "ast", "asyncio", "atexit", "base64",
    "bisect", "builtins", "calendar", "collections", "configparser",
    "contextlib", "copy", "csv", "datetime", "decimal", "difflib",
    "dis", "email", "enum", "errno", "functools", "gc", "getopt",
    "glob", "gzip", "hashlib", "heapq", "html", "http", "importlib",
    "inspect", "io", "itertools", "json", "keyword", "linecache",
    "locale", "logging", "math", "multiprocessing", "operator", "os",
    "pathlib", "pickle", "platform", "pprint", "queue", "random", "re",
    "select", "shutil", "signal", "socket", "sqlite3", "statistics",
    "string", "struct", "subprocess", "sys", "tempfile", "textwrap",
    "threading", "time", "timeit", "traceback", "types", "typing",
    "unittest", "urllib", "uuid", "warnings", "weakref", "xml", "zipfile",
  ]),
  package_config_files: ["setup.py", "pyproject.toml"],
  supports_namespace_imports: false,
  supports_default_exports: false,
  module_separator: ".",
};

export const RUST_CONFIG: LanguageConfig = {
  file_extensions: [".rs"],
  index_files: ["mod.rs", "lib.rs", "main.rs"],
  builtin_modules: new Set([
    "std", "core", "alloc", "proc_macro", "test",
  ]),
  package_config_files: ["Cargo.toml"],
  supports_namespace_imports: false,
  supports_default_exports: false,
  module_separator: "::",
};