/**
 * Recover the canonical id of a project already written to a store.
 *
 * A project id names `triage_state/<id>/` and `analysis_output/<id>/`, and it is
 * the join key the known-issues registry records in `observed_projects` and
 * `targets.yaml` records as `project_id`. Three id shapes are on disk, from three
 * generations of the resolver:
 *
 *   - `webpack`                                    — the pre-fix GitHub branch,
 *     which took the last slug segment alone and so collided across owners.
 *   - `-Users-me-.ariadne-...-repos-babel--babel`  — the config/local branch,
 *     which slugs the resolved absolute path.
 *   - `webpack--webpack`                           — the owner-qualified id.
 *
 * Only the third joins. The first two are stranded: their run history is
 * invisible to every reader that looks a project up by its canonical id.
 *
 * Every generation recorded the same thing though — `project_path`, the corpus
 * root — and every corpus is cloned into `repos/<owner>--<repo>`. So the corpus
 * directory's own name *is* the canonical id, and recovering it is a read rather
 * than a reconstruction. That is what makes migrating settled data safe: no id
 * is guessed by un-slugging a string.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  REPOS_SUBDIR,
  list_run_ids,
  manifest_file,
  state_file,
  triage_results_root,
} from "./store_layout.js";

/** Why a project's canonical id could or could not be recovered. */
export type IdentityVerdict =
  /** Stored under its canonical id already. Nothing to migrate. */
  | "canonical"
  /** Stored under a legacy id; `canonical_project_id` is the id it should carry. */
  | "legacy"
  /** No artifact records a `project_path`, so the id cannot be checked at all. */
  | "unresolved"
  /** The corpus is not a `repos/<owner>--<repo>` clone, so its id is not derivable. */
  | "outside-repos";

export interface ProjectIdentity {
  /** The directory name the project is stored under today. */
  project_id: string;
  /** The corpus root its runs recorded, or null when nothing recorded one. */
  project_path: string | null;
  /** The id it should be stored under, or null when that is not derivable. */
  canonical_project_id: string | null;
  verdict: IdentityVerdict;
}

function read_json_field(file_path: string, field: string): string | null {
  if (!fs.existsSync(file_path)) return null;
  try {
    const value = (JSON.parse(fs.readFileSync(file_path, "utf8")) as Record<string, unknown>)[
      field
    ];
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Find the `project_path` any artifact of this project recorded.
 *
 * Tried in ascending cost: a run manifest is a few hundred bytes, a published
 * results envelope is a few megabytes, and `triage.json` reaches 280 MB — so the
 * state file is consulted last and only for a run that has no manifest at all.
 */
export function read_project_path(store_dir: string, project_id: string): string | null {
  const run_ids = list_run_ids(store_dir, project_id);

  for (const run_id of run_ids) {
    const from_manifest = read_json_field(
      manifest_file(store_dir, project_id, run_id),
      "project_path",
    );
    if (from_manifest !== null) return from_manifest;
  }

  const results_dir = triage_results_root(store_dir, project_id);
  if (fs.existsSync(results_dir)) {
    for (const name of fs.readdirSync(results_dir).sort()) {
      if (!name.endsWith(".json")) continue;
      const from_results = read_json_field(path.join(results_dir, name), "project_path");
      if (from_results !== null) return from_results;
    }
  }

  for (const run_id of run_ids) {
    const from_state = read_json_field(state_file(store_dir, project_id, run_id), "project_path");
    if (from_state !== null) return from_state;
  }

  return null;
}

/**
 * Derive the canonical id from a recorded corpus path.
 *
 * The guard is on the *parent directory's name*, not on a comparison against
 * this store's `repos/` path: a bundle is surveyed after being unpacked
 * somewhere else entirely, and the paths inside it still point at the machine
 * that wrote them. Requiring the recorded parent to be named `repos` keeps the
 * check meaningful without tying it to where the store currently sits.
 */
export function canonical_id_from_project_path(project_path: string): string | null {
  const parent = path.basename(path.dirname(project_path));
  if (parent !== REPOS_SUBDIR) return null;
  const base = path.basename(project_path);
  return base.length > 0 ? base : null;
}

/** Classify how one stored project relates to the id it should carry. */
export function identify_project(store_dir: string, project_id: string): ProjectIdentity {
  const project_path = read_project_path(store_dir, project_id);
  if (project_path === null) {
    return { project_id, project_path: null, canonical_project_id: null, verdict: "unresolved" };
  }

  const canonical_project_id = canonical_id_from_project_path(project_path);
  if (canonical_project_id === null) {
    return { project_id, project_path, canonical_project_id: null, verdict: "outside-repos" };
  }

  return {
    project_id,
    project_path,
    canonical_project_id,
    verdict: canonical_project_id === project_id ? "canonical" : "legacy",
  };
}
