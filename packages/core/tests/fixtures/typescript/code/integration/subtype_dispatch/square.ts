// An implementer the caller never imports - square.ts

import { Shape } from "./shape";

export class Square implements Shape {
  area(): number {
    return 4;
  }
}
