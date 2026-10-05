/**
 * The peak resident set an arm reached.
 *
 * Node reports current RSS rather than a high-water mark, so the peak is
 * sampled and the value is not deterministic. What is deterministic — and what
 * these pin — is that the peak is never below a reading taken while sampling,
 * that the closing reading counts, and that it is reported at the precision
 * every other megabyte figure on the row uses.
 */

import { describe, expect, it } from "vitest";
import { start_resident_set_sampler } from "./resident_set_sampler";

const BYTES_PER_MB = 1024 * 1024;

describe("start_resident_set_sampler", () => {
  it("never reports a peak below a reading taken while it sampled", () => {
    const sampler = start_resident_set_sampler();
    const during_mb = process.memoryUsage.rss() / BYTES_PER_MB;
    const peak = sampler.stop();
    // Rounded to a tenth, so the peak may sit up to 0.05 MB below the raw
    // reading it came from.
    expect(peak >= during_mb - 0.05).toEqual(true);
  });

  it("takes the closing reading, so a sub-second arm still reports a peak", () => {
    // No interval fires inside an arm shorter than the sampling period. Without
    // the closing reading the arm would report a peak of zero as a measurement.
    const sampler = start_resident_set_sampler(60_000);
    expect(sampler.stop() > 0).toEqual(true);
  });

  it("reports the peak to a tenth of a megabyte", () => {
    const peak = start_resident_set_sampler().stop();
    expect(peak).toEqual(Math.round(peak * 10) / 10);
  });

  it("keeps the peak it saw after it has stopped", () => {
    // Stopping clears the timer, so a second read returns the same high-water
    // mark unless the closing reading itself is higher.
    const sampler = start_resident_set_sampler(1);
    const first = sampler.stop();
    expect(sampler.stop() >= first).toEqual(true);
  });
});
