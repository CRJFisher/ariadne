/**
 * How many worker threads a per-file pass may run right now.
 *
 * There is one dispatch mechanism and one width, so a width of one is the same
 * code running a single worker rather than a serial path beside the pooled one.
 * Load is subtracted rather than ignored because a pool on a contended box is a
 * net loss: at loadavg 7-19 against four cores every pooled arm ran 21% slower
 * in wall and 24-31% higher in CPU than serial, at cpu/wall 0.97 while three
 * workers ran, which is workers taking no extra CPU and stealing it from the
 * critical path.
 *
 * One core stays with the main thread whatever the load reads: it deserializes
 * every result, writes every registry and resolves the corpus, so starving it
 * starves the very path the pool exists to shorten.
 */
export function compute_worker_width(
  cpu_count: number,
  load_average: number,
): number {
  const spare_cores = Math.floor(cpu_count - load_average);
  return Math.max(1, Math.min(cpu_count - 1, spare_cores));
}
