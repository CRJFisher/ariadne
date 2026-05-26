/**
 * Render the prompt the dispatcher sends to the `triage-coordinator`
 * sub-agent.
 *
 * The prompt is a single pretty-printed JSON object with three fields:
 * `entry_index`, `verdict`, and `current`. JSON is more authoritative than
 * positional text for an agent reading structured data and removes the
 * order-sensitive contract that a hand-rolled multi-block format would carry.
 */

import type { NovelIssuesFile } from "./novel_issues.js";
import type { NovelVerdict } from "../verdict/triage_verdict.js";

export interface RenderCoordinatorPromptInput {
  entry_index: number;
  verdict: NovelVerdict;
  current: NovelIssuesFile;
}

export function render_coordinator_prompt(
  input: RenderCoordinatorPromptInput,
): string {
  return JSON.stringify(input, null, 2);
}
