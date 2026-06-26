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
} from "./render_backlog_task.js";
import type { AuthoredBacklogTask } from "./task_assignment.js";

/** A fully-populated primary `PlanTask` (the record is total); `overrides` set the per-test discriminators. */
function make_task(overrides: Partial<PlanTask>): PlanTask {
  return {
    schema_version: PLAN_TASK_SCHEMA_VERSION,
    id: "pt-base" as PlanTaskId,
    tier: "architectural",
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

/** An authored backlog task with absolute ids (post-remap), the shape the renderer consumes. */
function make_authored(overrides: Partial<AuthoredBacklogTask>): AuthoredBacklogTask {
  return {
    backlog_id: "347",
    parent_backlog_id: null,
    ordinal: null,
    title: "Resolve namespace receiver calls",
    description_md: "Receiver type lost at the namespace hop.",
    acceptance_criteria: [],
    plan_task_ids: ["pt-base"],
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
    expect(backlog_task_filename("347", "Narrow the receiver")).toEqual(
      "task-347 - Narrow-the-receiver.md",
    );
  });

  it("renders a dotted child id into the filename", () => {
    expect(backlog_task_filename("347.1.2", "Narrow the receiver")).toEqual(
      "task-347.1.2 - Narrow-the-receiver.md",
    );
  });
});

describe("render_backlog_task", () => {
  it("renders the authored body and a numbered checklist, stamping the primary's dedup link", () => {
    const authored = make_authored({
      title: "Complete the member surface a resolved receiver exposes",
      description_md: "Key the constructor into the flat member index, and delegate namespace lookup to the export chain.",
      acceptance_criteria: ["Root-cause fix lands in `core`.", "Add a regression test."],
    });
    const primary = make_task({
      id: "pt-abc123" as PlanTaskId,
      fault_area: "name_resolution",
      dedup_key: "a1b2c3d4e5f6",
      is_classifier_work: false,
    });

    const rendered = render_backlog_task(authored, primary, "2026-06-04 14:30");

    expect(rendered.filename).toEqual(
      "task-347 - Complete-the-member-surface-a-resolved-receiver-exposes.md",
    );
    expect(rendered.content).toEqual(
      [
        "---",
        "id: TASK-347",
        "title: \"Complete the member surface a resolved receiver exposes\"",
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
        "Key the constructor into the flat member index, and delegate namespace lookup to the export chain.",
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

  it("stamps medium priority when the primary row is classifier work", () => {
    const rendered = render_backlog_task(
      make_authored({}),
      make_task({ is_classifier_work: true }),
      "2026-06-04 14:30",
    );
    expect(rendered.content.includes("priority: medium")).toBe(true);
  });

  it("stamps parent_task_id and ordinal for a nested child, and a dotted id/filename", () => {
    const authored = make_authored({
      backlog_id: "347.1.2",
      parent_backlog_id: "347.1",
      ordinal: 2000,
      title: "Bind sibling inner-scope names",
      description_md: "Leaf prose.",
      acceptance_criteria: [],
      plan_task_ids: ["pt-leaf"],
    });
    const primary = make_task({
      id: "pt-leaf" as PlanTaskId,
      tier: "localized",
      fault_area: "name_resolution",
      dedup_key: "leafkey",
    });

    const rendered = render_backlog_task(authored, primary, "2026-06-04 14:30");

    expect(rendered.filename).toEqual(
      "task-347.1.2 - Bind-sibling-inner-scope-names.md",
    );
    expect(rendered.content).toEqual(
      [
        "---",
        "id: TASK-347.1.2",
        "title: \"Bind sibling inner-scope names\"",
        "status: To Do",
        "assignee: []",
        "created_date: \"2026-06-04 14:30\"",
        "labels:",
        "  - plan-export",
        "  - name_resolution",
        "dependencies: []",
        "parent_task_id: TASK-347.1",
        "priority: high",
        "ordinal: 2000",
        "plan_dedup_key: leafkey",
        "plan_source_task: pt-leaf",
        "---",
        "",
        "## Description",
        "",
        "<!-- SECTION:DESCRIPTION:BEGIN -->",
        "",
        "Leaf prose.",
        "",
        "<!-- SECTION:DESCRIPTION:END -->",
        "",
        "## Acceptance Criteria",
        "",
        "<!-- AC:BEGIN -->",
        "",
        "",
        "",
        "<!-- AC:END -->",
        "",
      ].join("\n"),
    );
  });
});
