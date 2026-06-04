import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PLAN_TASK_SCHEMA_VERSION,
  plan_tasks_dir,
  type PlanTask,
  type PlanTaskId,
} from "@ariadnejs/skill-protocol";
import { JsonPlanTaskRepository } from "../.claude/skills/plan/src/store/json_plan_task_repository.js";

import {
  classify,
  map_fault_area,
  map_status,
  parse_backlog_task,
  run,
  seed_dedup_key,
  seed_from_backlog_task,
  type ParsedBacklogTask,
} from "./migrate-pipeline-tasks.js";

// ── Representative real-corpus fixtures (verbatim shapes) ────────────────────

/** A `[bug]` ticket: folded `>-` title, root-cause label, observed-count body. */
const BUG_206 = `---
id: TASK-206
title: >-
  [bug] Resolve method calls on call_chain receivers via intermediate call
  return type
status: To Do
assignee: []
created_date: '2026-04-28 09:37'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - method-chain-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** \`receiver_resolution\`
**Target registry entry:** \`method-chain-dispatch\`
**Observed count:** 107

When a call expression loses the receiver type at the call_chain hop.
<!-- SECTION:DESCRIPTION:END -->
`;

/** A `[bug]` ticket qualifying by TITLE alone (no root-cause label), status Done, `## Resolution` after the section. */
const BUG_343 = `---
id: TASK-343
title: >-
  [bug] group-investigator writes to pre-run-namespaced path
status: Done
assignee: []
created_date: "2026-05-07 00:00"
labels:
  - triage-entrypoints
  - sub-agent-bug
  - paths
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The group investigator wrote to the wrong path.
<!-- SECTION:DESCRIPTION:END -->

## Resolution

Fixed by re-rooting the path. This text must NOT appear in the seed body.
`;

/** A `[gap]` ticket: single-quoted title, signal-gap label. */
const GAP_21 = `---
id: TASK-190.16.21
title: '[gap] Add polymorphic-override-hierarchy signals'
status: To Do
assignee: []
labels:
  - triage-entrypoints
  - signal-gap
  - triage-curator
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** \`polymorphic-override-hierarchy\`

Expose the override hierarchy for polymorphic dispatch.
<!-- SECTION:DESCRIPTION:END -->
`;

/** The KEEP edge: carries `signal-gap` but the title is NOT `[gap] …`. */
const KEEP_17 = `---
id: TASK-190.16.17
title: 'Signal gap: expose callers located in unindexed test directories'
status: Done
assignee: []
labels:
  - triage-entrypoints
  - signal-gap
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Human infra task; not auto-filed.
<!-- SECTION:DESCRIPTION:END -->
`;

/** A plain human task — no trigger labels, no trigger title. */
const KEEP_HUMAN = `---
id: TASK-108
title: Fix global method name collision in symbol resolution
status: To Do
assignee: []
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A real product task.
<!-- SECTION:DESCRIPTION:END -->
`;

/** A `[gap]` TITLE without the `signal-gap` label → KEEP (the conjunction must hold). */
const KEEP_GAP_TITLE_NO_LABEL = `---
id: TASK-900
title: '[gap] looks like a gap but lacks the label'
status: To Do
labels:
  - some-other-label
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
body
<!-- SECTION:DESCRIPTION:END -->
`;

// ── classify ─────────────────────────────────────────────────────────────────

describe("classify", () => {
  it("classifies a [bug]-title + false-positive-root-cause ticket as bug", () => {
    expect(classify(parse_backlog_task(BUG_206))).toEqual("bug");
  });

  it("classifies a [bug]-title ticket with no root-cause label as bug (title alone qualifies)", () => {
    expect(classify(parse_backlog_task(BUG_343))).toEqual("bug");
  });

  it("classifies a false-positive-root-cause label with a non-[bug] title as bug (label alone qualifies)", () => {
    const parsed: ParsedBacklogTask = {
      id: "TASK-1",
      title: "Resolve something",
      status: "To Do",
      labels: ["false-positive-root-cause"],
      body: "",
      observed_count: 0,
    };
    expect(classify(parsed)).toEqual("bug");
  });

  it("classifies a [gap]-title + signal-gap ticket as gap", () => {
    expect(classify(parse_backlog_task(GAP_21))).toEqual("gap");
  });

  it("KEEPS a signal-gap ticket whose title is not [gap] (the 190.16.13–17 edge)", () => {
    expect(classify(parse_backlog_task(KEEP_17))).toEqual("keep");
  });

  it("KEEPS a [gap]-title ticket lacking the signal-gap label (the conjunction holds)", () => {
    expect(classify(parse_backlog_task(KEEP_GAP_TITLE_NO_LABEL))).toEqual("keep");
  });

  it("KEEPS a plain human task", () => {
    expect(classify(parse_backlog_task(KEEP_HUMAN))).toEqual("keep");
  });
});

// ── parse_backlog_task ───────────────────────────────────────────────────────

describe("parse_backlog_task", () => {
  it("joins a folded >- multi-line title into one space-separated string", () => {
    expect(parse_backlog_task(BUG_206).title).toEqual(
      "[bug] Resolve method calls on call_chain receivers via intermediate call return type",
    );
  });

  it("strips single quotes from a single-quoted title", () => {
    expect(parse_backlog_task(GAP_21).title).toEqual(
      "[gap] Add polymorphic-override-hierarchy signals",
    );
  });

  it("parses id, status, and the labels list exactly", () => {
    const parsed = parse_backlog_task(BUG_206);
    expect(parsed.id).toEqual("TASK-206");
    expect(parsed.status).toEqual("To Do");
    expect(parsed.labels).toEqual([
      "ariadne-core",
      "false-positive-root-cause",
      "root-cause-receiver_resolution",
      "method-chain-dispatch",
    ]);
  });

  it("extracts observed_count as a number, defaulting to 0 when absent", () => {
    expect(parse_backlog_task(BUG_206).observed_count).toEqual(107);
    expect(parse_backlog_task(GAP_21).observed_count).toEqual(0);
  });

  it("extracts the SECTION:DESCRIPTION body and excludes a trailing ## Resolution", () => {
    expect(parse_backlog_task(BUG_343).body).toEqual(
      "The group investigator wrote to the wrong path.",
    );
  });

  it("falls back to the ## Description section when there are no SECTION markers", () => {
    const no_markers = `---
id: TASK-2
title: plain
status: To Do
labels: []
---

## Description

Inline description body.

## Acceptance Criteria

- [ ] something
`;
    expect(parse_backlog_task(no_markers).body).toEqual("Inline description body.");
  });

  it("degrades to empty defaults (→ KEEP) when frontmatter is absent", () => {
    const parsed = parse_backlog_task("no frontmatter here");
    expect(parsed).toEqual({
      id: "",
      title: "",
      status: "",
      labels: [],
      body: "",
      observed_count: 0,
    });
    expect(classify(parsed)).toEqual("keep");
  });
});

// ── map_status / map_fault_area / seed_dedup_key ─────────────────────────────

describe("map_status", () => {
  it("maps To Do and In Progress to the terminal abandoned, Done to resolved", () => {
    expect(map_status("To Do")).toEqual("abandoned");
    expect(map_status("In Progress")).toEqual("abandoned");
    expect(map_status("Done")).toEqual("resolved");
  });

  it("throws on an unrecognized status", () => {
    expect(() => map_status("Blocked")).toThrow(/unrecognized backlog status/);
  });
});

describe("map_fault_area", () => {
  it("routes each bug root-cause label onto its fault area", () => {
    expect(map_fault_area("bug", ["root-cause-receiver_resolution"])).toEqual(
      "receiver_type_inference",
    );
    expect(map_fault_area("bug", ["root-cause-cross_file_flow"])).toEqual("import_resolution");
    expect(map_fault_area("bug", ["root-cause-syntactic_extraction"])).toEqual(
      "syntactic_extraction",
    );
    expect(map_fault_area("bug", ["root-cause-import_resolution"])).toEqual("import_resolution");
    expect(map_fault_area("bug", ["root-cause-coverage_config"])).toEqual("coverage_config");
    expect(map_fault_area("bug", ["root-cause-other"])).toEqual("other");
  });

  it("falls back to other for a bug with no root-cause label", () => {
    expect(map_fault_area("bug", ["triage-entrypoints", "paths"])).toEqual("other");
  });

  it("maps every gap to other", () => {
    expect(map_fault_area("gap", ["signal-gap", "anything"])).toEqual("other");
  });
});

describe("seed_dedup_key", () => {
  it("is the sha256 of seed:<id>", () => {
    expect(seed_dedup_key("TASK-206")).toEqual(
      createHash("sha256").update("seed:TASK-206", "utf8").digest("hex"),
    );
  });
});

// ── seed_from_backlog_task (full-record mapping) ─────────────────────────────

describe("seed_from_backlog_task", () => {
  it("maps a bug ticket to its complete PlanTask seed", () => {
    const seed = seed_from_backlog_task(parse_backlog_task(BUG_206), "bug");
    const expected: PlanTask = {
      schema_version: PLAN_TASK_SCHEMA_VERSION,
      id: "TASK-206" as PlanTaskId,
      tier: "localized",
      parent_id: null,
      child_ids: [],
      title: "[bug] Resolve method calls on call_chain receivers via intermediate call return type",
      body:
        "**Root cause category:** `receiver_resolution`\n" +
        "**Target registry entry:** `method-chain-dispatch`\n" +
        "**Observed count:** 107\n\n" +
        "When a call expression loses the receiver type at the call_chain hop.",
      fault_area: "receiver_type_inference",
      evidence: [],
      observed_count: 107,
      projects: [],
      source_runs: [],
      status: "abandoned",
      superseded_by: null,
      exported_backlog_task: null,
      dedup_key: seed_dedup_key("TASK-206"),
      created_in_sweep: "migrate-pipeline-tasks",
      updated_in_sweep: "migrate-pipeline-tasks",
      strategist: "migrate-pipeline-tasks",
      is_classifier_work: false,
    };
    expect(seed).toEqual(expected);
  });

  it("maps a gap ticket: fault_area other, is_classifier_work true, observed_count 0", () => {
    const seed = seed_from_backlog_task(parse_backlog_task(GAP_21), "gap");
    const expected: PlanTask = {
      schema_version: PLAN_TASK_SCHEMA_VERSION,
      id: "TASK-190.16.21" as PlanTaskId,
      tier: "localized",
      parent_id: null,
      child_ids: [],
      title: "[gap] Add polymorphic-override-hierarchy signals",
      body:
        "**Signals needed:** `polymorphic-override-hierarchy`\n\n" +
        "Expose the override hierarchy for polymorphic dispatch.",
      fault_area: "other",
      evidence: [],
      observed_count: 0,
      projects: [],
      source_runs: [],
      status: "abandoned",
      superseded_by: null,
      exported_backlog_task: null,
      dedup_key: seed_dedup_key("TASK-190.16.21"),
      created_in_sweep: "migrate-pipeline-tasks",
      updated_in_sweep: "migrate-pipeline-tasks",
      strategist: "migrate-pipeline-tasks",
      is_classifier_work: true,
    };
    expect(seed).toEqual(expected);
  });

  it("maps the Done, no-root-cause bug to status resolved and fault_area other", () => {
    const seed = seed_from_backlog_task(parse_backlog_task(BUG_343), "bug");
    expect(seed.status).toEqual("resolved");
    expect(seed.fault_area).toEqual("other");
    expect(seed.is_classifier_work).toEqual(false);
    expect(seed.observed_count).toEqual(0);
  });

  it("is deterministic: same input → byte-identical seed", () => {
    const a = seed_from_backlog_task(parse_backlog_task(BUG_206), "bug");
    const b = seed_from_backlog_task(parse_backlog_task(BUG_206), "bug");
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});

// ── run(argv) integration ────────────────────────────────────────────────────

describe("run", () => {
  let backlog_dir: string;
  let plan_dir: string;
  let saved_backlog: string | undefined;
  let saved_plan: string | undefined;

  /** The temp backlog: 1 bug + 1 gap (migrate), 1 keep, 1 .md.tmp stray. */
  async function seed_backlog(): Promise<void> {
    await fs.writeFile(path.join(backlog_dir, "task-206 - bug.md"), BUG_206);
    await fs.writeFile(path.join(backlog_dir, "task-190.16.21 - gap.md"), GAP_21);
    await fs.writeFile(path.join(backlog_dir, "task-108 - keep.md"), KEEP_HUMAN);
    await fs.writeFile(path.join(backlog_dir, "task-999 - stray.md.tmp"), "stale");
  }

  beforeEach(async () => {
    saved_backlog = process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
    saved_plan = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
    backlog_dir = await fs.mkdtemp(path.join(os.tmpdir(), "migrate-backlog-"));
    plan_dir = await fs.mkdtemp(path.join(os.tmpdir(), "migrate-plan-"));
    process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = backlog_dir;
    process.env.ARIADNE_PLAN_DIR_OVERRIDE = plan_dir;
    await seed_backlog();
  });

  afterEach(async () => {
    if (saved_backlog === undefined) delete process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
    else process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = saved_backlog;
    if (saved_plan === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
    else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_plan;
    await fs.rm(backlog_dir, { recursive: true, force: true });
    await fs.rm(plan_dir, { recursive: true, force: true });
  });

  it("dry-run classifies, asserts the count, and mutates nothing", async () => {
    const summary = await run(["--expect-migrate", "2"]);
    expect(summary.executed).toEqual(false);
    expect(summary.counts).toEqual({ bug: 1, gap: 1, keep: 1, migrate: 2, expect_migrate: 2 });

    // No task-DB rows written, every markdown still present.
    await expect(fs.readdir(plan_tasks_dir())).rejects.toThrow();
    expect((await fs.readdir(backlog_dir)).sort()).toEqual([
      "task-108 - keep.md",
      "task-190.16.21 - gap.md",
      "task-206 - bug.md",
      "task-999 - stray.md.tmp",
    ]);
  });

  it("execute seeds the task-DB, deletes migrated markdown + strays, keeps human tasks", async () => {
    const summary = await run(["--execute", "--expect-migrate", "2"]);
    expect(summary.executed).toEqual(true);
    expect(summary.seeded_ids.sort()).toEqual(["TASK-190.16.21", "TASK-206"]);
    expect(summary.strays_removed).toEqual(1);

    // Seeds are readable through the real store (exercises its schema guard).
    const repo = new JsonPlanTaskRepository();
    expect(await repo.get("TASK-206" as PlanTaskId)).toEqual(
      seed_from_backlog_task(parse_backlog_task(BUG_206), "bug"),
    );

    // Only the human task survives on disk.
    expect(await fs.readdir(backlog_dir)).toEqual(["task-108 - keep.md"]);
  });

  it("throws before any mutation when the migrate count mismatches", async () => {
    await expect(run(["--execute"])).rejects.toThrow(/migrate count 2 !== expected 234/);
    // The default expect (234) tripped before seeding — nothing written, nothing deleted.
    await expect(fs.readdir(plan_tasks_dir())).rejects.toThrow();
    expect((await fs.readdir(backlog_dir)).length).toEqual(4);
  });

  it("is a clean no-op re-run after a completed migration (--expect-migrate 0)", async () => {
    await run(["--execute", "--expect-migrate", "2"]);
    const second = await run(["--expect-migrate", "0"]);
    expect(second.counts.migrate).toEqual(0);
    expect(second.executed).toEqual(false);
  });
});
