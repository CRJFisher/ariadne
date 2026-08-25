import { alpha, beta } from "./handlers";

const HANDLERS = [alpha, beta];

export function dispatch(index: number, value: number): number {
  const handler = HANDLERS[index];
  return handler(value);
}
