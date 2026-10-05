/**
 * The check runs the real TypeScript compiler against a two-package checkout
 * laid out as this repository's is, because what it relies on — that a touched
 * but unchanged file leaves a build current — is TypeScript's behaviour, not
 * this module's.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assert_builds_current } from "./build_freshness";

const TSC = require.resolve("typescript/bin/tsc");
const TYPESCRIPT_PACKAGE = path.dirname(path.dirname(TSC));

const FILES: Record<string, string> = {
  "packages/types/tsconfig.build.json": JSON.stringify({
    compilerOptions: { outDir: "./dist", rootDir: "./src", composite: true, module: "commonjs" },
    include: ["src/**/*"],
    exclude: ["src/**/*.test.ts"],
  }),
  "packages/types/src/index.ts": "export const KIND = 1;\n",
  "packages/core/tsconfig.build.json": JSON.stringify({
    compilerOptions: { outDir: "./dist", rootDir: "./src", composite: true, module: "commonjs" },
    include: ["src/**/*.ts"],
    exclude: ["src/**/*.test.ts", "src/benchmark_corpus_load/**"],
    references: [{ path: "../types/tsconfig.build.json" }],
  }),
  "packages/core/src/index.ts": "export const CORE = 1;\n",
  "packages/core/src/index.test.ts": "export const TESTED = 1;\n",
  "packages/core/src/benchmark_corpus_load/arm.ts": "export const ARM = 1;\n",
  "packages/core/src/dispatch_to_workers/worker_entry.ts": "export const WORKER = 1;\n",
  "packages/core/src/index_single_file/query_code_tree/queries/rust.scm": "(identifier) @x\n",
};

let built_checkout: string;
const checkouts: string[] = [];

/** A fresh copy of the built checkout, timestamps kept, so each case starts current. */
function fresh_checkout(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "build-freshness-")));
  fs.cpSync(built_checkout, root, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true });
  checkouts.push(root);
  return root;
}

/** Rewrite a file one second later than anything the build wrote, the way an editor or `git checkout` does. */
function rewrite(root: string, relative: string, content: string): void {
  const file = path.join(root, relative);
  fs.writeFileSync(file, content);
  const later = new Date(Date.now() + 1000);
  fs.utimesSync(file, later, later);
}

function refusal(root: string): string {
  try {
    assert_builds_current(root);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

beforeAll(() => {
  built_checkout = fs.mkdtempSync(path.join(os.tmpdir(), "build-freshness-template-"));
  for (const [relative, content] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(built_checkout, relative)), { recursive: true });
    fs.writeFileSync(path.join(built_checkout, relative), content);
  }
  fs.mkdirSync(path.join(built_checkout, "node_modules"));
  fs.symlinkSync(TYPESCRIPT_PACKAGE, path.join(built_checkout, "node_modules", "typescript"));

  const core_dir = path.join(built_checkout, "packages", "core");
  execFileSync(process.execPath, [TSC, "-b", "tsconfig.build.json"], { cwd: core_dir });
  const queries = path.join("index_single_file", "query_code_tree", "queries");
  fs.mkdirSync(path.join(core_dir, "dist", queries), { recursive: true });
  fs.copyFileSync(path.join(core_dir, "src", queries, "rust.scm"), path.join(core_dir, "dist", queries, "rust.scm"));
}, 60_000);

afterAll(() => {
  for (const root of [built_checkout, ...checkouts]) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("assert_builds_current", () => {
  it("passes a checkout built from its current source", () => {
    expect(refusal(fresh_checkout())).toEqual("");
  });

  it("passes a checkout whose source was touched but not changed", () => {
    const root = fresh_checkout();
    rewrite(root, "packages/core/src/index.ts", FILES["packages/core/src/index.ts"]);
    rewrite(root, "packages/types/src/index.ts", FILES["packages/types/src/index.ts"]);
    expect(refusal(root)).toEqual("");
  });

  it("passes a checkout whose only edits are to tests and to files the build excludes", () => {
    const root = fresh_checkout();
    rewrite(root, "packages/core/src/index.test.ts", "export const TESTED = 2;\n");
    rewrite(root, "packages/core/src/benchmark_corpus_load/arm.ts", "export const ARM = 2;\n");
    expect(refusal(root)).toEqual("");
  });

  it("refuses an edited core source, naming core and its rebuild", () => {
    const root = fresh_checkout();
    rewrite(root, "packages/core/src/index.ts", "export const CORE = 2;\n");
    expect(refusal(root)).toEqual(
      [
        `The checkout at ${root} has builds that do not match its source, so an arm on it would measure another tree's code:`,
        "  packages/core: its compiled output does not match its source",
        "Rebuild with:",
        `  (cd ${path.join(root, "packages/core")} && npm run build)`,
      ].join("\n")
    );
  });

  it("refuses an edited types source, leaving core current while the declarations it compiles against are unchanged", () => {
    const root = fresh_checkout();
    rewrite(root, "packages/types/src/index.ts", "export const KIND = 2;\n");
    expect(refusal(root)).toEqual(
      [
        `The checkout at ${root} has builds that do not match its source, so an arm on it would measure another tree's code:`,
        "  packages/types: its compiled output does not match its source",
        "Rebuild with:",
        `  (cd ${path.join(root, "packages/types")} && npm run build)`,
      ].join("\n")
    );
  });

  it("rebuilds types before the core that compiles against it when both are stale", () => {
    const root = fresh_checkout();
    rewrite(root, "packages/core/src/index.ts", "export const CORE = 2;\n");
    rewrite(root, "packages/types/src/index.ts", "export const KIND = 2;\n");
    expect(refusal(root)).toEqual(
      [
        `The checkout at ${root} has builds that do not match its source, so an arm on it would measure another tree's code:`,
        "  packages/types: its compiled output does not match its source",
        "  packages/core: its compiled output does not match its source",
        "Rebuild with:",
        `  (cd ${path.join(root, "packages/types")} && npm run build)`,
        `  (cd ${path.join(root, "packages/core")} && npm run build)`,
      ].join("\n")
    );
  });

  it("refuses a checkout missing its built worker entry", () => {
    const root = fresh_checkout();
    fs.rmSync(path.join(root, "packages/core/dist/dispatch_to_workers/worker_entry.js"));
    expect(refusal(root)).toContain(
      "  packages/core: it has no built worker entry at dist/dispatch_to_workers/worker_entry.js"
    );
  });

  it("refuses a query file whose built copy differs from its source", () => {
    const root = fresh_checkout();
    rewrite(root, "packages/core/src/index_single_file/query_code_tree/queries/rust.scm", "(self) @x\n");
    expect(refusal(root)).toEqual(
      [
        `The checkout at ${root} has builds that do not match its source, so an arm on it would measure another tree's code:`,
        "  packages/core: its built copy of rust.scm does not match the source",
        "Rebuild with:",
        `  (cd ${path.join(root, "packages/core")} && npm run build)`,
      ].join("\n")
    );
  });
});
