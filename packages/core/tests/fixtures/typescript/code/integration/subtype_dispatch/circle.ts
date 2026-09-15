// A second implementer, arriving after the caller already resolved - circle.ts

import { Shape } from "./shape";

export class Circle implements Shape {
  area(): number {
    return 3;
  }
}
