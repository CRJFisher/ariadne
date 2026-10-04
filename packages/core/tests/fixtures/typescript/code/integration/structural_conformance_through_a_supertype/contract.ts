// The contract - contract.ts
// Tests: `Widget` extends `Base` by declaration, and nothing declares an
// implementation of `Widget`, so its implementer can only be found by members.

export interface Base {
  run(): void;
}

export interface Widget extends Base {
  show(): void;
  hide(): void;
  dispose(): void;
}
