#!/usr/bin/env node
import {
  parse_cli_args,
  resolve_show_suppressed,
  resolve_toolsets,
} from "./cli_args";
import { start_server } from "./server";

const cli_options = parse_cli_args();
start_server({
  project_path: cli_options.project_path,
  watch: cli_options.watch,
  toolsets: resolve_toolsets(cli_options.toolsets),
  show_suppressed: resolve_show_suppressed(cli_options.show_suppressed),
}).catch(console.error);
