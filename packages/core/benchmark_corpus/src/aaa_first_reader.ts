import { helper } from "./utils";

const FIRST_TABLE = [helper];

export function read_first(value: number): number {
  return FIRST_TABLE[0](value);
}
