/**
 * Pure logic for the capture/receiver consistency guard (TASK-364.10).
 *
 * Definition capture handlers are dispatched by an exact capture-name lookup:
 * `process_definitions` in packages/core/src/index_single_file/index_single_file.ts
 * does `registry[capture.name]` and runs the handler only when one is found.
 * There is no normalization and no prefix fallback, so the registry and the
 * `.scm` queries must agree on capture-name strings exactly. Two ways they
 * drift:
 *
 *   - dead handler  — a registry key that no feeding query emits as `@<name>`.
 *     The handler is unreachable: `registry[capture.name]` never keys into it.
 *   - orphan capture — a query emits `@<name>` in a definition-dispatch family
 *     but the matching registry has no handler for it. The extraction the query
 *     author intended silently never happens.
 *
 * The one wrinkle the model must honour: `TYPESCRIPT_HANDLERS` spreads
 * `JAVASCRIPT_HANDLERS`, so a JavaScript handler is reachable when indexing a
 * TypeScript file too. A JS registry key is therefore dead only when neither
 * `javascript.scm` nor `typescript.scm` emits it — unless a TS-specific entry
 * redeclares that key, in which case the JS handler is no longer reachable via
 * the TypeScript path. The spread edges are read from the registry files
 * themselves (the `...SYMBOL` lines), not declared a second time here.
 *
 * `parse_emitted_captures`, `parse_registry`, and `check_consistency` are pure
 * string and set algebra, tested against fixture strings. `check_project` is
 * the IO edge that reads the topology files; capture_receiver_consistency_stop.ts
 * adds only the git trigger and stdin.
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

/**
 * Capture categories the definition dispatch owns. Orphan detection is scoped
 * to these: a query emits far more captures than the definition registry
 * handles (`reference.*`, `scope.*`, `export.*`, `modifier.*`, `return.*`), and
 * those are consumed by other passes. `import` covers `import.reexport`.
 *
 * `assignment` is deliberately excluded even though the Python registry
 * dispatches the single key `assignment.property`: the assignment family is
 * dominated by reference-pass captures (`assignment.variable`,
 * `assignment.constructor.qualified`) that no definition handler consumes, so
 * scoping orphans to `assignment` would warn on them forever. The one
 * definition-dispatched assignment key stays honest through the dead-handler
 * side instead — it is reported dead if its query stops emitting it.
 */
export const DEFINITION_DISPATCH_CATEGORIES = ["definition", "decorator", "import"] as const;

/** Query and receiver paths that feed the definition dispatch. */
const QUERY_FILE = /query_code_tree\/queries\/.+\.scm$/;
const RECEIVER_FILE = /query_code_tree\/capture_handlers\/.+\.ts$/;

/**
 * A repo-relative change is worth re-running the check when it edits a query
 * (`queries/*.scm`) or a receiver (`capture_handlers/*.ts`) — the two inputs
 * that can put registry keys and emitted captures out of sync. Receiver test
 * files are excluded: the check reads only the registry `.ts` and query `.scm`,
 * never test files.
 */
export function is_trigger_file(repo_path: string): boolean {
  if (repo_path.endsWith(".test.ts")) return false;
  return QUERY_FILE.test(repo_path) || RECEIVER_FILE.test(repo_path);
}

/**
 * One registry and the query that feeds it. The spread relationship (TS spreads
 * JS) is not recorded here — it is read from each registry file's `...SYMBOL`
 * lines by `parse_registry`, so this stays a single source of truth.
 */
export interface RegistryTopologyEntry {
  language: string;
  registry_file: string;
  registry_symbol: string;
  query_file: string;
}

/**
 * The fixed topology of the definition-handler dispatch: which registry symbol
 * lives in which file and which query feeds it. The consistency check reads
 * these files and models the spread relationship discovered inside them.
 */
export const REGISTRY_TOPOLOGY: RegistryTopologyEntry[] = [
  {
    language: "javascript",
    registry_file:
      "packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.javascript.ts",
    registry_symbol: "JAVASCRIPT_HANDLERS",
    query_file: "packages/core/src/index_single_file/query_code_tree/queries/javascript.scm",
  },
  {
    language: "typescript",
    registry_file:
      "packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.typescript.ts",
    registry_symbol: "TYPESCRIPT_HANDLERS",
    query_file: "packages/core/src/index_single_file/query_code_tree/queries/typescript.scm",
  },
  {
    language: "python",
    registry_file:
      "packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.python.ts",
    registry_symbol: "PYTHON_HANDLERS",
    query_file: "packages/core/src/index_single_file/query_code_tree/queries/python.scm",
  },
  {
    language: "rust",
    registry_file:
      "packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.rust.ts",
    registry_symbol: "RUST_HANDLERS",
    query_file: "packages/core/src/index_single_file/query_code_tree/queries/rust.scm",
  },
];

/** A registry key that no feeding query emits — an unreachable handler. */
export interface DeadHandler {
  language: string;
  capture: string;
  handler: string;
}

/** An emitted definition-family capture with no handler in the matching registry. */
export interface OrphanCapture {
  language: string;
  capture: string;
}

export interface ConsistencyReport {
  dead_handlers: DeadHandler[];
  orphan_captures: OrphanCapture[];
}

/** The own (non-inherited) entries of a single registry object. */
export interface ParsedRegistry {
  /** Insertion-ordered capture keys declared directly in the object. */
  keys: string[];
  /** capture key → handler function name, for the dead-handler report. */
  key_to_handler: Map<string, string>;
  /** Registry symbols spread in via `...SYMBOL`. */
  spreads: string[];
}

/**
 * Drop tree-sitter query comments before scanning for captures. A `.scm`
 * comment runs from an unquoted `;` to end of line, and the query files narrate
 * their captures in prose (`; captures @definition.field`); without this, a
 * capture named only in a comment would be counted as emitted, masking a real
 * dead handler — the exact drift this guard exists to catch.
 */
export function strip_scm_comments(scm: string): string {
  let out = "";
  let in_string = false;
  for (let i = 0; i < scm.length; i++) {
    const ch = scm[i];
    if (in_string) {
      out += ch;
      if (ch === "\\" && i + 1 < scm.length) {
        out += scm[++i];
      } else if (ch === '"') {
        in_string = false;
      }
      continue;
    }
    if (ch === '"') {
      in_string = true;
      out += ch;
    } else if (ch === ";") {
      while (i < scm.length && scm[i] !== "\n") i++;
      if (i < scm.length) out += "\n";
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Extract the `@<name>` captures a `.scm` query emits. Only dotted, non-hidden
 * names count: tree-sitter's underscore-prefixed captures (`@_require`) and
 * bare predicate anchors (`@classmethod`) are query-internal, never dispatched.
 */
export function parse_emitted_captures(scm: string): Set<string> {
  const captures = new Set<string>();
  const re = /@([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)/g;
  let match: RegExpExecArray | null;
  const source = strip_scm_comments(scm);
  while ((match = re.exec(source)) !== null) {
    captures.add(match[1]);
  }
  return captures;
}

/**
 * Parse a `export const X_HANDLERS: HandlerRegistry = { … } as const;` object
 * into its own capture keys, handler names, and spread symbols. Slicing to the
 * object body keeps unrelated string literals elsewhere in the file out of the
 * key set.
 */
export function parse_registry(ts: string, registry_symbol: string): ParsedRegistry {
  const decl_index = ts.indexOf(`const ${registry_symbol}`);
  if (decl_index === -1) {
    throw new Error(`registry symbol ${registry_symbol} not found`);
  }
  const brace_start = ts.indexOf("{", decl_index);
  const body_end = ts.indexOf("} as const", brace_start);
  if (brace_start === -1 || body_end === -1) {
    throw new Error(`registry object for ${registry_symbol} is not a "{ … } as const" literal`);
  }
  const body = ts.slice(brace_start + 1, body_end);

  const keys: string[] = [];
  const key_to_handler = new Map<string, string>();
  const spreads: string[] = [];

  const entry_re = /^\s*"([^"]+)"\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/gm;
  let entry: RegExpExecArray | null;
  while ((entry = entry_re.exec(body)) !== null) {
    const [, capture, handler] = entry;
    keys.push(capture);
    key_to_handler.set(capture, handler);
  }

  const spread_re = /^\s*\.\.\.([A-Za-z_][A-Za-z0-9_]*)/gm;
  let spread: RegExpExecArray | null;
  while ((spread = spread_re.exec(body)) !== null) {
    spreads.push(spread[1]);
  }

  return { keys, key_to_handler, spreads };
}

function category_of(capture: string): string {
  return capture.split(".")[0];
}

function is_definition_dispatch_capture(capture: string): boolean {
  return (DEFINITION_DISPATCH_CATEGORIES as readonly string[]).includes(category_of(capture));
}

/** Registry object plus the captures its own query emits, keyed by symbol. */
export interface RegistryModel {
  source: RegistryTopologyEntry;
  parsed: ParsedRegistry;
  emitted: Set<string>;
}

/**
 * Compute dead handlers and orphan captures across all registries.
 *
 * A registry entry is reachable from a query when that query emits the entry's
 * capture. An entry's feeding queries are its own registry's query plus the
 * queries of any registry that spreads it in — but only for keys the inheriting
 * registry does not redeclare. A handler is dead when none of its feeding
 * queries emit its capture. Spread edges come from each registry's parsed
 * `...SYMBOL` lines and are resolved one level deep (the current topology only
 * spreads TS→JS; a transitively-spreading language would need this widened).
 *
 * Orphan captures are reported per language against that language's effective
 * registry (own keys plus inherited-and-not-redeclared spread keys), scoped to
 * the definition-dispatch categories.
 */
export function check_consistency(models: RegistryModel[]): ConsistencyReport {
  const by_symbol = new Map<string, RegistryModel>();
  for (const model of models) {
    by_symbol.set(model.source.registry_symbol, model);
  }

  const dead_handlers: DeadHandler[] = [];
  for (const model of models) {
    const inheritors = models.filter((m) =>
      m.parsed.spreads.includes(model.source.registry_symbol),
    );
    for (const capture of model.parsed.keys) {
      const feeders = [model.emitted];
      for (const inheritor of inheritors) {
        if (!inheritor.parsed.key_to_handler.has(capture)) {
          feeders.push(inheritor.emitted);
        }
      }
      const reachable = feeders.some((emitted) => emitted.has(capture));
      if (!reachable) {
        dead_handlers.push({
          language: model.source.language,
          capture,
          handler: model.parsed.key_to_handler.get(capture)!,
        });
      }
    }
  }

  const orphan_captures: OrphanCapture[] = [];
  for (const model of models) {
    const effective_keys = new Set<string>(model.parsed.keys);
    for (const symbol of model.parsed.spreads) {
      const spread_model = by_symbol.get(symbol);
      if (spread_model) {
        for (const key of spread_model.parsed.keys) {
          effective_keys.add(key);
        }
      }
    }
    for (const capture of model.emitted) {
      if (is_definition_dispatch_capture(capture) && !effective_keys.has(capture)) {
        orphan_captures.push({ language: model.source.language, capture });
      }
    }
  }

  return { dead_handlers, orphan_captures };
}

/**
 * Read the registry and query files named by REGISTRY_TOPOLOGY, then run the
 * consistency check. `project_dir` is the repository root the relative paths
 * resolve against.
 */
export function check_project(project_dir: string): ConsistencyReport {
  const models: RegistryModel[] = REGISTRY_TOPOLOGY.map((source) => {
    const registry_ts = fs.readFileSync(path.join(project_dir, source.registry_file), "utf8");
    const query_scm = fs.readFileSync(path.join(project_dir, source.query_file), "utf8");
    return {
      source,
      parsed: parse_registry(registry_ts, source.registry_symbol),
      emitted: parse_emitted_captures(query_scm),
    };
  });
  return check_consistency(models);
}

export function format_dead_handlers(dead: DeadHandler[]): string {
  const lines = dead.map(
    (d) => `  ${d.language}: "${d.capture}" → ${d.handler} (no query emits @${d.capture})`,
  );
  return (
    `Dead capture handlers (${dead.length}) — registered but no feeding query emits the capture, ` +
    `so registry[capture.name] never reaches them:\n\n${lines.join("\n")}\n\n` +
    `Remove each: the handler function, its registry entry, any helper it was the ` +
    `sole caller of, and any test that exists only to exercise it. The dispatch is ` +
    `\`registry[capture.name]\` in packages/core/src/index_single_file/index_single_file.ts.`
  );
}

export function format_orphan_captures(orphans: OrphanCapture[]): string {
  const lines = orphans.map((o) => `  ${o.language}: @${o.capture} (emitted, no handler registered)`);
  return (
    `Orphan definition captures (${orphans.length}) — a query emits these but the ` +
    `matching registry has no handler, so the extraction silently never runs:\n\n` +
    `${lines.join("\n")}`
  );
}

// CLI entry: run the check against the current repo and report. Exits non-zero
// when dead handlers exist (the blockable condition); orphan captures print as
// a warning and do not affect the exit code. `--json` emits the raw report.
function main(): void {
  // A CLI acts on the tree it is invoked from; CLAUDE_PROJECT_DIR would point
  // at the main checkout when run inside a worktree.
  const report = check_project(process.cwd());

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.dead_handlers.length > 0 ? 1 : 0);
  }

  if (report.dead_handlers.length === 0 && report.orphan_captures.length === 0) {
    console.log("capture/receiver consistency: no dead handlers, no orphan captures.");
    return;
  }
  if (report.dead_handlers.length > 0) {
    console.log(format_dead_handlers(report.dead_handlers));
  }
  if (report.orphan_captures.length > 0) {
    if (report.dead_handlers.length > 0) console.log("");
    console.log(format_orphan_captures(report.orphan_captures));
  }
  process.exit(report.dead_handlers.length > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
