import { spawn } from "node:child_process";
import path from "node:path";
import { HARNESS_ROOT } from "./registry.mjs";

export function runUiCommand(args, harnessRoot = HARNESS_ROOT) {
  const serverEntry = path.join(harnessRoot, "core", "dashboard", "server", "index.mjs");
  const child = spawn(process.execPath, [serverEntry, ...args], {
    cwd: path.join(harnessRoot, "core", "dashboard"),
    stdio: "inherit",
    env: {
      ...process.env,
      HARNESS_ROOT: harnessRoot,
    },
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 0;
  });
}
