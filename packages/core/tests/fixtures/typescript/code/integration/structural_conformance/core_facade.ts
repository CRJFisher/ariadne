// Core's declaration of the facade - core_facade.ts
// Tests: nothing in the project declares `implements CoreFacade`; the compiler
// implements the facade against its own replica of this interface, so only the
// members connect the two.

export interface CompilerFacade {
  compileNgModule(meta: string): string;
  compileComponent(meta: string): string;
  compilePipe(meta: string): string;
}
