/**
 * The precision a measured number is recorded at.
 *
 * Rounding happens once, where the row is built. These pin the two precisions
 * so a change to either fails here rather than showing up as two reports of
 * one arm disagreeing in their last digit.
 */

import { describe, expect, it } from "vitest";
import { round_to_hundredth, round_to_tenth } from "./round_measurement";

describe("round_to_tenth", () => {
  it("rounds a millisecond figure to a tenth", () => {
    expect(round_to_tenth(510_255.44)).toEqual(510_255.4);
    expect(round_to_tenth(510_255.45)).toEqual(510_255.5);
  });

  it("rounds half away from zero on the positive side", () => {
    expect(round_to_tenth(0.05)).toEqual(0.1);
  });

  it("leaves a value already at a tenth alone", () => {
    expect(round_to_tenth(4000.1)).toEqual(4000.1);
  });

  it("rounds zero to zero rather than to negative zero", () => {
    expect(Object.is(round_to_tenth(0), 0)).toEqual(true);
  });
});

describe("round_to_hundredth", () => {
  it("keeps two decimals, which is what tells two speedups apart", () => {
    // 1.57 and 1.5 are different claims about the same pair of arms.
    expect(round_to_hundredth(1.5701)).toEqual(1.57);
    expect(round_to_hundredth(2.2019)).toEqual(2.2);
  });

  it("rounds a percentage spread to a hundredth", () => {
    expect(round_to_hundredth(23.8461)).toEqual(23.85);
  });

  it("leaves a value already at a hundredth alone", () => {
    expect(round_to_hundredth(0.51)).toEqual(0.51);
  });
});
