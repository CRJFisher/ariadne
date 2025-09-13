#!/usr/bin/env node
import { start_server } from "./start_server";

// Start the server with default options
start_server().catch(console.error);