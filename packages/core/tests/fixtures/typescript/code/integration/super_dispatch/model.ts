// A base whose members its subclasses override and chain to - model.ts
// Tests: a `super` call that finds the member on the parent, or above it,
// resolves to that member alone — never to the caller's own override or a
// sibling's

export class Model {
  save(): void {}

  validate(): boolean {
    return true;
  }
}

export class Document extends Model {
  render(): string {
    return "";
  }
}
