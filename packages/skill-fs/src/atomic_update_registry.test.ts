import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { atomic_update_registry } from "./atomic_update_registry.js";

let tmp_dir: string;
let registry_path: string;

beforeEach(async () => {
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "atomic-update-"));
  registry_path = path.join(tmp_dir, "registry.json");
  await fs.writeFile(registry_path, "{\"rules\":[]}\n", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp_dir, { recursive: true, force: true });
});

describe("atomic_update_registry", () => {
  it("writes the mutator's `next` content and returns its `result`", async () => {
    const result = await atomic_update_registry(registry_path, async () => ({
      kind: "write",
      next: "{\"rules\":[\"a\"]}\n",
      result: { count: 1 },
    }));
    expect(result).toEqual({ count: 1 });
    expect(await fs.readFile(registry_path, "utf8")).toEqual("{\"rules\":[\"a\"]}\n");
  });

  it("leaves the file untouched on `kind: 'noop'`", async () => {
    const before = await fs.readFile(registry_path, "utf8");
    const result = await atomic_update_registry(registry_path, async () => ({
      kind: "noop",
      result: { count: 0 },
    }));
    expect(result).toEqual({ count: 0 });
    expect(await fs.readFile(registry_path, "utf8")).toEqual(before);
  });

  it("releases the lock when the mutator throws", async () => {
    await expect(
      atomic_update_registry(registry_path, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // Lock sidecar must be cleaned up so a second call succeeds.
    await expect(
      atomic_update_registry(registry_path, async (raw) => ({
        kind: "write",
        next: raw + "// touched\n",
        result: "ok",
      })),
    ).resolves.toEqual("ok");
  });

  it("serializes two overlapping callers — the second sees the first's write", async () => {
    const order: string[] = [];
    const first = atomic_update_registry(registry_path, async (raw) => {
      order.push("first:start");
      await new Promise((r) => setTimeout(r, 80));
      order.push("first:finish");
      return {
        kind: "write",
        next: raw.replace("\"rules\":[]", "\"rules\":[\"first\"]"),
        result: "first",
      };
    });
    // Yield so `first` acquires the lock before `second` queues.
    await new Promise((r) => setTimeout(r, 20));
    const second = atomic_update_registry(registry_path, async (raw) => {
      order.push("second:start");
      const parsed = JSON.parse(raw) as { rules: string[] };
      return {
        kind: "write",
        next: JSON.stringify({ rules: [...parsed.rules, "second"] }) + "\n",
        result: "second",
      };
    });
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(order).toEqual(["first:start", "first:finish", "second:start"]);
    const final = JSON.parse(await fs.readFile(registry_path, "utf8")) as {
      rules: string[];
    };
    expect(final.rules).toEqual(["first", "second"]);
  });
});
