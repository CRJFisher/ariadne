import { describe, it, expect } from "vitest";
import { should_log } from "./progress.js";

describe("should_log", () => {
  it("returns false for n=0", () => {
    expect(should_log(0, 0)).toBe(false);
  });

  it("logs every iteration when n <= 50", () => {
    for (let i = 0; i < 50; i++) {
      expect(should_log(i, 50)).toBe(true);
    }
  });

  it("logs first, last, and every ceil(n/20)-th iteration when n > 50", () => {
    const n = 343;
    const step = Math.ceil(n / 20); // 18
    const logged: number[] = [];
    for (let i = 0; i < n; i++) {
      if (should_log(i, n)) logged.push(i);
    }
    expect(logged[0]).toBe(0);
    expect(logged[logged.length - 1]).toBe(n - 1);
    // Should log around n/step times
    expect(logged.length).toBeGreaterThanOrEqual(20);
    expect(logged.length).toBeLessThanOrEqual(22);
    // Sanity: mid-range logs land on step boundaries
    expect(logged).toContain(step - 1);
  });

  it("always logs the final iteration", () => {
    expect(should_log(999, 1000)).toBe(true);
  });

  it("always logs the first iteration", () => {
    expect(should_log(0, 1000)).toBe(true);
  });
});
