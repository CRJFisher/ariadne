/**
 * Render every investigate response with a non-null `classifier_spec` to
 * TypeScript source under the supplied builtins dir. Pure-ish: the only
 * side-effect is `fs.writeFile`. Returns the same map shape `apply_proposals`
 * consumes — `{ target_group_id → absolute_file_path }` keyed by
 * `retargets_to ?? group_id`.
 *
 * Renderer throws are folded into `render_failures` instead of aborting the
 * whole run; the responses that failed are excluded from the upsert step
 * downstream.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { FailedAuthoring } from "./apply_proposals.js";
import { render_classifier } from "./render_classifier.js";
import type { InvestigateResponse } from "./types.js";

export interface RenderAuthoredFilesResult {
  authored_files_by_group: Record<string, string>;
  render_failures: FailedAuthoring[];
}

export async function render_authored_files(
  responses: readonly InvestigateResponse[],
  builtins_dir: string,
): Promise<RenderAuthoredFilesResult> {
  const authored_files_by_group: Record<string, string> = {};
  const render_failures: FailedAuthoring[] = [];
  await fs.mkdir(builtins_dir, { recursive: true });
  for (const response of responses) {
    if (response.classifier_spec === null) continue;
    const target_group_id = response.retargets_to ?? response.group_id;
    const target_path = path.join(builtins_dir, `check_${target_group_id}.ts`);
    let source: string;
    try {
      source = render_classifier(response.classifier_spec);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      render_failures.push({
        group_id: response.group_id,
        reason: `render_classifier threw: ${msg}`,
      });
      continue;
    }
    await fs.writeFile(target_path, source, "utf8");
    authored_files_by_group[target_group_id] = target_path;
  }
  return { authored_files_by_group, render_failures };
}
