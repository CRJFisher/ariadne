/**
 * Pure renderers that turn a strategist plan node into a `PlanTask`'s title and
 * body. They are deterministic feedstock: the reconcile engine (`build_plan_tasks`)
 * calls them at mint time to fill `PlanTask.title`/`PlanTask.body` from the node's
 * prose plus the evidence it grounds. The export adapter consumes those
 * already-rendered fields verbatim and never re-renders. The renderers persist
 * nothing themselves.
 */

import { ARIADNE_FAULT_AREA_FOLDER } from "@ariadnejs/types";
import type { PlanTaskEvidence } from "../store/plan_task.js";

import type { StrategistPlanNode } from "../types.js";
import { location_token } from "./compute_dedup_key.js";

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
    const sorted = [...evidence].sort((a, b) => location_token(a).localeCompare(location_token(b)));
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
  } else if (node.is_permanent_limitation) {
    parts.push(
      "- [ ] The call relationship is fundamentally unknowable to static analysis — no core fix is possible. " +
        "Route the group to `classifier-author`: the registry classifier is the durable deliverable, and this task never exports to `backlog/`.",
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
  }
  return parts.join("\n") + "\n";
}
