/**
 * Assemble the full task body for an Ariadne-bug backlog task. Called from
 * `apply_proposals` so finalize's emitted `AriadneBugTaskToCreate.description`
 * is the exact body Step 6b files (no extra templating in the main agent).
 *
 * The body combines:
 *   - the investigator's narrative (from `InvestigateResponse.ariadne_bug.description`)
 *   - registry bookkeeping (`observed_count`, `observed_projects`, `last_seen_run`)
 *   - example entry links pulled from the source false-positive group
 *   - the proposed classifier spec that will serve as the workaround
 *   - a deterministic acceptance-criteria checklist
 */

import type { FalsePositiveGroup, InvestigateResponse, KnownIssue } from "./types.js";

export interface RenderAriadneBugBodyInput {
  response: InvestigateResponse;
  group: FalsePositiveGroup | undefined;
  target_entry: KnownIssue | undefined;
  /** Project name of the source run — included in body even if not yet in `observed_projects`. */
  current_project: string;
}

export function render_ariadne_bug_body(input: RenderAriadneBugBodyInput): string {
  const bug = input.response.ariadne_bug;
  if (bug === null) {
    throw new Error(
      `render_ariadne_bug_body called with null ariadne_bug for group ${input.response.group_id}`,
    );
  }
  const target_group_id = input.response.retargets_to ?? input.response.group_id;
  const parts: string[] = [];
  parts.push(`**Root cause category:** \`${bug.root_cause_category}\``);
  parts.push(`**Target registry entry:** \`${target_group_id}\``);
  parts.push("");
  parts.push("## Description");
  parts.push("");
  parts.push(bug.description);
  parts.push("");
  parts.push(render_observations(input));
  const examples = render_examples(input.group);
  if (examples !== null) {
    parts.push(examples);
  }
  parts.push(render_classifier_spec(input.response));
  parts.push(render_acceptance_criteria(target_group_id));
  parts.push("");
  parts.push("## Investigator reasoning");
  parts.push("");
  parts.push(input.response.reasoning);
  return parts.join("\n").trimEnd() + "\n";
}

function render_observations(input: RenderAriadneBugBodyInput): string {
  const count = input.target_entry?.observed_count ?? 0;
  const prior_projects = input.target_entry?.observed_projects ?? [];
  const projects = prior_projects.includes(input.current_project)
    ? prior_projects
    : [...prior_projects, input.current_project];
  const lines = ["## Observations", ""];
  lines.push(`- Observed count: **${count}**`);
  if (projects.length > 0) {
    lines.push(`- Observed projects: ${projects.map((p) => `\`${p}\``).join(", ")}`);
  }
  if (input.target_entry?.last_seen_run !== undefined && input.target_entry.last_seen_run.length > 0) {
    lines.push(`- Last seen in run: \`${input.target_entry.last_seen_run}\``);
  }
  lines.push("");
  return lines.join("\n");
}

const EXAMPLE_LIMIT = 5;

function render_examples(group: FalsePositiveGroup | undefined): string | null {
  if (group === undefined || group.entries.length === 0) return null;
  const lines = ["## Example entries", ""];
  const examples = group.entries.slice(0, EXAMPLE_LIMIT);
  for (const e of examples) {
    lines.push(`- \`${e.file_path}:${e.start_line}\` — ${e.name}`);
  }
  if (group.entries.length > EXAMPLE_LIMIT) {
    lines.push(`- …and ${group.entries.length - EXAMPLE_LIMIT} more.`);
  }
  lines.push("");
  return lines.join("\n");
}

function render_classifier_spec(response: InvestigateResponse): string {
  const lines = ["## Proposed classifier (workaround)", ""];
  if (response.proposed_classifier === null) {
    lines.push("_No classifier proposed — this task tracks the root-cause fix directly._");
    lines.push("");
    return lines.join("\n");
  }
  lines.push("```json");
  lines.push(JSON.stringify(response.classifier_spec ?? response.proposed_classifier, null, 2));
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

function render_acceptance_criteria(target_group_id: string): string {
  return [
    "## Acceptance criteria",
    "",
    `- [ ] Root cause is fixed in Ariadne core — the \`${target_group_id}\` pattern resolves without the classifier.`,
    "- [ ] Regression test reproducing the example entries lands and passes.",
    `- [ ] Registry entry \`${target_group_id}\` is either removed from ` +
      "`.claude/skills/self-repair-pipeline/known_issues/registry.json` " +
      "or its `status` is flipped to `fixed`.",
    "- [ ] Self-repair pipeline re-run on affected corpora no longer surfaces this group.",
    "",
  ].join("\n");
}
