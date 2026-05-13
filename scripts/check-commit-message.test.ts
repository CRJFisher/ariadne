import { describe, expect, it } from "vitest";

import { expand_task_scope, validate_commit_message } from "./check-commit-message.js";

function with_tasks(...ids: string[]): (id: string) => boolean {
  const set = new Set(ids);
  return (id) => set.has(id);
}

describe("expand_task_scope", () => {
  it("returns a single id unchanged", () => {
    expect(expand_task_scope("190.16.42")).toEqual(["190.16.42"]);
    expect(expand_task_scope("343")).toEqual(["343"]);
  });

  it("expands a dotted range", () => {
    expect(expand_task_scope("190.17.12-14")).toEqual(["190.17.12", "190.17.13", "190.17.14"]);
  });

  it("expands a single-segment range", () => {
    expect(expand_task_scope("12-14")).toEqual(["12", "13", "14"]);
  });

  it("expands a range with multi-digit endpoints", () => {
    expect(expand_task_scope("190.17.8-11")).toEqual([
      "190.17.8",
      "190.17.9",
      "190.17.10",
      "190.17.11",
    ]);
  });

  it("returns the raw scope for a degenerate (hi < lo) range", () => {
    expect(expand_task_scope("190.17.14-12")).toEqual(["190.17.14-12"]);
  });
});

describe("validate_commit_message", () => {
  it("passes when the task-id scope corresponds to an existing task", () => {
    const result = validate_commit_message(
      "fix(190.16.42): handle null receiver\n",
      with_tasks("190.16.42"),
    );
    expect(result).toEqual({ ok: true, reason: null });
  });

  it("rejects when the task-id scope does not exist in backlog", () => {
    const result = validate_commit_message(
      "fix(190.16.420): typo in scope\n",
      with_tasks("190.16.42"),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("TASK-190.16.420");
  });

  it("expands a range and rejects if any expanded id is missing", () => {
    const result = validate_commit_message(
      "feat(190.17.12-14): batched retarget\n",
      with_tasks("190.17.12", "190.17.13"), // missing .14
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("TASK-190.17.14");
  });

  it("accepts a range when every expanded id exists", () => {
    const result = validate_commit_message(
      "feat(190.17.12-14): batched retarget\n",
      with_tasks("190.17.12", "190.17.13", "190.17.14"),
    );
    expect(result).toEqual({ ok: true, reason: null });
  });

  it("passes a named scope without validating against backlog", () => {
    const result = validate_commit_message(
      "fix(mcp): handle null receiver\n",
      with_tasks(), // empty backlog
    );
    expect(result).toEqual({ ok: true, reason: null });
  });

  it("passes a no-scope commit", () => {
    const result = validate_commit_message("chore: gitignore X\n", with_tasks());
    expect(result).toEqual({ ok: true, reason: null });
  });

  it("passes a non-Conventional-Commits message (we are not enforcing CC universally)", () => {
    const result = validate_commit_message(
      "triage-curator: file remaining 87 gap subtasks\n",
      with_tasks(),
    );
    expect(result).toEqual({ ok: true, reason: null });
  });

  it("validates body trailers and rejects unknown task ids", () => {
    const result = validate_commit_message(
      "fix(mcp): clean up\n\nFixes: TASK-190.16.42\n",
      with_tasks(), // missing
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("TASK-190.16.42");
  });

  it("accepts body trailers that match an existing task", () => {
    const result = validate_commit_message(
      "fix(mcp): clean up\n\nFixes: TASK-190.16.42\n",
      with_tasks("190.16.42"),
    );
    expect(result).toEqual({ ok: true, reason: null });
  });

  it("accepts multi-line body with mixed trailer styles", () => {
    const result = validate_commit_message(
      "feat: batched work\n\nImplements TASK-190.16.42\nCloses: TASK-343\n",
      with_tasks("190.16.42", "343"),
    );
    expect(result).toEqual({ ok: true, reason: null });
  });
});
