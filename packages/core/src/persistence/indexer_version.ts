import { readFileSync } from "fs";
import { join } from "path";

/**
 * The build of the indexer a cached index came out of.
 *
 * A cached blob is the output of `build_index_single_file` rather than a
 * transcription of the file, so its content depends on the query patterns, the
 * capture handlers, the scope extractors and the definition builders. A blob is
 * therefore valid only for the build that produced it: without this axis a user
 * who upgrades for a query-pattern fix keeps replaying the pre-fix index of
 * every unchanged file, and the fix is invisible on exactly the projects it was
 * written for.
 *
 * The name is the package version because every indexer change ships inside a
 * release. A hand-maintained constant is the failure mode this exists to
 * remove — it invalidates only when somebody remembers.
 *
 * `__dirname` is two levels below the package root from both `src/persistence`
 * and the emitted `dist/persistence`, so one path serves the test run, the
 * benchmark harness and the published build.
 */
export const INDEXER_VERSION: string = read_package_version();

function read_package_version(): string {
  const package_json = readFileSync(
    join(__dirname, "..", "..", "package.json"),
    "utf-8",
  );
  const version = JSON.parse(package_json).version;
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(
      "@ariadnejs/core package.json declares no version, so no cached index can be keyed on the build that wrote it.",
    );
  }
  return version;
}
