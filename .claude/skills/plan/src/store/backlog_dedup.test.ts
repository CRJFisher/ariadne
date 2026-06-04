import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { read_exported_backlog_keys } from "./backlog_dedup.js";

let backlog_dir: string;

beforeEach(async () => {
  backlog_dir = await fs.mkdtemp(path.join(os.tmpdir(), "plan-backlog-"));
});

afterEach(async () => {
  await fs.rm(backlog_dir, { recursive: true, force: true });
});

/** Write a backlog task .md with the given frontmatter lines. */
async function write_task(name: string, frontmatter: string, body = "body"): Promise<void> {
  await fs.writeFile(path.join(backlog_dir, name), `---\n${frontmatter}\n---\n\n${body}\n`, "utf8");
}

describe("read_exported_backlog_keys", () => {
  it("maps plan_dedup_key → task id for tasks carrying both fields", async () => {
    await write_task("task-500.md", "id: TASK-500\nstatus: To Do\nplan_dedup_key: aaa111");
    await write_task("task-501.md", "id: TASK-501\nstatus: To Do\nplan_dedup_key: bbb222");
    // A human-authored task with no plan_dedup_key is invisible to the engine.
    await write_task("task-502.md", "id: TASK-502\nstatus: To Do");

    const keys = await read_exported_backlog_keys(backlog_dir);
    expect(keys).toEqual(
      new Map([
        ["aaa111", "TASK-500"],
        ["bbb222", "TASK-501"],
      ]),
    );
  });

  it("parses frontmatter saved with CRLF line endings", async () => {
    await fs.writeFile(
      path.join(backlog_dir, "task-550.md"),
      "---\r\nid: TASK-550\r\nplan_dedup_key: ccc999\r\n---\r\n\r\nbody\r\n",
      "utf8",
    );
    const keys = await read_exported_backlog_keys(backlog_dir);
    expect(keys).toEqual(new Map([["ccc999", "TASK-550"]]));
  });

  it("strips surrounding quotes from the id and key", async () => {
    await write_task("task-600.md", 'id: "TASK-600"\nplan_dedup_key: "ccc333"');
    const keys = await read_exported_backlog_keys(backlog_dir);
    expect(keys).toEqual(new Map([["ccc333", "TASK-600"]]));
  });

  it("excludes a task carrying plan_dedup_key but no id", async () => {
    await write_task("task-700.md", "status: To Do\nplan_dedup_key: ddd444");
    const keys = await read_exported_backlog_keys(backlog_dir);
    expect(keys).toEqual(new Map());
  });

  it("ignores non-.md files and files with no frontmatter", async () => {
    await fs.writeFile(path.join(backlog_dir, "notes.txt"), "id: TASK-1\nplan_dedup_key: x", "utf8");
    await fs.writeFile(path.join(backlog_dir, "task-800.md"), "no frontmatter here\n", "utf8");
    const keys = await read_exported_backlog_keys(backlog_dir);
    expect(keys).toEqual(new Map());
  });

  it("returns an empty map when the directory does not exist", async () => {
    const keys = await read_exported_backlog_keys(path.join(backlog_dir, "missing"));
    expect(keys).toEqual(new Map());
  });
});
