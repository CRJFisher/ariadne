#!/usr/bin/env node
/**
 * SessionStart hook: verify this machine can actually run Ariadne's pipeline.
 *
 * Ariadne parses a codebase with native tree-sitter bindings and resolves it
 * into a call graph. Every check here guards one step of that pipeline, and a
 * mismatch costs the user the whole capability — no parse, no call graph, no
 * entry points — usually behind an error that names a package manager rather
 * than the requirement it broke.
 *
 * WHY plain .mjs with zero imports outside node: builtins — every other hook in
 * this repo runs through `pnpm exec tsx`, which is precisely what a stale Node
 * breaks (pnpm 11 exits before running anything below Node 22.13). A checker
 * that ran that way would be silenced by the fault it exists to report, so this
 * one needs nothing but the `node` on PATH.
 *
 * WHY try/catch -> exit 0: SessionStart runs before every turn in the repo. A
 * crashing checker must degrade to a visible note, never wedge the session.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * @typedef {object} Facts
 * @property {string} node_version        Running Node, e.g. "v22.23.2".
 * @property {string} node_abi            NODE_MODULE_VERSION the natives must match.
 * @property {string} node_required       Range from package.json "engines.node".
 * @property {string} pnpm_required       Version from package.json "packageManager".
 * @property {string} pnpm_found          Version of the pnpm on PATH, "" if it did not run.
 * @property {string} pnpm_error          Why pnpm did not run, "" if it did.
 * @property {boolean} modules_present    Does node_modules/ exist at the root?
 * @property {string} modules_written_by  pnpm version that wrote node_modules, "" if unknown.
 * @property {ParserFacts} parsers        State of the native tree-sitter stack.
 */

/**
 * @typedef {object} ParserFacts
 * @property {{name: string, required: string, found: string}[]} packages
 * @property {boolean} parsed             Did a real parse succeed under this Node?
 * @property {string} parse_error         Failure text, "" when `parsed` is true.
 */

/**
 * @typedef {object} Check
 * @property {string} label
 * @property {boolean} ok
 * @property {string} required
 * @property {string} found
 * @property {string} why      What the user loses when this check fails.
 * @property {string} fix      Commands that resolve it.
 */

/** The parsers Ariadne loads to build a call graph, in `packages/core`. */
const PARSER_PACKAGES = [
  "tree-sitter",
  "tree-sitter-javascript",
  "tree-sitter-python",
  "tree-sitter-rust",
  "tree-sitter-typescript",
];

/**
 * Comparison of dotted numeric versions; prerelease tags are ignored.
 * @param {string} left
 * @param {string} right
 * @returns {number} -1, 0 or 1
 */
export function compare_versions(left, right) {
  /** @param {string} v @returns {number[]} */
  const parts = (v) =>
    String(v)
      .replace(/^v/, "")
      .split("-")[0]
      .split(".")
      .map((n) => Number.parseInt(n, 10) || 0);
  const a = parts(left);
  const b = parts(right);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Test a version against a space-separated conjunction of comparators, the one
 * range form this repo's "engines.node" uses (e.g. ">=22.13.0 <23.0.0").
 *
 * WHY it throws on anything else: a range this cannot read must fail loudly at
 * the point someone widens it, rather than quietly passing every Node version.
 *
 * @param {string} version
 * @param {string} range
 * @returns {boolean}
 */
export function satisfies_range(version, range) {
  const terms = String(range).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) throw new Error(`empty version range`);
  return terms.every((term) => {
    const match = /^(>=|<=|>|<|=)?(\d+(?:\.\d+)*)$/.exec(term);
    if (!match) {
      throw new Error(
        `unsupported comparator "${term}" in range "${range}" — verify_toolchain.mjs reads only >=, >, <=, <, = joined by spaces`,
      );
    }
    const [, operator = "=", bound] = match;
    const order = compare_versions(version, bound);
    if (operator === ">=") return order >= 0;
    if (operator === ">") return order > 0;
    if (operator === "<=") return order <= 0;
    if (operator === "<") return order < 0;
    return order === 0;
  });
}

/** Turn collected facts into the four capability checks, worst first. */
export function evaluate_toolchain(/** @type {Facts} */ facts) {
  /** @type {Check[]} */
  const checks = [];

  let node_ok;
  let node_required = facts.node_required;
  try {
    node_ok = satisfies_range(facts.node_version, facts.node_required);
  } catch (err) {
    node_ok = false;
    node_required = `${facts.node_required} (unreadable: ${err instanceof Error ? err.message : String(err)})`;
  }
  checks.push({
    label: "Node.js",
    ok: node_ok,
    required: node_required,
    found: facts.node_version,
    why:
      `pnpm ${facts.pnpm_required} exits before it runs anything below Node 22.13, which takes install, build, ` +
      `test and every \`pnpm exec\` hook in this repo with it. The upper bound is tree-sitter: its binding.gyp ` +
      `pins CLANG_CXX_LANGUAGE_STANDARD to c++17, while Node 23+ headers use C++20 \`requires\` clauses, so the ` +
      `native parser fails to compile against them (verified against Node 24.19.0).`,
    fix: "nvm install 22 && nvm use 22    # .nvmrc pins the major",
  });

  checks.push({
    label: "pnpm",
    ok: facts.pnpm_found !== "" && facts.pnpm_found === facts.pnpm_required,
    required: `${facts.pnpm_required} exactly (package.json "packageManager")`,
    found: facts.pnpm_found === "" ? `did not run — ${facts.pnpm_error}` : facts.pnpm_found,
    why:
      `The pin names the pnpm that wrote pnpm-lock.yaml. A different one relinks the workspace its own way, and ` +
      `pnpm's own version switch cannot cover for it here: fetching the pinned build needs @pnpm/exe in the ` +
      `lockfile, which this repo does not carry.`,
    fix: `npm install -g pnpm@${facts.pnpm_required}`,
  });

  checks.push({
    label: "Workspace install",
    ok: facts.modules_present && facts.modules_written_by === facts.pnpm_required,
    required: `node_modules/ written by pnpm ${facts.pnpm_required}`,
    found: !facts.modules_present
      ? "node_modules/ is absent"
      : facts.modules_written_by === ""
        ? "node_modules/ present, writing pnpm unknown"
        : `written by pnpm ${facts.modules_written_by}`,
    why:
      `Ariadne's own hooks run through \`pnpm exec tsx\`, so an absent or foreign install disables the guardrails ` +
      `on every edit. pnpm will not silently rebuild a tree a different major wrote — non-interactively it aborts ` +
      `with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY and no command in the repo runs.`,
    fix: "rm -rf node_modules packages/*/node_modules && pnpm install",
  });

  const drifted = facts.parsers.packages.filter((p) => p.found !== p.required);
  checks.push({
    label: "tree-sitter parsers",
    ok: drifted.length === 0 && facts.parsers.parsed,
    required: `${facts.parsers.packages.map((p) => `${p.name}@${p.required}`).join(", ")}, loading under ABI ${facts.node_abi}`,
    found: !facts.parsers.parsed
      ? `parse failed — ${facts.parsers.parse_error}`
      : drifted.length > 0
        ? drifted.map((p) => `${p.name}@${p.found || "missing"}`).join(", ")
        : `all ${facts.parsers.packages.length} pinned, parse OK`,
    why:
      `These are the compiled parsers the whole product stands on — no parse means no scopes, no references, no ` +
      `call graph and no entry points. They are built against the Node that installed them, and a mismatch does ` +
      `not raise a catchable error: loading one segfaults the process outright. The versions are pinned exactly ` +
      `because grammar changes move the node types the queries match on.`,
    fix: "pnpm install    # rebuilds the native bindings for the running Node; needs Xcode CLT on macOS",
  });

  return checks;
}

/** Render the failing checks as the message the user and the agent both read. */
export function format_report(/** @type {Check[]} */ checks) {
  const failed = checks.filter((c) => !c.ok);
  if (failed.length === 0) return "";

  const lines = [
    `Ariadne toolchain check: ${failed.length} of ${checks.length} requirements not met.`,
    "",
    "Ariadne detects call graphs by parsing source with native tree-sitter bindings.",
    "Each requirement below guards one step of that pipeline.",
    "",
  ];

  for (const check of failed) {
    lines.push(`  FAIL  ${check.label}`);
    lines.push(`        required  ${check.required}`);
    lines.push(`        found     ${check.found}`);
    for (const [i, line] of wrap(check.why, 74).entries()) {
      lines.push(`        ${i === 0 ? "why      " : "         "} ${line}`);
    }
    lines.push(`        fix       ${check.fix}`);
    lines.push("");
  }

  const passed = checks.filter((c) => c.ok);
  if (passed.length > 0) {
    lines.push(`  OK    ${passed.map((c) => c.label).join(" · ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Greedy wrap so the long "why" prose stays readable in a terminal.
 * @param {string} text
 * @param {number} width
 * @returns {string[]}
 */
export function wrap(text, width) {
  /** @type {string[]} */
  const lines = [];
  let current = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (current === "") current = word;
    else if (current.length + 1 + word.length <= width) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

/**
 * Read a JSON file, returning an empty object when it is absent or malformed.
 * @param {string} file
 * @returns {any}
 */
function read_json(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

/**
 * @param {string} project_dir
 * @returns {Facts}
 */
function collect_facts(project_dir) {
  const root_manifest = read_json(path.join(project_dir, "package.json"));
  const pnpm_required = String(root_manifest.packageManager ?? "").replace(/^pnpm@/, "");

  const pnpm_probe = spawnSync("pnpm", ["--version"], { encoding: "utf8", timeout: 20000 });
  const pnpm_found = pnpm_probe.status === 0 ? String(pnpm_probe.stdout).trim() : "";
  const pnpm_error =
    pnpm_found !== ""
      ? ""
      : String(pnpm_probe.stderr || pnpm_probe.error?.message || "pnpm not found on PATH")
          .trim()
          .split("\n")
          .filter((l) => l.trim() !== "")
          .slice(0, 2)
          .join(" ");

  const modules_dir = path.join(project_dir, "node_modules");
  const modules_state = path.join(modules_dir, ".modules.yaml");
  const written_by = existsSync(modules_state)
    ? (/packageManager["']?\s*:\s*["']?pnpm@([^"'\s,]+)/.exec(readFileSync(modules_state, "utf8"))?.[1] ?? "")
    : "";

  return {
    node_version: process.version,
    node_abi: process.versions.modules,
    node_required: String(root_manifest.engines?.node ?? ""),
    pnpm_required,
    pnpm_found,
    pnpm_error,
    modules_present: existsSync(modules_dir),
    modules_written_by: written_by,
    parsers: collect_parser_facts(project_dir),
  };
}

/**
 * @param {string} project_dir
 * @returns {ParserFacts}
 */
function collect_parser_facts(project_dir) {
  const core_manifest_path = path.join(project_dir, "packages", "core", "package.json");
  const pinned = read_json(core_manifest_path).dependencies ?? {};
  const require_from_core = createRequire(core_manifest_path);

  const packages = PARSER_PACKAGES.map((name) => {
    let found = "";
    try {
      found = String(require_from_core(`${name}/package.json`).version ?? "");
    } catch {
      found = "";
    }
    return { name, required: String(pinned[name] ?? ""), found };
  });

  const probe = probe_parse(path.dirname(core_manifest_path));
  return { packages, parsed: probe.parsed, parse_error: probe.parse_error };
}

/**
 * Parse a snippet in a child process, the only safe way to ask the question.
 *
 * WHY not in-process: a binding built against another Node does not throw. It
 * segfaults on dlopen and takes the whole process down — verified by loading a
 * Node 22.23.2 build under Node 22.5.1 — so an in-process probe would kill this
 * checker at exactly the moment it has something to report.
 *
 * @param {string} core_dir
 * @returns {{parsed: boolean, parse_error: string}}
 */
function probe_parse(core_dir) {
  const script =
    "const Parser = require('tree-sitter');" +
    "const parser = new Parser();" +
    "parser.setLanguage(require('tree-sitter-typescript').typescript);" +
    "if (parser.parse('function main() { return 1; }').rootNode.type !== 'program') {" +
    "  console.error('parser returned an unexpected root node'); process.exit(3);" +
    "}";
  const probe = spawnSync(process.execPath, ["-e", script], {
    cwd: core_dir,
    encoding: "utf8",
    timeout: 20000,
  });

  if (probe.status === 0) return { parsed: true, parse_error: "" };
  if (probe.signal) {
    return {
      parsed: false,
      parse_error:
        `loading the parser crashed with ${probe.signal} — these bindings were compiled for a different ` +
        `Node build than ${process.version}`,
    };
  }
  const detail = distill_probe_error(String(probe.stderr || probe.error?.message || ""));
  return { parsed: false, parse_error: detail };
}

/**
 * Reduce a child process's crash dump to the one line that names the cause.
 *
 * WHY: Node prints the internal loader frame before the message, so taking the
 * first line reports "node:internal/modules/cjs/loader:1433" — a location, when
 * what the user needs is "Cannot find module 'tree-sitter'".
 *
 * @param {string} stderr
 * @returns {string}
 */
export function distill_probe_error(stderr) {
  const lines = String(stderr)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("at "));
  const named = lines.find((line) => /^[A-Za-z]*Error: /.test(line));
  if (named) return named.replace(/^[A-Za-z]*Error: /, "");
  return lines[0] ?? "the parser did not load";
}

function main() {
  const project_dir =
    process.env.CLAUDE_PROJECT_DIR ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

  const report = format_report(evaluate_toolchain(collect_facts(project_dir)));
  if (report === "") return;

  process.stdout.write(
    `${JSON.stringify({
      systemMessage: report,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          `${report}\nTell the user the toolchain is wrong and what fixes it before doing any work that ` +
          `depends on installing, building, testing, or parsing in this repo.`,
      },
    })}\n`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    main();
  } catch (err) {
    process.stdout.write(
      `${JSON.stringify({
        systemMessage: `Ariadne toolchain check could not run: ${err instanceof Error ? err.message : String(err)}`,
      })}\n`,
    );
  }
}
