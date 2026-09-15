import { DisposableMap } from "./lifecycle";

export interface IEditorContribution {
  dispose(): void;
  toString(): string;
}

export class MarkerDecorations implements IEditorContribution {
  dispose(): void {}
}

/**
 * vscode codeEditorContributions.ts holds its contributions in a
 * `DisposableMap<string, IEditorContribution>` and disposes each element.
 *
 * The real field is unannotated and wrapped:
 * `_instances = this._register(new DisposableMap<string, IEditorContribution>())`.
 * Its element is reachable only by binding `_register<T>(o: T): T`'s type
 * parameter from its argument and reading the construction's own type
 * arguments — TASK-376.15's type-parameter environment — so this fixture
 * declares the element where a container annotation states it.
 */
export class CodeEditorContributions {
  private readonly _instances: DisposableMap<string, IEditorContribution> = new DisposableMap();

  disposeAll(): void {
    for (const [, instance] of this._instances) {
      instance.dispose();
    }
  }

  disposeOne(id: string): void {
    this._instances.get(id)!.dispose();
  }
}

export function disposePending(contributions: Map<string, IEditorContribution>, id: string): void {
  for (const pending of contributions.values()) {
    pending.dispose();
  }
  contributions.get(id)!.dispose();
  for (const entry of contributions) {
    entry.toString();
  }
}
