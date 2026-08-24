/**
 * Identity recovery is the safety property the whole migration rests on: it
 * must read the canonical id out of settled data, never reconstruct it by
 * un-slugging a directory name. These cases pin that — each id generation is
 * recovered from the same recorded `project_path`, and every input that does
 * not carry one is refused rather than guessed at.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  canonical_id_from_project_path,
  identify_project,
  read_project_path,
} from "./project_identity.js";
import { manifest_file, run_dir, state_file, triage_results_root } from "./store_layout.js";

const RUN_ID = "abc1234-2026-08-22T21-42-13.867Z";
const CORPUS = "/Users/chuck/.ariadne/triage-entrypoints/repos/babel--babel";

describe("project_identity", () => {
  let store_dir: string;

  beforeEach(() => {
    store_dir = fs.mkdtempSync(path.join(os.tmpdir(), "project-identity-"));
  });

  afterEach(() => {
    fs.rmSync(store_dir, { recursive: true, force: true });
  });

  function seed_manifest(project_id: string, body: object): void {
    fs.mkdirSync(run_dir(store_dir, project_id, RUN_ID), { recursive: true });
    fs.writeFileSync(manifest_file(store_dir, project_id, RUN_ID), JSON.stringify(body));
  }

  function seed_state(project_id: string, body: object): void {
    fs.mkdirSync(run_dir(store_dir, project_id, RUN_ID), { recursive: true });
    fs.writeFileSync(state_file(store_dir, project_id, RUN_ID), JSON.stringify(body));
  }

  function seed_results(project_id: string, body: object): void {
    const dir = triage_results_root(store_dir, project_id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${RUN_ID}.json`), JSON.stringify(body));
  }

  describe("canonical_id_from_project_path", () => {
    it("names the corpus directory when it is a repos/ clone", () => {
      expect(canonical_id_from_project_path(CORPUS)).toEqual("babel--babel");
    });

    it("refuses a corpus that is not under repos/", () => {
      expect(canonical_id_from_project_path("/Users/chuck/workspace/ariadne")).toEqual(null);
    });

    it("refuses a path whose parent is only named like repos by coincidence of depth", () => {
      expect(canonical_id_from_project_path("/srv/checkouts/babel--babel")).toEqual(null);
    });
  });

  describe("read_project_path", () => {
    it("prefers the manifest over the far larger state file", () => {
      seed_manifest("legacy", { project_path: CORPUS });
      seed_state("legacy", { project_path: "/wrong/repos/other--other" });

      expect(read_project_path(store_dir, "legacy")).toEqual(CORPUS);
    });

    it("falls back to the published results envelope when no manifest survives", () => {
      seed_results("legacy", { project_path: CORPUS });

      expect(read_project_path(store_dir, "legacy")).toEqual(CORPUS);
    });

    it("falls back to the state file when neither manifest nor results survive", () => {
      seed_state("legacy", { project_path: CORPUS });

      expect(read_project_path(store_dir, "legacy")).toEqual(CORPUS);
    });

    it("returns null for a run directory that holds nothing", () => {
      fs.mkdirSync(run_dir(store_dir, "stub", RUN_ID), { recursive: true });

      expect(read_project_path(store_dir, "stub")).toEqual(null);
    });

    it("returns null when an artifact is present but unparseable", () => {
      fs.mkdirSync(run_dir(store_dir, "broken", RUN_ID), { recursive: true });
      fs.writeFileSync(manifest_file(store_dir, "broken", RUN_ID), "{not json");

      expect(read_project_path(store_dir, "broken")).toEqual(null);
    });
  });

  describe("identify_project", () => {
    it("recovers the owner-qualified id from a last-segment legacy id", () => {
      seed_manifest("webpack", {
        project_path: "/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack",
      });

      expect(identify_project(store_dir, "webpack")).toEqual({
        project_id: "webpack",
        project_path: "/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack",
        canonical_project_id: "webpack--webpack",
        verdict: "legacy",
      });
    });

    it("recovers the owner-qualified id from a path-slug legacy id", () => {
      const legacy = "-Users-chuck-.ariadne-triage-entrypoints-repos-babel--babel";
      seed_manifest(legacy, { project_path: CORPUS });

      expect(identify_project(store_dir, legacy)).toEqual({
        project_id: legacy,
        project_path: CORPUS,
        canonical_project_id: "babel--babel",
        verdict: "legacy",
      });
    });

    it("reports a project already stored under its canonical id as canonical", () => {
      seed_manifest("babel--babel", { project_path: CORPUS });

      expect(identify_project(store_dir, "babel--babel")).toEqual({
        project_id: "babel--babel",
        project_path: CORPUS,
        canonical_project_id: "babel--babel",
        verdict: "canonical",
      });
    });

    it("refuses to derive an id for a corpus outside repos/", () => {
      seed_manifest("-Users-chuck-workspace-ariadne", {
        project_path: "/Users/chuck/workspace/ariadne",
      });

      expect(identify_project(store_dir, "-Users-chuck-workspace-ariadne")).toEqual({
        project_id: "-Users-chuck-workspace-ariadne",
        project_path: "/Users/chuck/workspace/ariadne",
        canonical_project_id: null,
        verdict: "outside-repos",
      });
    });

    it("reports an empty run directory as unresolved rather than guessing", () => {
      fs.mkdirSync(run_dir(store_dir, "stub", RUN_ID), { recursive: true });

      expect(identify_project(store_dir, "stub")).toEqual({
        project_id: "stub",
        project_path: null,
        canonical_project_id: null,
        verdict: "unresolved",
      });
    });
  });
});
