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
 * overrides that key, in which case the JS handler is no longer reachable via
 * the TypeScript path.
 *
 * Pure string parsing and set algebra only — the filesystem read and git
 * trigger live in capture_receiver_consistency_stop.ts so these functions run
 * against fixture strings in tests.
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

/**
 * Capture categories the definition dispatch owns. Orphan detection is scoped
 * to these: a query emits far more captures than the definition registry
 * handles (`reference.*`, `scope.*`, `export.*`, `modifier.*`, `return.*`,
 * `assignment.variable`, …) and those are consumed by other passes, so flagging
 * them as orphans would be noise. `import` covers `import.reexport`.
 */
export const DEFINITION_DISPATCH_CATEGORIES = ["definition", "decorator", "import"] as const;

/**
 * One concrete handler registry and the query that feeds it. `spreads` names
 * the registries whose entries this one inherits (TS spreads JS). `overrides`
 * are keys this registry redeclares, which shadow the inherited handler and cut
 * the inherited entry off from this registry's query.
 */
export interface RegistrySource {
  language: string;
  registry_file: string;
  registry_symbol: string;
  query_file: string;
  spreads: string[];
}

/**
 * The fixed topology of the definition-handler dispatch. Registry symbols and
 * query paths are stable; the consistency check reads these files and models
 * the spread relationship between them.
 */
export const REGISTRY_TOPOLOGY: RegistrySource[] = [
  {
    language: "javascript",
    registry_file:
      "packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.javascript.ts",
    registry_symbol: "JAVASCRIPT_HANDLERS",
    query_file: "packages/core/src/index_single_file/query_code_tree/queries/javascript.scm",
    spreads: [],
  },
  {
    language: "typescript",
    registry_file:
      "packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.typescript.ts",
    registry_symbol: "TYPESCRIPT_HANDLERS",
    query_file: "packages/core/src/index_single_file/query_code_tree/queries/typescript.scm",
    spreads: ["JAVASCRIPT_HANDLERS"],
  },
  {
    language: "python",
    registry_file:
      "packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.python.ts",
    registry_symbol: "PYTHON_HANDLERS",
    query_file: "packages/core/src/index_single_file/query_code_tree/queries/python.scm",
    spreads: [],
  },
  {
    language: "rust",
    registry_file:
      "packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.rust.ts",
    registry_symbol: "RUST_HANDLERS",
    query_file: "packages/core/src/index_single_file/query_code_tree/queries/rust.scm",
    spreads: [],
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
 * Extract the `@<name>` captures a `.scm` query emits. Only dotted, non-hidden
 * names count: tree-sitter's underscore-prefixed captures (`@_require`) and
 * bare predicate anchors (`@classmethod`) are query-internal, never dispatched.
 */
export function parse_emitted_captures(scm: string): Set<string> {
  const captures = new Set<string>();
  const re = /@([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(scm)) !== null) {
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
  source: RegistrySource;
  parsed: ParsedRegistry;
  emitted: Set<string>;
}

/**
 * Compute dead handlers and orphan captures across all registries.
 *
 * A registry entry is reachable from a query when that query emits the entry's
 * capture. An entry's feeding queries are its own registry's query plus the
 * queries of any registry that spreads it in — but only for keys the inheriting
 * registry does not override. A handler is dead when none of its feeding
 * queries emit its capture.
 *
 * Orphan captures are reported per language against that language's effective
 * registry (own keys plus inherited-and-not-overridden spread keys), scoped to
 * the definition-dispatch categories.
 */
export function check_consistency(models: RegistryModel[]): ConsistencyReport {
  const by_symbol = new Map<string, RegistryModel>();
  for (const model of models) {
    by_symbol.set(model.source.registry_symbol, model);
  }

  // For each registry symbol, the queries able to reach a given own key: its
  // own query, plus the query of every registry that spreads it in and does not
  // override the key.
  const dead_handlers: DeadHandler[] = [];
  for (const model of models) {
    const inheritors = models.filter((m) =>
      m.source.spreads.includes(model.source.registry_symbol),
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

  // Orphans: definition-family captures a language emits with no effective
  // handler. Effective keys = own keys plus keys inherited from spreads.
  const orphan_captures: OrphanCapture[] = [];
  for (const model of models) {
    const effective_keys = new Set<string>(model.parsed.keys);
    for (const symbol of model.source.spreads) {
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
  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const report = check_project(project_dir);

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
