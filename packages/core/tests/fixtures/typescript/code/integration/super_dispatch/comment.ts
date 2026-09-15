// A sibling override nothing calls - comment.ts

import { Model } from "./model";

export class Comment extends Model {
  save(): void {}
}
