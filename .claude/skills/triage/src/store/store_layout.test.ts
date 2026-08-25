/**
 * The layout module restates two path segments that skill-protocol keeps
 * private, so the load-bearing test here is the one that re-derives them from
 * skill-protocol's own builders: if the protocol ever renames a directory, the
 * survey and merge tools must fail loudly rather than address an empty path.
 * The rest of the surface is composition, exercised through the store root a
 * bundle would be unpacked to.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { analysis_output_dir, triage_results_path } from "@ariadnejs/skill-protocol";

import {
  ANALYSIS_OUTPUT_SUBDIR,
  default_store_dir,
  detect_entrypoints_root,
  list_analysis_projects,
  list_run_ids,
  list_state_projects,
  list_subdirectories,
  manifest_file,
  project_config_file,
  state_file,
  triage_results_file,
} from "./store_layout.js";

const BUNDLE_ROOT = "/bundle/triage-entrypoints";

describe("store_layout", () => {
  describe("segments mirrored from skill-protocol", () => {
    it("names the same analysis_output directory skill-protocol resolves", () => {
      expect(path.basename(analysis_output_dir())).toEqual(ANALYSIS_OUTPUT_SUBDIR);
    });

    it("names the same triage_results file skill-protocol resolves", () => {
      const protocol_path = triage_results_path("owner--repo", "abc1234-2026-01-01T00-00-00.000Z");
      const layout_path = triage_results_file(
        default_store_dir(),
        "owner--repo",
        "abc1234-2026-01-01T00-00-00.000Z",
      );
      expect(layout_path).toEqual(protocol_path);
    });
  });

  describe("path composition against an arbitrary root", () => {
    it("locates a run's state file", () => {
      expect(state_file(BUNDLE_ROOT, "owner--repo", "abc1234-2026-01-01T00-00-00.000Z")).toEqual(
        "/bundle/triage-entrypoints/triage_state/owner--repo/runs/abc1234-2026-01-01T00-00-00.000Z/triage.json",
      );
    });

    it("locates a run's manifest", () => {
      expect(
        manifest_file(BUNDLE_ROOT, "owner--repo", "abc1234-2026-01-01T00-00-00.000Z"),
      ).toEqual(
        "/bundle/triage-entrypoints/triage_state/owner--repo/runs/abc1234-2026-01-01T00-00-00.000Z/manifest.json",
      );
    });

    it("locates a project's detect_entrypoints directory", () => {
      expect(detect_entrypoints_root(BUNDLE_ROOT, "owner--repo")).toEqual(
        "/bundle/triage-entrypoints/analysis_output/owner--repo/detect_entrypoints",
      );
    });

    it("locates a project's config file", () => {
      expect(project_config_file(BUNDLE_ROOT, "owner--repo")).toEqual(
        "/bundle/triage-entrypoints/project_configs/owner--repo.json",
      );
    });
  });

  describe("discovery", () => {
    let tmp_dir: string;

    beforeEach(() => {
      tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "store-layout-"));
    });

    afterEach(() => {
      fs.rmSync(tmp_dir, { recursive: true, force: true });
    });

    it("returns no subdirectories for an absent directory", () => {
      expect(list_subdirectories(path.join(tmp_dir, "nope"))).toEqual([]);
    });

    it("lists project and run directories in sorted order, ignoring files", () => {
      fs.mkdirSync(path.join(tmp_dir, "triage_state", "b--b", "runs", "r2"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(tmp_dir, "triage_state", "b--b", "runs", "r1"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(tmp_dir, "triage_state", "a--a", "runs"), { recursive: true });
      fs.writeFileSync(path.join(tmp_dir, "triage_state", "NOTES.md"), "x");

      expect(list_state_projects(tmp_dir)).toEqual(["a--a", "b--b"]);
      expect(list_run_ids(tmp_dir, "b--b")).toEqual(["r1", "r2"]);
      expect(list_run_ids(tmp_dir, "a--a")).toEqual([]);
    });

    it("leaves tooling scratch dot-directories out of the project and run lists", () => {
      fs.mkdirSync(path.join(tmp_dir, "triage_state", ".claude", ".cc-writes"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(tmp_dir, "triage_state", "a--a", "runs", ".tmp"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(tmp_dir, "triage_state", "a--a", "runs", "r1"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(tmp_dir, "analysis_output", ".claude", ".cc-writes"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(tmp_dir, "analysis_output", "a--a"), { recursive: true });

      expect(list_state_projects(tmp_dir)).toEqual(["a--a"]);
      expect(list_run_ids(tmp_dir, "a--a")).toEqual(["r1"]);
      expect(list_analysis_projects(tmp_dir)).toEqual(["a--a"]);
    });
  });
});
