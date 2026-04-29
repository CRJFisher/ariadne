/**
 * Build task-creation proposals for registry entries that do not yet have a
 * linked `backlog_task`. Closes the F5 gap from TASK-190.16.12: the curator
 * currently files Ariadne-bug tasks only when the investigator emits an
 * `ariadne_bug` proposal. Entries that pre-exist (seed `wip`) or that land
 * via `promote_novel_groups` have no linked task until this sweeper runs.
 *
 * The sweeper is pure: given a registry, it returns `TaskProposal[]` plus an
 * updates list for entries whose `observed_count` has changed since their last
 * task-filing. Persistence (calling `mcp__backlog__task_create` /
 * `mcp__backlog__task_edit`) is the main agent's responsibility.
 */

import type {
  ClassifierSpec,
  KnownIssue as SelfRepairKnownIssue,
} from "@ariadnejs/types";

/**
 * JSON shape consumed by the main agent's `mcp__backlog__task_create` call. One
 * proposal per registry entry that needs a new task filed.
 */
export interface TaskProposal {
  group_id: string;
  title: string;
  description: string;
  labels: string[];
}

/**
 * JSON shape consumed by the main agent's `mcp__backlog__task_edit` call. One
 * update per entry whose linked task body needs refreshing (observed_count
 * changed since the prior snapshot).
 */
export interface TaskUpdateProposal {
  group_id: string;
  backlog_task: string;
  description: string;
}

export interface ProposeBacklogTasksInput {
  registry: SelfRepairKnownIssue[];
  /**
   * Prior `{ [group_id]: observed_count }` snapshot. Entries whose current
   * `observed_count` matches prior are skipped from `updates`. Absent entries
   * (first sweep) default to 0, so every entry with observations triggers an
   * update.
   */
  prior_counts: Record<string, number>;
}

export interface ProposeBacklogTasksResult {
  creates: TaskProposal[];
  updates: TaskUpdateProposal[];
}

export function propose_backlog_tasks(
  input: ProposeBacklogTasksInput,
): ProposeBacklogTasksResult {
  const creates: TaskProposal[] = [];
  const updates: TaskUpdateProposal[] = [];
  for (const issue of input.registry) {
    if (issue.status === "fixed") continue;
    const body = render_task_body(issue);
    if (issue.backlog_task === undefined || issue.backlog_task.length === 0) {
      creates.push({
        group_id: issue.group_id,
        title: render_task_title(issue),
        description: body,
        labels: render_task_labels(issue),
      });
      continue;
    }
    const current = issue.observed_count ?? 0;
    const prior = input.prior_counts[issue.group_id] ?? 0;
    if (current !== prior) {
      updates.push({
        group_id: issue.group_id,
        backlog_task: issue.backlog_task,
        description: body,
      });
    }
  }
  return { creates, updates };
}

function render_task_title(issue: SelfRepairKnownIssue): string {
  return `[${issue.group_id}] ${issue.title}`;
}

function render_task_labels(issue: SelfRepairKnownIssue): string[] {
  const labels = ["self-repair-pipeline", "known-issue", issue.group_id];
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
      "`.claude/skills/self-repair-pipeline/known_issues/registry.json` (or flip status to `fixed`).",
  );
  parts.push(
    "- [ ] Add a regression test reproducing the observed examples; confirm the fix covers them.",
  );
  parts.push(
    "- [ ] Re-run the self-repair pipeline on affected corpora; confirm `observed_count` stops climbing.",
  );
  return parts.join("\n") + "\n";
}

/** Strip internal-only fields (`compiled_pattern`) so the body JSON is clean. */
function render_classifier_for_body(spec: ClassifierSpec): unknown {
  return JSON.parse(
    JSON.stringify(spec, (key, value) => (key === "compiled_pattern" ? undefined : value)),
  );
}
