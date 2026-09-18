// One member short of the facade, so it never conforms - near_impl.ts

export class PartialFacade {
  compileNgModule(meta: string): string {
    return `module:${meta}`;
  }

  compileComponent(meta: string): string {
    return `component:${meta}`;
  }
}
