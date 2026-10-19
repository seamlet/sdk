#!/usr/bin/env node
import process from "node:process";
import { runInit } from "./init/init-command";

// The command of the package: `npx @seamlet/astro init`.

const code = await runInit({
  root: process.cwd(),
  argv: process.argv.slice(2),
  log: (line) => {
    console.log(line);
  },
});
process.exitCode = code;
