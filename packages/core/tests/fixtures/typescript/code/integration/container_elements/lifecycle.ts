export interface IDisposable {
  dispose(): void;
}

export class DisposableMap<K, V extends IDisposable = IDisposable> {
  private readonly store = new Map<K, V>();

  get(key: K): V | undefined {
    return this.store.get(key);
  }

  set(key: K, value: V): void {
    this.store.set(key, value);
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.store.entries();
  }
}
