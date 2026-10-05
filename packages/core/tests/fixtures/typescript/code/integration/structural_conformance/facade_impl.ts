// The implementation, declaring neither replica - facade_impl.ts

export class CompilerFacadeImpl {
  compileNgModule(meta: string): string {
    return `module:${meta}`;
  }

  compileComponent(meta: string): string {
    return `component:${meta}`;
  }

  compilePipe(meta: string): string {
    return `pipe:${meta}`;
  }
}
