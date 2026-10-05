// TASK-350 evidence — NestJS ApplicationConfig.
// Faithful-minimal: the declared type of an optional constructor param-property
// receiver. Its members are reached ONLY through that receiver, so they are
// false-positive entry points whenever the receiver type is lost at indexing.
export class ApplicationConfig {
  private globalPipes: unknown[] = [];

  getGlobalPipes(): unknown[] {
    return this.globalPipes;
  }

  getGlobalGuards(): unknown[] {
    return this.globalPipes;
  }

  setMocker(): void {
    this.globalPipes = [];
  }
}
