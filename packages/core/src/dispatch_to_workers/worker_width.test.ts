import { describe, expect, it } from "vitest";
import { compute_worker_width } from "./worker_width";

describe("compute_worker_width", () => {
  it("leaves one core for the main thread on an idle box", () => {
    expect(compute_worker_width(4, 0)).toBe(3);
    expect(compute_worker_width(6, 0)).toBe(5);
  });

  it("spends only the cores the load average leaves free", () => {
    expect(compute_worker_width(6, 3)).toBe(3);
    expect(compute_worker_width(4, 1.5)).toBe(2);
  });

  it("falls to a single worker once the box is saturated", () => {
    expect(compute_worker_width(4, 7)).toBe(1);
    expect(compute_worker_width(4, 19)).toBe(1);
  });

  it("runs one worker on a single-core box", () => {
    expect(compute_worker_width(1, 0)).toBe(1);
    expect(compute_worker_width(1, 8)).toBe(1);
  });
});
