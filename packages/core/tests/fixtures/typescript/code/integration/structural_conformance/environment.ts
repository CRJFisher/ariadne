// The six-member environment interface nothing declares against - environment.ts

export interface TcbEnvironment {
  reference(ref: string): string;
  referenceType(ref: string): string;
  canReferenceType(ref: string): boolean;
  pipeInst(name: string): string;
  referenceExternalType(name: string): string;
  getPreludeStatements(): string;
}
