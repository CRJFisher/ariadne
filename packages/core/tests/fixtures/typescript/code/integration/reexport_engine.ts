export class Engine {
  start(): void {}
}

export function helper(): number {
  return 1;
}

export const shared = new Engine();
