// An interface with an optional member a conforming class leaves out - build_program_host.ts
// microsoft/TypeScript's `ReadBuildProgramHost` shape: three mandatory methods
// and an optional `getBuildInfo`.

export interface ReadBuildProgramHost {
  useCaseSensitiveFileNames(): boolean;
  getCurrentDirectory(): string;
  readFile(fileName: string): string | undefined;
  getBuildInfo?(fileName: string): string | undefined;
}
