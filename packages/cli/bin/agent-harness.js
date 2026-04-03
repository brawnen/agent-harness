#!/usr/bin/env node

import { run } from "../src/index.js";

const exitCode = run(process.argv.slice(2));
process.exit(exitCode);
