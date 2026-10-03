// The caller, dispatching through the host interface - build_program_reader.ts

import { ReadBuildProgramHost } from "./build_program_host";

export function readBuildInfo(host: ReadBuildProgramHost, fileName: string): string | undefined {
  return host.readFile(fileName);
}
