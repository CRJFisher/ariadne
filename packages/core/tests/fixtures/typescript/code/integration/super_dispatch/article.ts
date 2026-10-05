// An override chaining to the member its parent declares - article.ts

import { Model } from "./model";

export class Article extends Model {
  save(): void {
    super.save();
  }
}
