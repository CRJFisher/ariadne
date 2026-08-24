import { other_helper } from "./utils";

export function apply_twice(fn: (value: number) => number, value: number): number {
  return fn(fn(value));
}

export function run(value: number): number {
  return apply_twice(other_helper, value);
}
