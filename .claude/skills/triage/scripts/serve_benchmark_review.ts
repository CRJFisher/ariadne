#!/usr/bin/env node
/**
 * Serve the benchmark review page, where a human casts the deciding vote on
 * each case by agreeing with one of the verdicts the models reached, or
 * recording that none fits.
 *
 *   node --import tsx .claude/skills/triage/scripts/serve_benchmark_review.ts [--port 4310]
 *     [--runs <run_dir,run_dir>] [--chat-model claude-opus-5-5]
 *
 * Without `--runs`, the page shows the newest benchmark run of each model.
 * Votes are written to `benchmark/v1/human_review.json` as they are cast; the
 * per-case Claude sessions are kept under
 * `~/.ariadne/triage-entrypoints/benchmark_review/chats/`.
 */

import fs from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { default_store_dir, repos_root } from "../src/store/store_layout.js";
import { list_benchmark_runs, read_replay_records, read_run_config } from "../src/benchmark/benchmark_run_store.js";
import { load_benchmark_suite } from "../src/benchmark/load_benchmark_suite.js";
import {
  DISAGREEMENT_GROUPS,
  assemble_review_case,
  model_label,
  type ModelRun,
  type ReviewCase,
} from "../src/benchmark/review/assemble_review_case.js";
import { FEEDBACK_TARGETS, read_human_review, write_case_review } from "../src/benchmark/review/human_review_store.js";
import { DEFAULT_CHAT_MODEL, ReviewChatStore, ask_review_chat } from "../src/benchmark/review/review_chat.js";
import { build_review_glossary } from "../src/benchmark/review/review_glossary.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const PAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "benchmark", "review", "page");
const PAGE_FILES: Record<string, string> = {
  "/": "review_page.html",
  "/review_page.css": "review_page.css",
  "/review_page.js": "review_page.js",
};
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4310" },
    runs: { type: "string" },
    "chat-model": { type: "string", default: DEFAULT_CHAT_MODEL },
  },
});

const suite = load_benchmark_suite();
const glossary = build_review_glossary(suite.suite_dir, suite.registry_snapshot);
const case_ids = new Set(suite.cases.map((c) => c.case.case_id));
const gold_rules = new Map(suite.cases.map((c) => [c.case.case_id, c.label.gold_rule_id]));
const chats = new ReviewChatStore(path.join(default_store_dir(), "benchmark_review", "chats"));
const chat_model = values["chat-model"];

function selected_run_dirs(): string[] {
  if (values.runs !== undefined) return values.runs.split(",").map((d) => path.resolve(d.trim()));
  const newest = new Map<string, string>();
  for (const { run_dir, config } of list_benchmark_runs()) if (!newest.has(config.model)) newest.set(config.model, run_dir);
  return [...newest.values()].sort();
}
const RUN_DIRS = selected_run_dirs();

function clone_dir(project: string): string {
  return path.join(repos_root(default_store_dir()), project);
}

function current_model_runs(): { runs: ModelRun[]; status: object[] } {
  const runs: ModelRun[] = [];
  const status: object[] = [];
  for (const run_dir of RUN_DIRS) {
    const config = read_run_config(run_dir);
    const records = read_replay_records(run_dir);
    runs.push({ model: config.model, records });
    status.push({
      model: config.model,
      label: model_label(config.model),
      run_id: config.run_id,
      recorded: records.length,
      expected: config.case_ids.length * config.repeats,
      usd: records.reduce((t, r) => t + (r.usage?.usd ?? 0), 0),
      answer_key_exposures: records.filter((r) => r.saw_answer_key).length,
    });
  }
  return { runs, status };
}

function assemble_all(): ReviewCase[] {
  const { runs } = current_model_runs();
  return suite.cases.map((labelled) =>
    assemble_review_case({ labelled, clone_dir: clone_dir(labelled.case.project), model_runs: runs, rules: suite.registry_snapshot, gold_rules }),
  );
}

function send_json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function read_body(req: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return JSON.parse(body);
}

async function handle_chat(req: IncomingMessage, res: ServerResponse, case_id: string): Promise<void> {
  const body = await read_body(req);
  if (typeof body !== "object" || body === null) throw new Error("chat request must be an object");
  const fields = new Map<string, unknown>(Object.entries(body));
  const question = fields.get("question");
  if (typeof question !== "string" || question.trim().length === 0) throw new Error("question must be a non-empty string");
  const labelled = suite.cases.find((c) => c.case.case_id === case_id);
  if (labelled === undefined) throw new Error(`no such case ${case_id}`);
  const review = assemble_review_case({
    labelled,
    clone_dir: clone_dir(labelled.case.project),
    model_runs: current_model_runs().runs,
    rules: suite.registry_snapshot,
    gold_rules,
  });
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
  const draft = fields.get("draft");
  const selection = fields.get("selection");
  for await (const event of ask_review_chat({
    review,
    clone_dir: clone_dir(labelled.case.project),
    question,
    view: { draft: typeof draft === "string" ? draft : "", selection: typeof selection === "string" ? selection : "" },
    glossary,
    model: chat_model,
    store: chats,
  })) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const page_file = PAGE_FILES[url.pathname];
  if (req.method === "GET" && page_file !== undefined) {
    res.writeHead(200, { "content-type": CONTENT_TYPES[path.extname(page_file)], "cache-control": "no-store" });
    res.end(fs.readFileSync(path.join(PAGE_DIR, page_file)));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/cases") {
    return send_json(res, 200, {
      cases: assemble_all(),
      groups: DISAGREEMENT_GROUPS,
      glossary,
      runs: current_model_runs().status,
      feedback_targets: FEEDBACK_TARGETS,
      chat_model: model_label(chat_model),
    });
  }
  if (req.method === "GET" && url.pathname === "/api/review") return send_json(res, 200, read_human_review(suite.suite_dir));
  const review_match = url.pathname.match(/^\/api\/review\/([^/]+)$/);
  if (req.method === "PUT" && review_match !== null) {
    const case_id = decodeURIComponent(review_match[1]);
    return send_json(res, 200, write_case_review(suite.suite_dir, case_ids, case_id, await read_body(req)));
  }
  const chat_match = url.pathname.match(/^\/api\/chat\/([^/]+)$/);
  if (chat_match !== null) {
    const case_id = decodeURIComponent(chat_match[1]);
    if (!case_ids.has(case_id)) return send_json(res, 404, { error: `no such case ${case_id}` });
    if (req.method === "GET") return send_json(res, 200, chats.read(case_id));
    if (req.method === "DELETE") {
      chats.clear(case_id);
      return send_json(res, 200, chats.read(case_id));
    }
    if (req.method === "POST") return handle_chat(req, res, case_id);
  }
  send_json(res, 404, { error: "not found" });
}

createServer((req, res) => {
  route(req, res).catch((err: unknown) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    send_json(res, 400, { error: err instanceof Error ? err.message : String(err) });
  });
}).listen(Number(values.port), "127.0.0.1", () => {
  process.stdout.write(`Benchmark review at http://127.0.0.1:${values.port}/\n`);
  for (const run_dir of RUN_DIRS) process.stdout.write(`  verdicts from ${run_dir}\n`);
  process.stdout.write(`  votes are written to ${path.join(suite.suite_dir, "human_review.json")}\n`);
});
