import { describe, expect, it } from "vitest";

import { INVESTIGATOR_MODEL, describe_investigator_model, investigator_model, reasoning_options } from "./investigator_model.js";

describe("investigator_model", () => {
  it("drives a model with effort control through effort", () => {
    const choice = investigator_model("claude-haiku-5-5", "low");
    expect(reasoning_options(choice)).toEqual({ effort: "low" });
    expect(describe_investigator_model(choice)).toEqual("claude-haiku-5-5@low");
  });

  it("disables thinking on claude-haiku-4-5, which takes no effort setting", () => {
    const choice = investigator_model("claude-haiku-4-5", null);
    expect(reasoning_options(choice)).toEqual({ thinking: { type: "disabled" } });
    expect(describe_investigator_model(choice)).toEqual("claude-haiku-4-5");
  });

  it("refuses an effort the model cannot take, and a missing one it needs", () => {
    expect(() => investigator_model("claude-haiku-4-5", "low")).toThrow("claude-haiku-4-5 takes no effort setting");
    expect(() => investigator_model("claude-haiku-5-5", null)).toThrow("claude-haiku-5-5 needs an effort setting (low, medium, high, xhigh, max)");
  });

  it("pins the pipeline's model with an explicit effort", () => {
    expect(INVESTIGATOR_MODEL).toEqual({ model: "claude-haiku-5-5", effort: "medium" });
  });
});
