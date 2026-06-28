/**
 * Runner-convention suppression for entry-point detection.
 *
 * Some callables are invoked by a language test or benchmark runner rather than
 * by a source-level call, so they have no incoming call edge yet are not dead
 * code. They are suppressed from entry-point detection the same way test-file
 * callables are.
 */

import type { CallableDefinition, FilePath, Language } from "@ariadnejs/types";

/**
 * Rust decorator names recorded at index time for `#[test]` (`test`) and any
 * `#[cfg(test)]` gate (`cfg`). The Rust indexer records a `cfg` decorator only
 * for `cfg(test)` predicates, so its presence alone signals a test-only build.
 */
const RUST_TEST_HARNESS_DECORATORS: ReadonlySet<string> = new Set([
  "test",
  "cfg",
]);

/** ASV discovers benchmark methods by these name prefixes via introspection. */
const ASV_BENCHMARK_METHOD = /^(time|mem|peakmem)_/;

/** ASV benchmark classes live under this directory in a project. */
const ASV_BENCHMARK_DIR = "asv_bench/benchmarks/";

/**
 * Whether a callable is invoked by a test/benchmark runner rather than by a
 * source-level call, and so must not surface as a dead-code entry point.
 *
 * - Rust: a `#[test]` function or any `#[cfg(test)]`-gated definition, detected
 *   from the `test`/`cfg` decorators recorded at index time.
 * - Python: an ASV benchmark method (`time_`/`mem_`/`peakmem_` prefix) defined
 *   under `asv_bench/benchmarks/`, discovered by the ASV runner via
 *   introspection. The directory gate prevents suppressing a same-named method
 *   that merely follows the prefix outside a benchmark suite.
 */
export function is_runner_invoked_callable(
  def: CallableDefinition,
  file_path: FilePath,
  language: Language
): boolean {
  if (language === "rust") {
    return (def.decorators ?? []).some((d) =>
      RUST_TEST_HARNESS_DECORATORS.has(d.name)
    );
  }
  if (language === "python") {
    return (
      file_path.includes(ASV_BENCHMARK_DIR) &&
      ASV_BENCHMARK_METHOD.test(def.name)
    );
  }
  return false;
}
