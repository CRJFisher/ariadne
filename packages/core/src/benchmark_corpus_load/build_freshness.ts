/**
 * Whether a checkout's built packages are the ones its source describes.
 *
 * An arm resolves from source, but two things it runs are built: the indexing
 * pass runs on worker threads that load `packages/core/dist`, and core reads
 * `@ariadnejs/types` through its package entry, `packages/types/dist`. A build
 * that does not match its source makes the arm measure two trees at once and
 * report the result as one, with nothing in the numbers to say so, so such an
 * arm is refused rather than run.
 *
 * The checkout's own TypeScript decides whether each package would build,
 * because it compares what a source file holds rather than when it was
 * written. A checkout whose files were only touched is still built; a
 * timestamp comparison would refuse it, and no rebuild would clear the
 * refusal, because core's `tsc -p` leaves an unchanged build info unwritten.
 * The query files are copied beside the compiled code rather than compiled, so
 * they are compared byte for byte.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

interface StaleBuild {
  /** The package directory, relative to the checkout root. */
  readonly package_dir: string;
  readonly reason: string;
}

const CORE_DIR = path.join("packages", "core");
const BUILD_CONFIG = "tsconfig.build.json";
const WORKER_ENTRY = path.join("dist", "dispatch_to_workers", "worker_entry.js");
const QUERY_DIR = path.join("index_single_file", "query_code_tree", "queries");

/**
 * Throw when any package an arm on `repo_root` runs built is missing its build
 * or has a build that does not match its source, naming each stale package and
 * the command that rebuilds it.
 */
export function assert_builds_current(repo_root: string): void {
  // TypeScript reports the real path of every project it reads, so a root
  // reached through a symlink is compared as the directory it names.
  const root = fs.realpathSync(repo_root);
  const stale = find_stale_builds(root);
  if (stale.length === 0) {
    return;
  }
  const reasons = stale.map(({ package_dir, reason }) => `  ${package_dir}: ${reason}`);
  // TypeScript lists the projects it would build in build order, so a stale
  // types package is rebuilt before the core that compiles against it.
  const packages = [...new Set(stale.map(({ package_dir }) => package_dir))];
  const rebuild = packages.map((package_dir) => `  (cd ${path.join(root, package_dir)} && npm run build)`);
  throw new Error(
    [
      `The checkout at ${root} has builds that do not match its source, so an arm on it would measure another tree's code:`,
      ...reasons,
      "Rebuild with:",
      ...rebuild,
    ].join("\n")
  );
}

function find_stale_builds(repo_root: string): StaleBuild[] {
  const core_dir = path.join(repo_root, CORE_DIR);
  const tsc = require.resolve("typescript/bin/tsc", { paths: [core_dir] });

  const stale: StaleBuild[] = projects_tsc_would_build(tsc, core_dir).map((project_dir) => ({
    package_dir: path.relative(repo_root, project_dir),
    reason: "its compiled output does not match its source",
  }));

  if (!fs.existsSync(path.join(core_dir, WORKER_ENTRY))) {
    stale.push({ package_dir: CORE_DIR, reason: `it has no built worker entry at ${WORKER_ENTRY}` });
  }

  for (const query of differing_query_copies(path.join(core_dir, "src", QUERY_DIR), path.join(core_dir, "dist", QUERY_DIR))) {
    stale.push({ package_dir: CORE_DIR, reason: `its built copy of ${query} does not match the source` });
  }

  return stale;
}

/**
 * The directories of the projects `tsc -b --dry` says it would build, core's
 * build config and every project it references.
 *
 * TypeScript's dry run reports each project it would build on a line of its
 * own. A run that does not list the projects at all is not one this can read,
 * and passing it as current would re-open the gap this exists to close, so it
 * throws instead.
 */
function projects_tsc_would_build(tsc: string, core_dir: string): string[] {
  const output = execFileSync(process.execPath, [tsc, "-b", BUILD_CONFIG, "--dry", "--verbose"], {
    cwd: core_dir,
    encoding: "utf8",
  });
  if (!output.includes("Projects in this build")) {
    throw new Error(`Could not read which projects TypeScript would build in ${core_dir}:\n${output}`);
  }
  const would_build = /A non-dry build would build project '([^']+)'/g;
  return [...output.matchAll(would_build)].map((match) => path.dirname(path.resolve(core_dir, match[1])));
}

/** The query files whose copy in `dist_dir` is missing or differs from the one in `src_dir`. */
function differing_query_copies(src_dir: string, dist_dir: string): string[] {
  return fs
    .readdirSync(src_dir)
    .filter((name) => name.endsWith(".scm"))
    .filter((name) => {
      const copy = path.join(dist_dir, name);
      return !fs.existsSync(copy) || !fs.readFileSync(copy).equals(fs.readFileSync(path.join(src_dir, name)));
    })
    .sort();
}
