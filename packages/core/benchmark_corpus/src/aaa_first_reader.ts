import { increment } from "./arithmetic";

const FIRST_TABLE = [increment];

export function read_first(value: number): number {
  return FIRST_TABLE[0](value);
}
