import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { next_backlog_task_id, parse_backlog_top_level_id } from "./next_backlog_task_id.js";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "backlog-mint-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("parse_backlog_top_level_id", () => {
  it("reads the leading integer of a top-level id", () => {
    expect(parse_backlog_top_level_id("task-346 - Foo.md")).toEqual(346);
  });

  it("reads only the leading integer of a hierarchical id", () => {
    expect(parse_backlog_top_level_id("task-190.22.10 - Bar.md")).toEqual(190);
  });

  it("returns null for a non-task filename", () => {
    expect(parse_backlog_top_level_id("task-foo.md")).toEqual(null);
    expect(parse_backlog_top_level_id("notes.md")).toEqual(null);
  });
});

describe("next_backlog_task_id", () => {
  it("returns 1 for an absent root", async () => {
    expect(await next_backlog_task_id(path.join(root, "nope"))).toEqual(1);
  });

  it("returns 1 for an empty tree", async () => {
    expect(await next_backlog_task_id(root)).toEqual(1);
  });

  it("returns max + 1 over a flat tree, ignoring gaps and non-task files", async () => {
    await fs.writeFile(path.join(root, "task-5 - a.md"), "", "utf8");
    await fs.writeFile(path.join(root, "task-200 - b.md"), "", "utf8");
    await fs.writeFile(path.join(root, "task-foo.md"), "", "utf8");
    await fs.writeFile(path.join(root, ".DS_Store"), "", "utf8");
    expect(await next_backlog_task_id(root)).toEqual(201);
  });

  it("scans the whole tree recursively, so an archived id beats the live max", async () => {
    await fs.writeFile(path.join(root, "task-100 - live.md"), "", "utf8");
    const archive = path.join(root, "archive", "tasks");
    await fs.mkdir(archive, { recursive: true });
    await fs.writeFile(path.join(archive, "task-900 - retired.md"), "", "utf8");
    expect(await next_backlog_task_id(root)).toEqual(901);
  });
});
