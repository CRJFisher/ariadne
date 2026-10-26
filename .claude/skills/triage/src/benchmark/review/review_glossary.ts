/**
 * The vocabulary a reviewer needs to judge a case, read from the documents
 * that define it: verdict kinds and pitfalls from the suite's `ADJUDICATE.md`,
 * diagnosis routes from the investigator's diagnosis hints, and classifier
 * rules from the registry snapshot the labels were graded against.
 */

import fs from "node:fs";
import path from "node:path";

import type { KnownIssue } from "@ariadnejs/types";

import { DIAGNOSIS_HINTS, GENERIC_HINTS } from "../../dispense/diagnosis_hints.js";
import { VERDICT_KINDS, type VerdictKind } from "../load_benchmark_suite.js";

/** The route detection assigns when grep finds no call sites; it has no hints of its own. */
const UNROUTED_DIAGNOSIS = "no-textual-callers";

export interface GlossaryTerm {
  title: string;
  text: string;
}

export interface ReviewGlossary {
  kinds: Record<VerdictKind, string>;
  real_caller: string;
  pitfalls: GlossaryTerm[];
  diagnoses: Record<string, GlossaryTerm>;
  rules: Record<string, GlossaryTerm & { languages: string[] }>;
}

function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n## ${heading}`);
  if (start === -1) throw new Error(`ADJUDICATE.md has no "## ${heading}" section`);
  const rest = markdown.slice(start + 1);
  const end = rest.indexOf("\n## ", 1);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Parse `- **<term>**: text` bullets; the term may be wrapped in backticks. */
function bullets(text: string): GlossaryTerm[] {
  return [...text.matchAll(/^- \*\*`?([^*`]+?)`?\.?\*\*:?\s*(.+)$/gm)].map(([, title, body]) => ({ title, text: body.trim() }));
}

export function parse_adjudication_terms(markdown: string): Pick<ReviewGlossary, "kinds" | "real_caller" | "pitfalls"> {
  const definitions = section(markdown, "Verdict definitions");
  const by_kind = new Map(bullets(definitions).map((t) => [t.title, t.text]));
  const kinds = Object.fromEntries(
    VERDICT_KINDS.map((kind) => {
      const text = by_kind.get(kind);
      if (text === undefined) throw new Error(`ADJUDICATE.md does not define verdict kind ${kind}`);
      return [kind, text];
    }),
  ) as Record<VerdictKind, string>;
  const real_caller = definitions.match(/^A "real caller" is .+$/m)?.[0];
  if (real_caller === undefined) throw new Error("ADJUDICATE.md does not define a \"real caller\"");
  const pitfalls_at = definitions.indexOf("Pitfalls:");
  return { kinds, real_caller, pitfalls: pitfalls_at === -1 ? [] : bullets(definitions.slice(pitfalls_at)) };
}

export function build_review_glossary(suite_dir: string, rules: readonly KnownIssue[]): ReviewGlossary {
  const terms = parse_adjudication_terms(fs.readFileSync(path.join(suite_dir, "ADJUDICATE.md"), "utf8"));
  const diagnoses: Record<string, GlossaryTerm> = {
    [UNROUTED_DIAGNOSIS]: { title: "No Textual Callers", text: GENERIC_HINTS.summary },
  };
  for (const [name, hints] of Object.entries(DIAGNOSIS_HINTS)) diagnoses[name] = { title: hints.title, text: hints.summary };
  return {
    ...terms,
    diagnoses,
    rules: Object.fromEntries(
      rules.map((r) => [r.group_id, { title: r.title, text: r.description, languages: [...r.languages] }]),
    ),
  };
}
