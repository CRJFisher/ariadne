// The contribution interface: declares `dispose` without extending IDisposable - editor_contribution.ts
// vscode's shape verbatim, optional markers included: one mandatory method and
// two optional ones, so only a class carrying all three clears the method floor.

export interface IEditorContribution {
  dispose(): void;
  saveViewState?(): string;
  restoreViewState?(state: string): void;
}
