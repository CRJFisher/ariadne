/**
 * Append-only JSONL log of `triage-coordinator` decisions for one run.
 *
 * One line per coordinator invocation. Used by the curator's drift analysis to
 * audit how the coordinator routed novel verdicts: which were merged, which
 * registered new, which flagged.
 *
 * The dispatcher is the only writer per absorb (serialized via the in-process
 * mutex in `absorb_verdict.ts`); this surface is append-only and never
 * rewritten.
 */

import * as fs from "node:fs/promises";

import {
  assert_keys,
  describe,
  expect_object,
} from "../verdict/strict_parse.js";
import {
  parse_coordinator_decision,
  type CoordinatorDecision,
} from "./coordinator_decision.js";
import {
  parse_triage_verdict,
  type NovelVerdict,
} from "../verdict/triage_verdict.js";

export interface CoordinatorLogEntry {
  timestamp: string;
  entry_index: number;
  verdict: NovelVerdict;
  decision: CoordinatorDecision;
}

/**
 * Append one coordinator decision to the log. Each call writes exactly one
 * `JSON.stringify(entry) + "\n"`. The caller is responsible for serializing
 * concurrent appends — `absorb_verdict.ts` does this via a per-path mutex.
 */
export async function append_coordinator_log_entry(
  log_path: string,
  entry: CoordinatorLogEntry,
): Promise<void> {
  const line = `${JSON.stringify(entry)}\n`;
  await fs.appendFile(log_path, line, "utf8");
}

/**
 * Read every entry from the log, validating each line through the strict
 * verdict + decision parsers. Returns `[]` if the file does not exist.
 */
export async function read_coordinator_log(
  log_path: string,
): Promise<CoordinatorLogEntry[]> {
  let raw: string;
  try {
    raw = await fs.readFile(log_path, "utf8");
  } catch (err) {
    if (is_enoent(err)) return [];
    throw err;
  }
  const lines = raw.split("\n").filter((l) => l.length > 0);
  return lines.map((line, idx) =>
    parse_coordinator_log_entry(JSON.parse(line), `coordinator_log[${idx}]`),
  );
}

function parse_coordinator_log_entry(
  raw: unknown,
  ctx: string,
): CoordinatorLogEntry {
  const obj = expect_object(raw, ctx);
  assert_keys(obj, ["timestamp", "entry_index", "verdict", "decision"], ctx);
  const timestamp = obj["timestamp"];
  if (typeof timestamp !== "string" || timestamp.length === 0) {
    throw new Error(
      `${ctx}.timestamp: must be a non-empty string, got ${describe(timestamp)}`,
    );
  }
  const entry_index = obj["entry_index"];
  if (
    typeof entry_index !== "number" ||
    !Number.isInteger(entry_index) ||
    entry_index < 0
  ) {
    throw new Error(
      `${ctx}.entry_index: must be a non-negative integer, got ${describe(entry_index)}`,
    );
  }
  const verdict = parse_triage_verdict(obj["verdict"]);
  if (verdict.kind !== "fp-novel-new" && verdict.kind !== "fp-novel-cited") {
    throw new Error(
      `${ctx}.verdict: kind '${verdict.kind}' is not a novel verdict; log entries are only created for fp-novel-* verdicts`,
    );
  }
  return {
    timestamp,
    entry_index,
    verdict,
    decision: parse_coordinator_decision(obj["decision"]),
  };
}

function is_enoent(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if (!("code" in err)) return false;
  return (err as { code: unknown }).code === "ENOENT";
}
