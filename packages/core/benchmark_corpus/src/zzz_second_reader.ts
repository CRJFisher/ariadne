import { increment } from "./arithmetic";

const SECOND_TABLE = [increment];

export function read_second(value: number): number {
  return SECOND_TABLE[0](value);
}
