#!/usr/bin/env node
import { runInitCommand } from "../lib/init.mjs";
import { runSyncCommand } from "../lib/sync.mjs";
import { runUiCommand } from "../lib/ui.mjs";
import { runVerifyCommand } from "../lib/verify.mjs";

function printHelp() {
  console.log(`Central Harness CLI (ocul)

Usage:
  harness init <id> --stack <react-ts|flutter-app|node-api> [--dir <path>]
  harness sync [id | --all]
  harness verify [id]
  harness ui [--port <port>]
`);
}

const [command, ...args] = process.argv.slice(2);

try {
  if (!command || command === "-h" || command === "--help") {
    printHelp();
  } else if (command === "init") {
    runInitCommand(args);
  } else if (command === "sync") {
    runSyncCommand(args);
  } else if (command === "verify") {
    runVerifyCommand(args);
  } else if (command === "ui") {
    runUiCommand(args);
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
