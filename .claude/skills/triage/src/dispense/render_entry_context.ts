/**
 * Render one dispense payload as the investigator's first user message: the
 * entry, its pre-gathered evidence, its sub-threshold classifier hints and the
 * in-scope classifier rules.
 *
 * Everything static — the verdict definitions, the per-diagnosis guides, the
 * output contract — lives in the investigator's constant system prompt, which
 * every investigation shares through the prompt cache. This message carries
 * only what differs per entry, and it is bounded: each evidence list shows at
 * most `MAX_EVIDENCE_ITEMS` rows and names how many it left out, so one entry
 * with thousands of references cannot inflate every later turn's re-read.
 *
 * Paths are rendered relative to the project root, the root the investigator's
 * `read` and `grep` tools resolve against.
 */

import type {
  CallRefDiagnostic,
  ClassifierHint,
  GrepHit,
  KnownIssue,
  ReferenceSiteDiagnostic,
  SyntacticFeatures,
} from "@ariadnejs/types";

import { relativize } from "../store/paths.js";
import type { DispensePayload } from "./dispense_payload.js";
import { hints_for_diagnosis } from "./diagnosis_hints.js";

export const MAX_EVIDENCE_ITEMS = 40;

const NONE = "  (none)";

/** A grep pattern the investigator can run to reach rows a capped list left out. */
function name_pattern(name: string): string {
  return `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`;
}

function capped<T>(items: readonly T[], render: (item: T) => string, overflow: (hidden: number) => string): string {
  if (items.length === 0) return NONE;
  const shown = items.slice(0, MAX_EVIDENCE_ITEMS).map(render);
  const hidden = items.length - shown.length;
  return hidden > 0 ? [...shown, overflow(hidden)].join("\n") : shown.join("\n");
}

export function format_grep_hits(hits: readonly GrepHit[], project_path: string, name: string): string {
  return capped(
    hits,
    (h) => {
      const captured = h.captures.length > 0 ? `captured: ${h.captures.join(", ")}` : "no call reference";
      return `  ${relativize(h.file_path, project_path)}:${h.line}  [${captured}]  ${h.content.trim()}`;
    },
    (hidden) => `  … ${hidden} more; grep "${name_pattern(name)}" to list them`,
  );
}

/**
 * Non-call reference sites. The tags say HOW the name was reached, which is
 * what decides whether the reference is an invocation route. Only a property
 * access has a receiver, so only it reports one.
 */
export function format_reference_sites(
  sites: readonly ReferenceSiteDiagnostic[],
  project_path: string,
  name: string,
): string {
  return capped(
    sites,
    (s) => {
      const receiver = s.reference_kind === "property_access" ? `, receiver: ${s.receiver_kind}` : "";
      return `  ${relativize(s.file_path, project_path)}:${s.line}  [${s.reference_kind}, access: ${s.access_type}${receiver}]  ${s.content.trim()}`;
    },
    (hidden) => `  … ${hidden} more; grep "${name_pattern(name)}" to list them`,
  );
}

const SYMBOL_ID = /^(\w+):(.+):(\d+):\d+:\d+:\d+:([^:]+)$/;

/** `method:/abs/lib/a.js:41:9:41:16:close` renders as `method close at lib/a.js:41`. */
export function format_symbol_id(symbol_id: string, project_path: string): string {
  const match = SYMBOL_ID.exec(symbol_id);
  if (match === null) return symbol_id;
  const [, kind, file, line, name] = match;
  return `${kind} ${name} at ${relativize(file, project_path)}:${line}`;
}

const FEATURE_TAGS: readonly [keyof SyntacticFeatures, string][] = [
  ["is_new_expression", "new"],
  ["is_super_call", "super"],
  ["is_optional_chain", "optional-chain"],
  ["is_awaited", "awaited"],
  ["is_callback_arg", "callback-arg"],
  ["is_dynamic_dispatch", "dynamic-dispatch"],
];

/**
 * Ariadne's own call references. `failure` states the resolution stage and
 * reason verbatim, so the investigator reads which step failed instead of
 * re-deriving it from the call site.
 */
export function format_call_refs(refs: readonly CallRefDiagnostic[], project_path: string, name: string): string {
  return capped(
    refs,
    (r) => {
      const parts = [`${r.call_type} call from ${r.caller_function}`];
      if (r.receiver_kind !== "none") parts.push(`receiver: ${r.receiver_kind}`);
      parts.push(r.resolved_to.length > 0 ? `resolved to: ${r.resolved_to.map((t) => format_symbol_id(t, project_path)).join(", ")}` : "unresolved");
      if (r.resolution_failure !== null) {
        const { stage, reason, partial_info } = r.resolution_failure;
        const import_note =
          partial_info.import_specifier !== undefined
            ? `, import: ${partial_info.import_specifier}`
            : partial_info.import_target_file !== undefined
              ? `, import file: ${relativize(partial_info.import_target_file, project_path)}`
              : "";
        parts.push(`failure: ${stage}/${reason}${import_note}`);
      }
      const flags = FEATURE_TAGS.filter(([key]) => r.syntactic_features[key]).map(([, tag]) => tag);
      if (flags.length > 0) parts.push(`flags: ${flags.join(", ")}`);
      return `  ${relativize(r.caller_file, project_path)}:${r.call_line}  ${parts.join("; ")}`;
    },
    (hidden) => `  … ${hidden} more call references; grep "${name_pattern(name)}\\s*\\(" to find their sites`,
  );
}

export function format_classifier_hints(hints: readonly ClassifierHint[]): string {
  if (hints.length === 0) return "";
  return [
    "",
    "Classifier hints (registry classifiers that matched below their confidence threshold; a hint often names the exact gap):",
    ...hints.map((h) => `- ${h.group_id} (confidence ${h.confidence.toFixed(2)}): ${h.reasoning}`),
  ].join("\n");
}

export function format_registry_slice(rules: readonly KnownIssue[]): string {
  if (rules.length === 0) return NONE;
  return rules.map((r) => `- ${r.group_id}: ${r.title} — ${r.description}`).join("\n");
}

export function render_entry_context(payload: DispensePayload, project_path: string): string {
  const entry = payload.entry_context;
  const d = entry.diagnostics;
  const lines = [
    "Entry",
    `- name: ${entry.name}`,
    `- kind: ${entry.kind}; exported: ${entry.is_exported ? "yes" : "no"}; access: ${entry.access_modifier ?? "none"}`,
    `- definition: ${relativize(entry.file_path, project_path)}:${entry.start_line}`,
    `- signature: ${entry.signature ?? "none"}`,
    `- diagnosis: ${entry.diagnosis} (follow the "${hints_for_diagnosis(entry.diagnosis).title}" guide)`,
    "",
    `Grep call sites in the indexed corpus (${d.grep_call_sites.length}):`,
    format_grep_hits(d.grep_call_sites, project_path, entry.name),
    "",
    `Ariadne call references matching the name (${d.ariadne_call_refs.length}):`,
    format_call_refs(d.ariadne_call_refs, project_path, entry.name),
    "",
    `Call sites in files discovered but never indexed (${d.grep_call_sites_outside_index.length}):`,
    format_grep_hits(d.grep_call_sites_outside_index, project_path, entry.name),
    "",
    `Non-call references (${d.reference_sites.length}):`,
    format_reference_sites(d.reference_sites, project_path, entry.name),
    format_classifier_hints(entry.classifier_hints),
    "",
    `In-scope classifier rules (${payload.relevant_registry_slice.length}):`,
    format_registry_slice(payload.relevant_registry_slice),
  ];
  return lines.filter((line, i) => !(line === "" && lines[i - 1] === "")).join("\n") + "\n";
}
