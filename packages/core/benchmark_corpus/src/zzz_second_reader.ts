import { helper } from "./utils";

const SECOND_TABLE = [helper];

export function read_second(value: number): number {
  return SECOND_TABLE[0](value);
}
