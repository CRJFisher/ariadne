// A contribution satisfying the interface structurally only - code_editor_widget.ts

export class FoldingController {
  dispose(): void {}

  saveViewState(): string {
    return "folded";
  }

  restoreViewState(state: string): void {
    void state;
  }
}
