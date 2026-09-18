// The contribution interface: declares `dispose` without extending IDisposable - editor_contribution.ts
// vscode's shape verbatim, optional markers included: conformance reads member
// names only, so all three are required of a conforming class (see
// `structural_conformance.ts` on what that costs).

export interface IEditorContribution {
  dispose(): void;
  saveViewState?(): string;
  restoreViewState?(state: string): void;
}
