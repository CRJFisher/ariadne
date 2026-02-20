/**
 * Utilities module with aliased imports
 * Tests: Aliased import resolution
 */

export function helper() {
  return "original helper";
}

export function processor() {
  return "original processor";
}

export class DataManager {
  process() {
    return "processing data";
  }
}
