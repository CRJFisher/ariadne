// A class covering the mandatory members and not the optional one - configured_project.ts

export class ConfiguredProject {
  useCaseSensitiveFileNames(): boolean {
    return true;
  }

  getCurrentDirectory(): string {
    return "/";
  }

  readFile(fileName: string): string | undefined {
    return fileName;
  }
}
