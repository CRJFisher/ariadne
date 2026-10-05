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
 * The type-parameter environment binds `_register<T>(o: T): T` from a call's
 * arguments, but three facts that shape needs are not recorded: a class field
 * keeps no call initialiser (only a variable does), a construction argument is
 * not an identifier so it occupies its position as `null`, and a container's
 * element is read from a binding's own annotation rather than from a bound type
 * parameter's arguments. Until those land, this fixture declares the element
 * where a container annotation states it.
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
