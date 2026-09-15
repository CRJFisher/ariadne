// The caller: names the interface, imports no implementer - measure.ts

import { Shape } from "./shape";

export function measure(shape: Shape): number {
  return shape.area();
}
