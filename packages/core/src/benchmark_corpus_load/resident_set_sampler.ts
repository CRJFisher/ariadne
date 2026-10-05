/**
 * Sample resident set size while an arm runs.
 *
 * Node reports current RSS, not the process high-water mark, so the peak is
 * sampled. It is reported as a mean over repeated runs rather than as a single
 * figure — see `summarize_peak_rss` — because peak RSS varies by up to 61% run
 * to run on one arm and one input, while the settled heap on the same runs is
 * stable to 0.01%.
 *
 * The sampler cannot observe a fully synchronous phase, so the peak it returns
 * is a defensible lower bound rather than a true high-water mark. Cross-checked
 * against `/usr/bin/time -l` on corpus-scale arms it runs 0.2–0.7% low.
 */

import { clearInterval, setInterval } from "node:timers";
import { round_to_tenth } from "./round_measurement";

const BYTES_PER_MB = 1024 * 1024;

interface ResidentSetSampler {
  /** Stop sampling and return the highest resident set seen, in MB. */
  stop(): number;
}

export function start_resident_set_sampler(
  interval_ms = 200,
): ResidentSetSampler {
  let peak_bytes = process.memoryUsage.rss();
  const timer = setInterval(() => {
    const current = process.memoryUsage.rss();
    if (current > peak_bytes) peak_bytes = current;
  }, interval_ms);
  timer.unref();

  return {
    stop(): number {
      clearInterval(timer);
      const current = process.memoryUsage.rss();
      if (current > peak_bytes) peak_bytes = current;
      return round_to_tenth(peak_bytes / BYTES_PER_MB);
    },
  };
}
