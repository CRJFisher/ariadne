// Two contributions satisfying the interface structurally only - code_editor_widget.ts

export class FoldingController {
  dispose(): void {}

  saveViewState(): string {
    return "folded";
  }

  restoreViewState(state: string): void {
    void state;
  }
}

// Conforms as TypeScript reads the interface, yet carries one of its methods —
// no more than the unrelated `dispose` carriers do.
export class HoverController {
  dispose(): void {}
}
