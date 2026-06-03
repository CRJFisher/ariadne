/**
 * Pure renderers that turn a strategist plan node into a `PlanTask`'s title and
 * body. They are deterministic feedstock: the reconcile engine (`build_plan_tasks`)
 * calls them to fill `PlanTask.title`/`PlanTask.body` from the node's prose plus
 * the evidence it grounds, and the user-invoked export adapter (190.22.11)
 * reuses them when promoting a DB task into the user's `backlog/`. The renderers
 * persist nothing themselves.
 */

import { ARIADNE_FAULT_AREA_FOLDER } from "@ariadnejs/types";
import type { PlanTaskEvidence } from "@ariadnejs/skill-protocol";

import type { StrategistPlanNode } from "../types.js";

/**
 * The task title. An `architectural` cross-area root keeps the strategist's
 * title verbatim; `fault_area`/`localized` nodes are prefixed with their area so
 * the tier is legible in a flat task list.
 */
export function render_task_title(node: StrategistPlanNode): string {
  if (node.tier === "architectural") return node.title;
  return `[${node.fault_area}] ${node.title}`;
}

/**
 * The task body: the strategist's prose, then a deterministic observations +
 * evidence section rendered from the grounding `PlanTaskEvidence`, then
 * fault-area-folder-anchored acceptance criteria. Sections backed by empty
 * inputs (no evidence) are omitted, keeping the body focused on what is
 * actually available.
 */
export function render_task_body(
  node: StrategistPlanNode,
  evidence: PlanTaskEvidence[],
): string {
  const parts: string[] = [];
  parts.push(node.body.trimEnd());
  parts.push("");

  if (evidence.length > 0) {
    const projects = [...new Set(evidence.map((e) => e.project))].sort();
    const runs = [...new Set(evidence.map((e) => e.run_id))].sort();
    parts.push("## Observations");
    parts.push("");
    parts.push(`- Observed count: **${evidence.length}**`);
    parts.push(`- Projects: ${projects.map((p) => `\`${p}\``).join(", ")}`);
    parts.push(`- Source runs: ${runs.map((r) => `\`${r}\``).join(", ")}`);
    parts.push("");
    parts.push("## Evidence");
    parts.push("");
    const sorted = [...evidence].sort((a, b) =>
      `${a.member_evidence.file}:${a.member_evidence.line}`.localeCompare(
        `${b.member_evidence.file}:${b.member_evidence.line}`,
      ),
    );
    for (const e of sorted) {
      parts.push(
        `- \`${e.member_evidence.file}:${e.member_evidence.line}\` — ${e.member_evidence.why} (project \`${e.project}\`, run \`${e.run_id}\`)`,
      );
    }
    parts.push("");
  }

  parts.push("## Acceptance criteria");
  parts.push("");
  if (node.is_taxonomy_extension) {
    parts.push(
      "- [ ] Add the missing folder-anchored area to the `AriadneFaultArea` union and " +
        "`ARIADNE_FAULT_AREA_FOLDER` in `packages/types/src/ariadne_fault_area.ts`, and map it in `derive_fault_area`.",
    );
    parts.push(
      "- [ ] Add a `derive_fault_area` test that routes the formerly-`other` signal to the new area.",
    );
  } else {
    const folder = ARIADNE_FAULT_AREA_FOLDER[node.fault_area];
    const target = folder.length > 0 ? `\`${folder}\`` : "Ariadne core";
    parts.push(
      `- [ ] Root-cause fix lands in ${target} so the ${node.fault_area} pattern resolves without a classifier.`,
    );
    parts.push(
      "- [ ] Add a regression test reproducing the observed evidence; confirm the fix covers it.",
    );
    if (node.is_classifier_work) {
      parts.push(
        "- [ ] (Lower priority) Author the interim classifier so triage routes around the false positive until the core fix lands.",
      );
    }
  }
  return parts.join("\n") + "\n";
}
