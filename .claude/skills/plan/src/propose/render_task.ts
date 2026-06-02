/**
 * Pure renderers that turn a known-issue registry entry into task content —
 * a title, a markdown body, and a label set. They are deterministic feedstock:
 * the plan engine (190.22.10) renders these into `PlanTask` records in the
 * task-DB, and the user-invoked export adapter (190.22.11) reuses the same
 * builders when promoting a DB task into the user's `backlog/`. The renderers
 * persist nothing themselves.
 */

import type {
  ClassifierSpec,
  KnownIssue as SelfRepairKnownIssue,
} from "@ariadnejs/types";

export function render_task_title(issue: SelfRepairKnownIssue): string {
  return `[${issue.group_id}] ${issue.title}`;
}

export function render_task_labels(issue: SelfRepairKnownIssue): string[] {
  const labels = ["triage", "known-issue", issue.group_id];
  for (const lang of issue.languages) labels.push(`lang-${lang}`);
  return labels;
}

/**
 * Deterministic task body. Sections are omitted when their inputs are empty
 * (e.g. `observed_projects` skipped when the registry hasn't logged any yet),
 * keeping the body focused on the information actually available.
 */
export function render_task_body(issue: SelfRepairKnownIssue): string {
  const parts: string[] = [];
  parts.push(`**Group ID:** \`${issue.group_id}\``);
  parts.push(`**Status:** ${issue.status}`);
  parts.push(`**Languages:** ${issue.languages.join(", ")}`);
  parts.push("");
  parts.push("## Description");
  parts.push("");
  parts.push(issue.description);
  parts.push("");
  parts.push("## Observations");
  parts.push("");
  parts.push(`- Observed count: **${issue.observed_count ?? 0}**`);
  const projects = issue.observed_projects ?? [];
  if (projects.length > 0) {
    parts.push(`- Observed projects: ${projects.map((p) => `\`${p}\``).join(", ")}`);
  }
  if (issue.last_seen_run !== undefined && issue.last_seen_run.length > 0) {
    parts.push(`- Last seen in run: \`${issue.last_seen_run}\``);
  }
  parts.push("");
  if (issue.examples.length > 0) {
    parts.push("## Example entries");
    parts.push("");
    for (const ex of issue.examples) {
      parts.push(`- \`${ex.file}:${ex.line}\` — ${ex.snippet}`);
    }
    parts.push("");
  }
  parts.push("## Proposed classifier");
  parts.push("");
  parts.push("```json");
  parts.push(JSON.stringify(render_classifier_for_body(issue.classifier), null, 2));
  parts.push("```");
  parts.push("");
  parts.push("## Acceptance criteria");
  parts.push("");
  parts.push(
    `- [ ] Root-cause fix lands in Ariadne core — the ${issue.group_id} pattern resolves without the classifier.`,
  );
  parts.push(
    "- [ ] Remove the classifier entry from " +
      "`.claude/skills/triage/known_issues/registry.json` (or flip status to `fixed`); " +
      "the bundled core slice `packages/core/src/classify_entry_points/permanent_data.ts` " +
      "is regenerated from the source registry.",
  );
  parts.push(
    "- [ ] Add a regression test reproducing the observed examples; confirm the fix covers them.",
  );
  parts.push(
    "- [ ] Re-run the self-healing pipeline on affected corpora; confirm `observed_count` stops climbing.",
  );
  return parts.join("\n") + "\n";
}

/** Strip internal-only fields (`compiled_pattern`) so the body JSON is clean. */
function render_classifier_for_body(spec: ClassifierSpec): unknown {
  return JSON.parse(
    JSON.stringify(spec, (key, value) => (key === "compiled_pattern" ? undefined : value)),
  );
}
