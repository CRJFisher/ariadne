// Three unrelated classes that happen to carry `dispose` - disposable_carriers.ts

export class Watcher {
  dispose(): void {}
}

export class Cache {
  dispose(): void {}
}

export class Socket {
  dispose(): void {}
}
