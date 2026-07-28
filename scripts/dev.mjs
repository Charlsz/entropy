import { spawn } from "node:child_process";
import { Socket } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const children = [];

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
    ...options,
  });
  children.push(child);
  return child;
}

function exec(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: isWindows,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function waitForPort(port, host = "127.0.0.1", timeoutMs = 30000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = new Socket();
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}`));
          return;
        }
        setTimeout(attempt, 200);
      });
      socket.connect(port, host);
    };
    attempt();
  });
}

function shutdown() {
  for (const child of children) {
    child.kill();
  }
  process.exit(0);
}

async function main() {
  console.log("Building main and preload…");
  await Promise.all([
    exec("npx", ["tsc", "-p", "tsconfig.main.json"]),
    exec("npx", ["tsc", "-p", "tsconfig.preload.json"]),
  ]);

  console.log("Starting Vite (no browser)…");
  run("npx", ["vite", "--config", "vite.config.ts"], {
    env: {
      ...process.env,
      BROWSER: "none",
    },
  });
  await waitForPort(5173);

  console.log("Starting Electron desktop window…");
  const electron = run("npx", ["electron", "."], {
    env: {
      ...process.env,
      ENTROPY_DEV: "1",
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      BROWSER: "none",
    },
  });

  electron.on("exit", shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
