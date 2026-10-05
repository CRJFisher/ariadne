// The compiler's replica of the same declaration - compiler_facade.ts

export interface CompilerFacade {
  compileNgModule(meta: string): string;
  compileComponent(meta: string): string;
  compilePipe(meta: string): string;
}
