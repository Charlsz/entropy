/**
 * Renderer on Vite, main/preload compiled, Electron pointed at localhost.
 * Usage: npm run dev
 */
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const children = [];

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
    ...options,
  });
  children.push(child);
  return child;
}

function waitForPort(port, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Vite did not open port ${port}`));
          return;
        }
        setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

const compileMain = run("npx", ["tsc", "-p", "tsconfig.main.json"]);
const compilePreload = run("npx", ["tsc", "-p", "tsconfig.preload.json"]);

await Promise.all([
  new Promise((resolve, reject) => {
    compileMain.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("main compile failed"))));
  }),
  new Promise((resolve, reject) => {
    compilePreload.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("preload compile failed")),
    );
  }),
]);

run("npx", ["vite"]);
run("npx", ["tsc", "-p", "tsconfig.main.json", "--watch", "--preserveWatchOutput"]);
run("npx", ["tsc", "-p", "tsconfig.preload.json", "--watch", "--preserveWatchOutput"]);

await waitForPort(5173);

const electron = run("npx", ["electron", "--disable-warning=DEP0180", "."], {
  env: { ...process.env, ENTROPY_DEV: "1" },
});

electron.on("exit", (code) => {
  shutdown();
  process.exit(code ?? 0);
});
