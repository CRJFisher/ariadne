/**
 * The model every triage investigation runs on, and how its reasoning is set.
 *
 * Caches are model-scoped, so one run uses one model for every investigation.
 * `claude-haiku-4-5` takes no effort setting and thinks with a 32k budget by
 * default, so it runs with thinking disabled; every other model is driven
 * through `effort`.
 */

import type { EffortLevel, Options } from "@anthropic-ai/claude-agent-sdk";

export interface InvestigatorModel {
  model: string;
  /** `null` exactly for a model without effort control. */
  effort: EffortLevel | null;
}

export const INVESTIGATOR_MODEL: InvestigatorModel = { model: "claude-haiku-5-5", effort: "medium" };

const MODELS_WITHOUT_EFFORT: ReadonlySet<string> = new Set(["claude-haiku-4-5"]);

export const EFFORT_LEVELS: readonly EffortLevel[] = ["low", "medium", "high", "xhigh", "max"];

/** Throws when `effort` does not fit the model: required for one with effort control, refused for one without. */
export function investigator_model(model: string, effort: EffortLevel | null): InvestigatorModel {
  if (MODELS_WITHOUT_EFFORT.has(model)) {
    if (effort !== null) throw new Error(`${model} takes no effort setting`);
  } else if (effort === null) {
    throw new Error(`${model} needs an effort setting (${EFFORT_LEVELS.join(", ")})`);
  }
  return { model, effort };
}

export function reasoning_options(choice: InvestigatorModel): Pick<Options, "thinking" | "effort"> {
  return choice.effort === null ? { thinking: { type: "disabled" } } : { effort: choice.effort };
}

export function describe_investigator_model(choice: InvestigatorModel): string {
  return choice.effort === null ? choice.model : `${choice.model}@${choice.effort}`;
}
