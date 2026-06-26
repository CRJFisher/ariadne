import { describe, expect, it } from "vitest";

import {
  parse_task_assignment,
  remap_authored_task,
  type AuthoredBacklogTask,
} from "./task_assignment.js";

function make_authored(overrides: Partial<AuthoredBacklogTask>): AuthoredBacklogTask {
  return {
    backlog_id: "1",
    parent_backlog_id: null,
    ordinal: null,
    title: "Root task",
    description_md: "Do the fundamental refactor.",
    acceptance_criteria: ["Core fix lands."],
    plan_task_ids: ["pt-arch"],
    ...overrides,
  };
}

describe("remap_authored_task", () => {
  it("remaps the relative root id to the absolute first id", () => {
    expect(remap_authored_task(make_authored({ backlog_id: "1", parent_backlog_id: null }), 347)).toEqual(
      make_authored({ backlog_id: "347", parent_backlog_id: null }),
    );
  });

  it("remaps a nested id and its parent, leaving deeper segments intact", () => {
    expect(
      remap_authored_task(
        make_authored({ backlog_id: "1.2", parent_backlog_id: "1", ordinal: 2000, plan_task_ids: ["pt-leaf"] }),
        347,
      ),
    ).toEqual(
      make_authored({ backlog_id: "347.2", parent_backlog_id: "347", ordinal: 2000, plan_task_ids: ["pt-leaf"] }),
    );
  });
});

describe("parse_task_assignment", () => {
  it("parses a tasks array and resolves ids to absolute", () => {
    const raw = JSON.stringify({
      tasks: [
        {
          backlog_id: "1",
          parent_backlog_id: null,
          ordinal: null,
          title: "Complete the member surface",
          description_md: "Key the constructor into the index.",
          acceptance_criteria: ["Constructor links.", "Regression test added."],
          plan_task_ids: ["pt-arch", "pt-area"],
        },
        {
          backlog_id: "1.1",
          parent_backlog_id: "1",
          ordinal: 1000,
          title: "Follow re-export chains",
          description_md: "Delegate to resolve_export_chain.",
          acceptance_criteria: ["Re-exports resolve."],
          plan_task_ids: ["pt-leaf"],
        },
      ],
    });

    expect(parse_task_assignment(raw, 347, "test")).toEqual([
      {
        backlog_id: "347",
        parent_backlog_id: null,
        ordinal: null,
        title: "Complete the member surface",
        description_md: "Key the constructor into the index.",
        acceptance_criteria: ["Constructor links.", "Regression test added."],
        plan_task_ids: ["pt-arch", "pt-area"],
      },
      {
        backlog_id: "347.1",
        parent_backlog_id: "347",
        ordinal: 1000,
        title: "Follow re-export chains",
        description_md: "Delegate to resolve_export_chain.",
        acceptance_criteria: ["Re-exports resolve."],
        plan_task_ids: ["pt-leaf"],
      },
    ]);
  });

  it("defaults a missing ordinal to null", () => {
    const raw = JSON.stringify({
      tasks: [
        {
          backlog_id: "1",
          parent_backlog_id: null,
          title: "Root",
          description_md: "Body.",
          acceptance_criteria: [],
          plan_task_ids: ["pt-arch"],
        },
      ],
    });
    expect(parse_task_assignment(raw, 5, "test")[0].ordinal).toEqual(null);
  });

  it("rejects a file with no tasks array", () => {
    expect(() => parse_task_assignment(JSON.stringify({ foo: 1 }), 1, "test")).toThrow(
      "test: must be an object with a \"tasks\" array",
    );
  });

  it("rejects a non-dotted backlog id", () => {
    const raw = JSON.stringify({
      tasks: [{ backlog_id: "x", parent_backlog_id: null, title: "t", description_md: "b", acceptance_criteria: [], plan_task_ids: ["pt-1"] }],
    });
    expect(() => parse_task_assignment(raw, 1, "test")).toThrow("tasks[0].backlog_id must be a dotted-decimal id");
  });

  it("rejects an empty plan_task_ids", () => {
    const raw = JSON.stringify({
      tasks: [{ backlog_id: "1", parent_backlog_id: null, title: "t", description_md: "b", acceptance_criteria: [], plan_task_ids: [] }],
    });
    expect(() => parse_task_assignment(raw, 1, "test")).toThrow(
      "tasks[0].plan_task_ids must be a non-empty array",
    );
  });

  it("rejects an empty description_md", () => {
    const raw = JSON.stringify({
      tasks: [{ backlog_id: "1", parent_backlog_id: null, title: "t", description_md: "  ", acceptance_criteria: [], plan_task_ids: ["pt-1"] }],
    });
    expect(() => parse_task_assignment(raw, 1, "test")).toThrow(
      "tasks[0].description_md must be a non-empty string",
    );
  });
});
