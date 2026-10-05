// The caller: the receiver is one element read out of a keyed container - contribution_disposer.ts

import { IEditorContribution } from "./editor_contribution";

export function disposeAll(contributions: Map<string, IEditorContribution>): void {
  for (const contribution of contributions.values()) {
    contribution.dispose();
  }
}
