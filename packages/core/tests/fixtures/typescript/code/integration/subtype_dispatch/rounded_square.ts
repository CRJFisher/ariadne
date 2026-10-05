// A subtype one hop below the interface: its edge names Square, not Shape - rounded_square.ts

import { Square } from "./square";

export class RoundedSquare extends Square {
  area(): number {
    return 3.5;
  }
}
