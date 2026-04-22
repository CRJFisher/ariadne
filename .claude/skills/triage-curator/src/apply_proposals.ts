import * as fs from "node:fs/promises";
import * as path from "node:path";

import { DRIFT_OUTLIER_RATE_THRESHOLD } from "./detect_drift.js";
import { error_code } from "./errors.js";
import type {
  BacklogRefProposal,
  ClassifierAxis,
  ClassifierSpecProposal,
  CodeChange,
  InvestigateResponse,
  KnownIssue,
  QaResponse,
} from "./types.js";

// ===== Write-scope enforcement =====

/**
 * Any `code_changes` path emitted by the opus investigator must resolve inside
 * one of these roots. The dispatcher rejects everything else.
 */
export interface WriteScope {
  allowed_roots: string[];
}

export interface CodeChangeViolation {
  change: CodeChange;
  reason: string;
}

/**
 * Symlink-safe canonicalisation. Resolves the path through `fs.realpath`;
 * if the target (or any ancestor) does not yet exist, walks up until an
 * existing ancestor is found, realpaths it, then re-appends the non-existent
 * suffix. Ensures a symlinked allow-root parent cannot redirect writes
 * outside the allowlist.
 */
async function resolve_canonical(p: string): Promise<string> {
  try {
    return await fs.realpath(p);
  } catch (err) {
    if (error_code(err) !== "ENOENT") throw err;
    const parent = path.dirname(p);
    if (parent === p) return p;
    const parent_canonical = await resolve_canonical(parent);
    return path.join(parent_canonical, path.basename(p));
  }
}

function is_inside(child: string, parent: string): boolean {
  if (child === parent) return true;
  const rel = path.relative(parent, child);
  return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export async function validate_code_changes(
  changes: CodeChange[],
  scope: WriteScope,
): Promise<CodeChangeViolation[]> {
  const violations: CodeChangeViolation[] = [];
  const resolved_roots = await Promise.all(
    scope.allowed_roots.map((r) => resolve_canonical(path.resolve(r))),
  );

  for (const change of changes) {
    if (change.path.length === 0) {
      violations.push({ change, reason: "empty path" });
      continue;
    }
    if (!path.isAbsolute(change.path)) {
      violations.push({ change, reason: "path must be absolute" });
      continue;
    }
    const resolved = await resolve_canonical(path.resolve(change.path));
    const inside = resolved_roots.some((root) => is_inside(resolved, root));
    if (!inside) {
      violations.push({
        change,
        reason: `path is outside allowed roots: ${scope.allowed_roots.join(", ")}`,
      });
    }
  }

  return violations;
}

// ===== Response-shape validation =====

export interface ParseError {
  error: string;
}

export function parse_qa_response(raw: unknown): QaResponse | ParseError {
  if (typeof raw !== "object" || raw === null) {
    return { error: "QA response is not an object" };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.group_id !== "string" || obj.group_id.length === 0) {
    return { error: "QA response: group_id must be a non-empty string" };
  }
  if (!Array.isArray(obj.outliers)) {
    return { error: "QA response: outliers must be an array" };
  }
  for (const [idx, o] of obj.outliers.entries()) {
    if (typeof o !== "object" || o === null) {
      return { error: `QA response: outliers[${idx}] is not an object` };
    }
    const oo = o as Record<string, unknown>;
    if (typeof oo.entry_index !== "number" || !Number.isInteger(oo.entry_index)) {
      return { error: `QA response: outliers[${idx}].entry_index must be an integer` };
    }
    if (typeof oo.reason !== "string") {
      return { error: `QA response: outliers[${idx}].reason must be a string` };
    }
  }
  if (typeof obj.notes !== "string") {
    return { error: "QA response: notes must be a string" };
  }
  return {
    group_id: obj.group_id,
    outliers: obj.outliers.map((o) => {
      const oo = o as Record<string, unknown>;
      return { entry_index: oo.entry_index as number, reason: oo.reason as string };
    }),
    notes: obj.notes,
  };
}

export function parse_investigate_response(raw: unknown): InvestigateResponse | ParseError {
  if (typeof raw !== "object" || raw === null) {
    return { error: "investigate response is not an object" };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.group_id !== "string" || obj.group_id.length === 0) {
    return { error: "investigate response: group_id must be a non-empty string" };
  }

  const classifier_result = parse_classifier_proposal(obj.proposed_classifier);
  if ("error" in classifier_result) return classifier_result;

  const backlog_result = parse_backlog_ref(obj.backlog_ref);
  if ("error" in backlog_result) return backlog_result;

  if (!Array.isArray(obj.new_signals_needed)) {
    return { error: "investigate response: new_signals_needed must be an array" };
  }
  for (const [idx, s] of obj.new_signals_needed.entries()) {
    if (typeof s !== "string") {
      return { error: `investigate response: new_signals_needed[${idx}] must be a string` };
    }
  }

  if (!Array.isArray(obj.code_changes)) {
    return { error: "investigate response: code_changes must be an array" };
  }
  const code_changes: CodeChange[] = [];
  for (const [idx, c] of obj.code_changes.entries()) {
    if (typeof c !== "object" || c === null) {
      return { error: `investigate response: code_changes[${idx}] is not an object` };
    }
    const cc = c as Record<string, unknown>;
    if (typeof cc.path !== "string") {
      return { error: `investigate response: code_changes[${idx}].path must be a string` };
    }
    if (typeof cc.contents !== "string") {
      return { error: `investigate response: code_changes[${idx}].contents must be a string` };
    }
    code_changes.push({ path: cc.path, contents: cc.contents });
  }

  if (typeof obj.reasoning !== "string") {
    return { error: "investigate response: reasoning must be a string" };
  }

  return {
    group_id: obj.group_id,
    proposed_classifier: classifier_result.value,
    backlog_ref: backlog_result.value,
    new_signals_needed: obj.new_signals_needed.filter(
      (s): s is string => typeof s === "string",
    ),
    code_changes,
    reasoning: obj.reasoning,
  };
}

const DEFAULT_MIN_CONFIDENCE = 0.9;

/**
 * Mirrors `ClassifierSpec` in self-repair-pipeline. Enforces the XOR
 * between `builtin` (requires `function_name`) and `predicate` (requires
 * `axis` + `expression`); rejects fields belonging to the other branch.
 */
function parse_classifier_proposal(
  raw: unknown,
): { value: ClassifierSpecProposal | null } | ParseError {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== "object") {
    return { error: "proposed_classifier must be an object or null" };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.kind !== "none" && obj.kind !== "builtin" && obj.kind !== "predicate") {
    return { error: "proposed_classifier.kind must be 'none', 'builtin', or 'predicate'" };
  }

  if (obj.kind === "none") {
    if (obj.function_name !== undefined || obj.expression !== undefined || obj.axis !== undefined) {
      return {
        error:
          "proposed_classifier: kind='none' must not carry function_name, expression, or axis",
      };
    }
    return { value: { kind: "none" } };
  }

  const min_confidence = parse_min_confidence(obj.min_confidence);
  if (typeof min_confidence !== "number") return min_confidence;

  if (obj.kind === "builtin") {
    if (obj.expression !== undefined || obj.axis !== undefined) {
      return {
        error: "proposed_classifier: kind='builtin' must not carry 'expression' or 'axis'",
      };
    }
    if (typeof obj.function_name !== "string" || obj.function_name.length === 0) {
      return { error: "proposed_classifier: kind='builtin' requires a non-empty 'function_name'" };
    }
    return {
      value: { kind: "builtin", function_name: obj.function_name, min_confidence },
    };
  }

  // predicate
  if (obj.function_name !== undefined) {
    return { error: "proposed_classifier: kind='predicate' must not carry 'function_name'" };
  }
  if (obj.axis !== "A" && obj.axis !== "B" && obj.axis !== "C") {
    return { error: "proposed_classifier: kind='predicate' requires axis 'A', 'B', or 'C'" };
  }
  if (obj.expression === undefined || obj.expression === null) {
    return { error: "proposed_classifier: kind='predicate' requires 'expression'" };
  }
  return {
    value: {
      kind: "predicate",
      axis: obj.axis as ClassifierAxis,
      expression: obj.expression,
      min_confidence,
    },
  };
}

function parse_min_confidence(raw: unknown): number | ParseError {
  if (raw === undefined) return DEFAULT_MIN_CONFIDENCE;
  if (typeof raw !== "number") {
    return { error: "proposed_classifier.min_confidence must be a number" };
  }
  if (raw < 0 || raw > 1) {
    return { error: "proposed_classifier.min_confidence must be in [0, 1]" };
  }
  return raw;
}

function parse_backlog_ref(raw: unknown): { value: BacklogRefProposal | null } | ParseError {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== "object") return { error: "backlog_ref must be an object or null" };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.title !== "string" || obj.title.length === 0) {
    return { error: "backlog_ref.title must be a non-empty string" };
  }
  if (typeof obj.description !== "string") {
    return { error: "backlog_ref.description must be a string" };
  }
  return { value: { title: obj.title, description: obj.description } };
}

// ===== Drift tagging =====

/**
 * For each QA response whose outlier rate meets the drift threshold, flip
 * `drift_detected` to true on the matching registry entry. Pure.
 */
export function mark_drift_in_registry(
  registry: KnownIssue[],
  qa: QaResponse[],
  member_counts: Record<string, number>,
): { updated: KnownIssue[]; drift_tagged_groups: string[] } {
  const drifting = new Set<string>();
  for (const r of qa) {
    const n = member_counts[r.group_id] ?? 0;
    if (n <= 0) continue;
    if (r.outliers.length / n >= DRIFT_OUTLIER_RATE_THRESHOLD) {
      drifting.add(r.group_id);
    }
  }
  const updated = registry.map((issue) =>
    drifting.has(issue.group_id) ? { ...issue, drift_detected: true } : issue,
  );
  return { updated, drift_tagged_groups: [...drifting] };
}

// ===== Orchestrator =====

export interface ApplyOptions {
  dry_run: boolean;
  scope: WriteScope;
  registry_path: string;
}

export interface ApplyResult {
  wrote_files: string[];
  skipped_code_changes: CodeChangeViolation[];
  registry_upserts: string[];
  drift_tagged_groups: string[];
  backlog_tasks_to_create: BacklogRefProposal[];
  new_signals_needed: string[];
}

/**
 * Apply curator proposals. In `dry_run` mode no files are written; the returned
 * `ApplyResult` describes exactly what *would* have happened.
 *
 * Backlog task creation is not performed here (MCP is only available in the
 * Claude harness) — callers read `backlog_tasks_to_create` and invoke
 * `mcp__backlog__task_create` themselves.
 */
export async function apply_proposals(
  qa: QaResponse[],
  inv: InvestigateResponse[],
  member_counts: Record<string, number>,
  opts: ApplyOptions,
): Promise<ApplyResult> {
  const registry = await read_registry(opts.registry_path);

  const { updated: after_drift, drift_tagged_groups } = mark_drift_in_registry(
    registry,
    qa,
    member_counts,
  );

  const registry_upserts: string[] = [];
  let next_registry = after_drift;
  for (const r of inv) {
    if (r.proposed_classifier === null) continue;
    next_registry = upsert_classifier(next_registry, r.group_id, r.proposed_classifier);
    registry_upserts.push(r.group_id);
  }

  const canonical_registry_path = await resolve_canonical(path.resolve(opts.registry_path));

  const wrote_files: string[] = [];
  const skipped_code_changes: CodeChangeViolation[] = [];
  for (const r of inv) {
    const violations = await validate_code_changes(r.code_changes, opts.scope);
    skipped_code_changes.push(...violations);
    const allowed = r.code_changes.filter(
      (c) => !violations.some((v) => v.change === c),
    );
    for (const change of allowed) {
      // The registry is managed by the upsert path, not by free-form
      // `code_changes`. Reject any attempt to overwrite it this way — even
      // if the registry happens to live inside an allow-root.
      const canonical = await resolve_canonical(path.resolve(change.path));
      if (canonical === canonical_registry_path) {
        skipped_code_changes.push({
          change,
          reason: "registry is managed by upsert path, not code_changes",
        });
        continue;
      }
      if (!opts.dry_run) {
        await fs.mkdir(path.dirname(change.path), { recursive: true });
        await fs.writeFile(change.path, change.contents, "utf8");
        wrote_files.push(change.path);
      }
    }
  }

  const registry_mutated = drift_tagged_groups.length > 0 || registry_upserts.length > 0;
  if (!opts.dry_run && registry_mutated) {
    await fs.writeFile(
      opts.registry_path,
      JSON.stringify(next_registry, null, 2) + "\n",
      "utf8",
    );
    wrote_files.push(opts.registry_path);
  }

  const backlog_tasks_to_create = inv
    .map((r) => r.backlog_ref)
    .filter((b): b is BacklogRefProposal => b !== null);

  const new_signals_needed = [
    ...new Set(inv.flatMap((r) => r.new_signals_needed)),
  ];

  return {
    wrote_files,
    skipped_code_changes,
    registry_upserts,
    drift_tagged_groups,
    backlog_tasks_to_create,
    new_signals_needed,
  };
}

async function read_registry(registry_path: string): Promise<KnownIssue[]> {
  const raw = await fs.readFile(registry_path, "utf8");
  return JSON.parse(raw) as KnownIssue[];
}

function upsert_classifier(
  registry: KnownIssue[],
  group_id: string,
  proposal: ClassifierSpecProposal,
): KnownIssue[] {
  const existing_idx = registry.findIndex((e) => e.group_id === group_id);
  if (existing_idx === -1) {
    const placeholder: KnownIssue = {
      group_id,
      title: group_id,
      description: "Proposed by triage-curator investigator — fill in before enabling.",
      status: "wip",
      languages: [],
      examples: [],
      classifier: proposal,
    };
    return [...registry, placeholder];
  }
  const next = [...registry];
  next[existing_idx] = { ...next[existing_idx], classifier: proposal };
  return next;
}
