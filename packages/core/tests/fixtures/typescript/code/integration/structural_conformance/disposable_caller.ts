// The caller: a one-member interface must not fan out to every carrier - disposable_caller.ts

import { IDisposable } from "./disposable";

export function release(target: IDisposable): void {
  target.dispose();
}
