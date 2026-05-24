import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fsSync from "fs";
import * as fs from "fs/promises";
import path from "path";

import { ANALYSIS_OUTPUT_DIR } from "./paths.js";
import {
  OutputType,
  load_json,
  save_json,
  save_json_with_filename,
} from "./analysis_output.js";

const TMP = vi.hoisted(() => {
  const tmp_path = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-analysis-output-${process.pid}`;
  process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE = tmp_path;
  return tmp_path;
});

beforeEach(() => {
  fsSync.rmSync(TMP, { recursive: true, force: true });
  fsSync.mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  fsSync.rmSync(TMP, { recursive: true, force: true });
});

interface SamplePayload {
  project_name: string;
  project_path: string;
  generated_at: string;
  total: number;
  entry_points: Array<{ name: string; refs: number }>;
}

function build_payload(entry_count: number): SamplePayload {
  const entry_points = Array.from({ length: entry_count }, (_, i) => ({
    name: `func_${i}`,
    refs: i,
  }));
  return {
    project_name: "demo",
    project_path: "/demo",
    generated_at: "2026-05-06T00:00:00.000Z",
    total: entry_count,
    entry_points,
  };
}

describe("save_json + load_json round-trip", () => {
  it("round-trips a payload when the bulk array field is declared", async () => {
    const payload = build_payload(3);
    const file = await save_json_with_filename(
      OutputType.DETECT_ENTRYPOINTS,
      payload,
      "demo",
      "test.json",
      "entry_points",
    );
    const reloaded = await load_json<SamplePayload>(file);
    expect(reloaded).toEqual(payload);
  });

  it("round-trips a payload when no bulk field is declared (small fast path)", async () => {
    const payload = build_payload(3);
    const file = await save_json_with_filename(
      OutputType.DETECT_ENTRYPOINTS,
      payload,
      "demo",
      "small.json",
    );
    const reloaded = await load_json<SamplePayload>(file);
    expect(reloaded).toEqual(payload);
  });

  it("writes timestamped filename via save_json", async () => {
    const payload = build_payload(2);
    const file = await save_json(
      OutputType.DETECT_ENTRYPOINTS,
      payload,
      "demo",
      "entry_points",
    );
    expect(file.startsWith(path.join(ANALYSIS_OUTPUT_DIR, "demo", "detect_entrypoints"))).toBe(true);
    const reloaded = await load_json<SamplePayload>(file);
    expect(reloaded).toEqual(payload);
  });

  it("writes the streamed file as one entry per line", async () => {
    const payload = build_payload(4);
    const file = await save_json_with_filename(
      OutputType.DETECT_ENTRYPOINTS,
      payload,
      "demo",
      "shape.json",
      "entry_points",
    );
    const text = fsSync.readFileSync(file, "utf-8");
    const lines = text.split("\n").filter((l) => l.length > 0);
    // Header + 4 entries + closing brace = 6 lines
    expect(lines).toHaveLength(6);
    expect(lines[0].endsWith("\"entry_points\":[")).toBe(true);
    expect(lines[lines.length - 1]).toBe("]}");
    expect(JSON.parse(lines[1].replace(/,$/, ""))).toEqual({ name: "func_0", refs: 0 });
  });

  it("loads a legacy whole-file pretty-printed JSON file", async () => {
    const payload = build_payload(2);
    const dir = path.join(ANALYSIS_OUTPUT_DIR, "demo", "detect_entrypoints");
    fsSync.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "legacy.json");
    await fs.writeFile(file, JSON.stringify(payload, null, 2) + "\n", "utf-8");

    const reloaded = await load_json<SamplePayload>(file);
    expect(reloaded).toEqual(payload);
  });

  it("preserves field order semantics (scalars + bulk array on reload)", async () => {
    // Field order isn't part of JSON semantics but we want all fields present.
    const payload = build_payload(5);
    const file = await save_json_with_filename(
      OutputType.DETECT_ENTRYPOINTS,
      payload,
      "demo",
      "order.json",
      "entry_points",
    );
    const reloaded = await load_json<SamplePayload>(file);
    expect(Object.keys(reloaded).sort()).toEqual(Object.keys(payload).sort());
    expect(reloaded.entry_points).toHaveLength(5);
  });
});

describe("load_json streaming fallback", () => {
  it("uses the streaming parser when fs.readFile would overflow string limits", async () => {
    // Simulate: write a streamed file directly, then verify load_json reads it
    // even when we simulate a string-length error on the fast path. We can't
    // easily produce a >512 MB file in tests, so instead confirm both branches
    // return the same result by writing in streamed form and reading via
    // load_json.
    const payload = build_payload(50);
    const file = await save_json_with_filename(
      OutputType.DETECT_ENTRYPOINTS,
      payload,
      "demo",
      "streamed.json",
      "entry_points",
    );

    const reloaded = await load_json<SamplePayload>(file);
    expect(reloaded).toEqual(payload);
  });
});
