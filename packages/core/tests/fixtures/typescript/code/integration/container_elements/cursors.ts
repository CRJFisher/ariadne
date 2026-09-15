export class Cursor {
  asCursorState(): void {}

  setState(): void {}
}

/**
 * vscode cursorCollection.ts: the primary cursor is the first element of a
 * field that construction initialises and the class declares as `Cursor[]`.
 */
export class CursorCollection {
  private cursors: Cursor[];

  constructor() {
    this.cursors = [new Cursor()];
  }

  getPrimaryCursor(): void {
    this.cursors[0].asCursorState();
  }

  setSecondaryState(index: number): void {
    this.cursors[index + 1].setState();
  }
}
