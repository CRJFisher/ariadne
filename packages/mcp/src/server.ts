#!/usr/bin/env node
import { startServer } from "./start_server";

// Start the server with default options
startServer().catch(console.error);