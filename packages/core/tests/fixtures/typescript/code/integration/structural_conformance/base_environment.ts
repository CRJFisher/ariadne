// Three of the environment's members, on the base - base_environment.ts

export class BaseEnvironment {
  reference(ref: string): string {
    return ref;
  }

  referenceType(ref: string): string {
    return ref;
  }

  canReferenceType(ref: string): boolean {
    return ref.length > 0;
  }
}
