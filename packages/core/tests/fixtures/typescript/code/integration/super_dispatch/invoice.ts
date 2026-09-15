// An override chaining past a parent that inherits the member from its own base - invoice.ts

import { Document } from "./model";

export class Invoice extends Document {
  validate(): boolean {
    return super.validate();
  }
}
