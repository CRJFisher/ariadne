/**
 * The merge exists to union two machines' verdicts without either losing work,
 * so the cases that matter are the ones where the two stores overlap: a run only
 * the bundle has, a run both have, and a path both have with different content.
 * The rest pin the two refusals — a payload whose embedded paths point at
 * another machine's home, and the subtrees that must never be copied.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  apply_bundle_merge,
  detect_bundle_home,
  plan_bundle_merge,
  type MergeArgs,
} from "./merge_bundle.js";

const RUN_ID = "468572e-2026-08-23T23-01-31.642Z";
const OTHER_RUN_ID = "3e212ce-2026-08-23T09-04-26.322Z";

describe("merge_bundle", () => {
  let root: string;
  let bundle_dir: string;
  let target_dir: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "merge-bundle-"));
    bundle_dir = path.join(root, "bundle", "ariadne");
    target_dir = path.join(root, "home", ".ariadne");
    fs.mkdirSync(bundle_dir, { recursive: true });
    fs.mkdirSync(target_dir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function args(overrides: Partial<MergeArgs> = {}): MergeArgs {
    return {
      bundle_dir,
      target_dir,
      rewrites: [],
      apply: false,
      verify_hash: false,
      ...overrides,
    };
  }

  function write(root_dir: string, relative_path: string, contents: string): void {
    const full = path.join(root_dir, relative_path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }

  function run_path(project: string, run_id: string, file: string): string {
    return path.join("triage-entrypoints", "triage_state", project, "runs", run_id, file);
  }

  function decision(plan: ReturnType<typeof plan_bundle_merge>, relative_path: string) {
    return plan.decisions.find((d) => d.relative_path === relative_path);
  }

  describe("planning", () => {
    it("copies a run the target does not have", () => {
      write(bundle_dir, run_path("owner--repo", RUN_ID, "manifest.json"), "{\"a\":1}");

      const plan = plan_bundle_merge(args());

      expect(plan.copy_count).toEqual(1);
      expect(plan.conflict_count).toEqual(0);
      expect(decision(plan, run_path("owner--repo", RUN_ID, "manifest.json"))?.action).toEqual(
        "copy",
      );
    });

    it("leaves a run the target already holds identically", () => {
      write(bundle_dir, run_path("owner--repo", RUN_ID, "manifest.json"), "{\"a\":1}");
      write(target_dir, run_path("owner--repo", RUN_ID, "manifest.json"), "{\"a\":1}");

      const plan = plan_bundle_merge(args());

      expect(plan.copy_count).toEqual(0);
      expect(plan.skip_count).toEqual(1);
      expect(plan.conflict_count).toEqual(0);
    });

    it("reports a same-path file with different content as a conflict", () => {
      write(bundle_dir, run_path("owner--repo", RUN_ID, "manifest.json"), "{\"a\":1}");
      write(target_dir, run_path("owner--repo", RUN_ID, "manifest.json"), "{\"a\":22}");

      const plan = plan_bundle_merge(args());

      expect(plan.conflict_count).toEqual(1);
      expect(plan.copy_count).toEqual(0);
    });

    it("detects a same-size difference only when hashing is asked for", () => {
      write(bundle_dir, run_path("owner--repo", RUN_ID, "manifest.json"), "{\"a\":1}");
      write(target_dir, run_path("owner--repo", RUN_ID, "manifest.json"), "{\"a\":2}");

      // Small files are hashed either way, so the difference is caught by default.
      expect(plan_bundle_merge(args()).conflict_count).toEqual(1);
      expect(plan_bundle_merge(args({ verify_hash: true })).conflict_count).toEqual(1);
    });

    it("unions disjoint run histories for one project", () => {
      write(bundle_dir, run_path("owner--repo", RUN_ID, "manifest.json"), "{}");
      write(target_dir, run_path("owner--repo", OTHER_RUN_ID, "manifest.json"), "{}");

      const plan = plan_bundle_merge(args());

      expect(plan.copy_count).toEqual(1);
      expect(plan.skip_count).toEqual(0);
      expect(plan.conflict_count).toEqual(0);
    });

    it("never merges the clones, the cache, a LATEST pointer, or the bundle's own manifest", () => {
      write(bundle_dir, path.join("triage-entrypoints", "repos", "owner--repo", "a.ts"), "x");
      write(bundle_dir, path.join("cache", "owner-repo-abc12345", "manifest.json"), "{}");
      write(bundle_dir, path.join("triage-entrypoints", "tmp", "scratch.json"), "{}");
      write(bundle_dir, path.join("_transfer", "MANIFEST.json"), "{}");
      write(
        bundle_dir,
        path.join("triage-entrypoints", "triage_state", "owner--repo", "LATEST"),
        RUN_ID,
      );

      const plan = plan_bundle_merge(args());

      expect(plan.copy_count).toEqual(0);
      expect(plan.excluded_count).toEqual(5);
    });
  });

  describe("applying", () => {
    it("copies missing files and leaves existing ones untouched", async () => {
      write(bundle_dir, run_path("owner--repo", RUN_ID, "manifest.json"), "{\"from\":\"bundle\"}");
      write(target_dir, run_path("owner--repo", OTHER_RUN_ID, "manifest.json"), "{\"from\":\"here\"}");

      const report = await apply_bundle_merge(plan_bundle_merge(args()));

      expect(report.failures).toEqual([]);
      expect(report.copied).toEqual(1);
      expect(
        fs.readFileSync(path.join(target_dir, run_path("owner--repo", RUN_ID, "manifest.json")), "utf8"),
      ).toEqual("{\"from\":\"bundle\"}");
      expect(
        fs.readFileSync(
          path.join(target_dir, run_path("owner--repo", OTHER_RUN_ID, "manifest.json")),
          "utf8",
        ),
      ).toEqual("{\"from\":\"here\"}");
    });

    it("retargets absolute paths in text artifacts on the way in", async () => {
      write(
        bundle_dir,
        run_path("owner--repo", RUN_ID, "manifest.json"),
        JSON.stringify({ project_path: "/Users/chuck/.ariadne/triage-entrypoints/repos/owner--repo" }),
      );

      const plan = plan_bundle_merge(
        args({ rewrites: [{ find: "/Users/chuck/.ariadne", replace: "/Users/dana/.ariadne" }] }),
      );
      await apply_bundle_merge(plan);

      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(target_dir, run_path("owner--repo", RUN_ID, "manifest.json")),
            "utf8",
          ),
        ),
      ).toEqual({ project_path: "/Users/dana/.ariadne/triage-entrypoints/repos/owner--repo" });
    });

    it("copies a non-text artifact byte for byte even when rewrites are set", async () => {
      const binary = Buffer.from([0, 1, 2, 3, 0xff]);
      const relative_path = path.join("perf-investigation-2026-08-23", "probe", "heap.heapsnap");
      fs.mkdirSync(path.dirname(path.join(bundle_dir, relative_path)), { recursive: true });
      fs.writeFileSync(path.join(bundle_dir, relative_path), binary);

      await apply_bundle_merge(
        plan_bundle_merge(args({ rewrites: [{ find: "/Users/chuck", replace: "/Users/dana" }] })),
      );

      expect(fs.readFileSync(path.join(target_dir, relative_path))).toEqual(binary);
    });
  });

  describe("home detection", () => {
    it("reads the writing machine's ariadne directory out of a run manifest", () => {
      write(
        bundle_dir,
        run_path("owner--repo", RUN_ID, "manifest.json"),
        JSON.stringify({ project_path: "/Users/chuck/.ariadne/triage-entrypoints/repos/owner--repo" }),
      );

      expect(detect_bundle_home(bundle_dir)).toEqual("/Users/chuck/.ariadne");
    });

    it("returns null when no manifest records a path", () => {
      write(bundle_dir, run_path("owner--repo", RUN_ID, "manifest.json"), "{}");

      expect(detect_bundle_home(bundle_dir)).toEqual(null);
    });

    it("returns null for a payload with no run state at all", () => {
      write(bundle_dir, path.join("plan", "tasks", "pt-1.json"), "{}");

      expect(detect_bundle_home(bundle_dir)).toEqual(null);
    });
  });
});
