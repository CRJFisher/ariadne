import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { atomic_write_file } from "./atomic_write.js";

describe("atomic_write_file", () => {
  let tmp_dir: string;
  let target: string;

  beforeEach(async () => {
    tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "atomic-write-"));
    target = path.join(tmp_dir, "registry.json");
  });

  afterEach(async () => {
    await fs.rm(tmp_dir, { recursive: true, force: true });
  });

  it("writes content to the target path", async () => {
    await atomic_write_file(target, "hello\n");
    const read = await fs.readFile(target, "utf8");
    expect(read).toEqual("hello\n");
  });

  it("overwrites existing content atomically", async () => {
    await fs.writeFile(target, "old\n", "utf8");
    await atomic_write_file(target, "new\n");
    const read = await fs.readFile(target, "utf8");
    expect(read).toEqual("new\n");
  });

  it("leaves no temp files behind on successful write", async () => {
    await atomic_write_file(target, "x\n");
    const entries = await fs.readdir(tmp_dir);
    expect(entries).toEqual(["registry.json"]);
  });

  it("propagates and cleans up when the temp write itself fails", async () => {
    const unwritable = path.join(tmp_dir, "no-such-dir", "registry.json");
    await expect(atomic_write_file(unwritable, "x\n")).rejects.toThrow();
    const entries = await fs.readdir(tmp_dir);
    expect(entries).toEqual([]);
  });

  it("two writers do not interleave — last writer wins, no corruption", async () => {
    const payload_a = `${"a".repeat(10_000)}\n`;
    const payload_b = `${"b".repeat(10_000)}\n`;
    await Promise.all([
      atomic_write_file(target, payload_a),
      atomic_write_file(target, payload_b),
    ]);
    const read = await fs.readFile(target, "utf8");
    expect([payload_a, payload_b]).toContain(read);
    const entries = await fs.readdir(tmp_dir);
    expect(entries).toEqual(["registry.json"]);
  });
});
