import { describe, expect, it } from "vitest";

import type { RunId } from "@ariadnejs/skill-protocol";
import {
  PLAN_TASK_SCHEMA_VERSION,
  type PlanTask,
  type PlanTaskId,
} from "../store/plan_task.js";

import {
  backlog_task_filename,
  derive_backlog_priority,
  render_backlog_task,
  slugify_title,
  split_rendered_body,
} from "./render_backlog_task.js";

/** A fully-populated `PlanTask` (the record is total); `overrides` set the per-test discriminators. */
function make_task(overrides: Partial<PlanTask>): PlanTask {
  return {
    schema_version: PLAN_TASK_SCHEMA_VERSION,
    id: "pt-base" as PlanTaskId,
    tier: "localized",
    parent_id: null,
    child_ids: [],
    title: "title",
    body: "body",
    fault_area: "name_resolution",
    evidence: [],
    observed_count: 0,
    projects: [],
    source_runs: [] as RunId[],
    status: "proposed",
    superseded_by: null,
    exported_backlog_task: null,
    dedup_key: "deadbeef",
    created_in_sweep: "sweep-1",
    updated_in_sweep: "sweep-1",
    strategist: "claude-opus-4-8",
    is_classifier_work: false,
    core_fix_effort: 3,
    core_fix_effort_rationale: "new resolver path in name_resolution",
    ...overrides,
  };
}

describe("derive_backlog_priority", () => {
  it("a core fix is high priority", () => {
    expect(derive_backlog_priority(false)).toEqual("high");
  });

  it("interim classifier work is lower (medium) priority", () => {
    expect(derive_backlog_priority(true)).toEqual("medium");
  });
});

describe("slugify_title", () => {
  it("strips the area-prefix brackets and dashes the words", () => {
    expect(slugify_title("[name_resolution] Fix mod.func() calls")).toEqual(
      "name_resolution-Fix-mod.func()-calls",
    );
  });

  it("strips filesystem-unsafe characters and collapses dashes", () => {
    expect(slugify_title("Resolve a/b:c \"x\" <y> | z")).toEqual("Resolve-abc-x-y-z");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify_title("  spaced  ")).toEqual("spaced");
  });
});

describe("backlog_task_filename", () => {
  it("renders the `task-<id> - <slug>.md` convention", () => {
    expect(backlog_task_filename(347, "[type_resolution] Narrow receiver")).toEqual(
      "task-347 - type_resolution-Narrow-receiver.md",
    );
  });
});

describe("split_rendered_body", () => {
  it("splits a rendered body at the acceptance heading", () => {
    const body = [
      "Receiver type lost at the namespace hop.",
      "",
      "## Observations",
      "",
      "- Observed count: **2**",
      "",
      "## Acceptance criteria",
      "",
      "- [ ] Root-cause fix lands in `core`.",
      "- [ ] Add a regression test.",
      "",
    ].join("\n");
    expect(split_rendered_body(body)).toEqual({
      description_md: [
        "Receiver type lost at the namespace hop.",
        "",
        "## Observations",
        "",
        "- Observed count: **2**",
      ].join("\n"),
      acceptance_items: ["Root-cause fix lands in `core`.", "Add a regression test."],
    });
  });

  it("puts the whole body in description when there is no acceptance heading", () => {
    expect(split_rendered_body("Just prose, no criteria.\n")).toEqual({
      description_md: "Just prose, no criteria.",
      acceptance_items: [],
    });
  });
});

describe("render_backlog_task", () => {
  it("renders frontmatter (stamping plan_dedup_key + source id) and the two delimited body regions", () => {
    const task = make_task({
      id: "pt-abc123" as PlanTaskId,
      title: "[name_resolution] Resolve namespace receiver calls",
      fault_area: "name_resolution",
      dedup_key: "a1b2c3d4e5f6",
      is_classifier_work: false,
      body: [
        "Receiver type lost at the namespace hop.",
        "",
        "## Acceptance criteria",
        "",
        "- [ ] Root-cause fix lands in `core`.",
        "- [ ] Add a regression test.",
        "",
      ].join("\n"),
    });

    const rendered = render_backlog_task(task, 347, "2026-06-04 14:30");

    expect(rendered.filename).toEqual(
      "task-347 - name_resolution-Resolve-namespace-receiver-calls.md",
    );
    expect(rendered.content).toEqual(
      [
        "---",
        "id: TASK-347",
        "title: \"[name_resolution] Resolve namespace receiver calls\"",
        "status: To Do",
        "assignee: []",
        "created_date: \"2026-06-04 14:30\"",
        "labels:",
        "  - plan-export",
        "  - name_resolution",
        "dependencies: []",
        "priority: high",
        "plan_dedup_key: a1b2c3d4e5f6",
        "plan_source_task: pt-abc123",
        "---",
        "",
        "## Description",
        "",
        "<!-- SECTION:DESCRIPTION:BEGIN -->",
        "",
        "Receiver type lost at the namespace hop.",
        "",
        "<!-- SECTION:DESCRIPTION:END -->",
        "",
        "## Acceptance Criteria",
        "",
        "<!-- AC:BEGIN -->",
        "",
        "- [ ] #1 Root-cause fix lands in `core`.",
        "- [ ] #2 Add a regression test.",
        "",
        "<!-- AC:END -->",
        "",
      ].join("\n"),
    );
  });

  it("stamps medium priority for classifier work", () => {
    const task = make_task({ is_classifier_work: true, body: "prose\n" });
    const rendered = render_backlog_task(task, 12, "2026-06-04 14:30");
    expect(rendered.content.includes("priority: medium")).toBe(true);
  });
});
