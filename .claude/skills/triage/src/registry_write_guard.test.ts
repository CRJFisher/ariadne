import { describe, expect, it } from "vitest";
import { evaluate_tool_call } from "./registry_write_guard.js";

const PROJECT_DIR = "/repo";
const REGISTRY_ABS = "/repo/.claude/skills/triage/known_issues/registry.json";
const REGISTRY_REL = ".claude/skills/triage/known_issues/registry.json";

function decision_of(
  tool_name: string,
  tool_input: Record<string, unknown> | undefined,
): "pass" | "ask" {
  return evaluate_tool_call({ tool_name, tool_input, project_dir: PROJECT_DIR })
    .decision;
}

describe("evaluate_tool_call — Write/Edit", () => {
  it("asks on a Write to the registry by absolute path", () => {
    expect(decision_of("Write", { file_path: REGISTRY_ABS })).toEqual("ask");
  });

  it("asks on an Edit to the registry by repo-relative path", () => {
    expect(decision_of("Edit", { file_path: REGISTRY_REL })).toEqual("ask");
  });

  it("asks on a path that resolves to the registry through ..", () => {
    expect(
      decision_of("Write", {
        file_path:
          "/repo/.claude/skills/triage/known_issues/../known_issues/registry.json",
      }),
    ).toEqual("ask");
  });

  it("asks on a Write to the lock sidecar", () => {
    expect(decision_of("Write", { file_path: `${REGISTRY_ABS}.lock` })).toEqual(
      "ask",
    );
  });

  it("passes a registry.json that lives elsewhere in the repo", () => {
    expect(
      decision_of("Write", { file_path: "/repo/packages/core/registry.json" }),
    ).toEqual("pass");
  });

  it("passes an ordinary source-file Edit", () => {
    expect(
      decision_of("Edit", { file_path: "/repo/packages/core/src/index.ts" }),
    ).toEqual("pass");
  });

  it("passes when file_path is missing", () => {
    expect(decision_of("Write", {})).toEqual("pass");
    expect(decision_of("Write", undefined)).toEqual("pass");
  });

  it("names the per-edit contract in the ask reason", () => {
    const result = evaluate_tool_call({
      tool_name: "Write",
      tool_input: { file_path: REGISTRY_ABS },
      project_dir: PROJECT_DIR,
    });
    expect(result).toEqual({
      decision: "ask",
      reason:
        "This Write targets the human-owned classifier registry " +
        "(.claude/skills/triage/known_issues/registry.json). Per " +
        ".claude/rules/classifier-lifecycle.md every registry transition is " +
        "a per-edit human decision: approve only if you are interactively " +
        "directing this edit; an unattended pipeline agent must route the " +
        "transition back to the human (reconcile_registry.ts --stage / " +
        "--id ... --fixed --reason).",
    });
  });
});

describe("evaluate_tool_call — Bash and other tools pass unguarded", () => {
  it("passes Bash commands even when they write the registry", () => {
    expect(
      decision_of("Bash", { command: `echo '[]' > ${REGISTRY_REL}` }),
    ).toEqual("pass");
    expect(
      decision_of("Bash", { command: `cat ${REGISTRY_REL}` }),
    ).toEqual("pass");
  });

  it("passes non-guarded tools even when they name the registry", () => {
    expect(decision_of("Read", { file_path: REGISTRY_ABS })).toEqual("pass");
    expect(decision_of("Grep", { path: REGISTRY_ABS })).toEqual("pass");
  });
});
