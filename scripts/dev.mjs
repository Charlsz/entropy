import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const electronOutDir = path.join(rootDir, 'dist-electron');
const rendererDevUrl = 'http://127.0.0.1:5173';

let electronProcess = null;
let restartTimer = null;

function start(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      ...extraEnv
    }
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.exitCode = 0;
      return;
    }

    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  return child;
}

async function waitForFile(filePath) {
  for (;;) {
    if (fs.existsSync(filePath)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

function stopElectron() {
  if (!electronProcess || electronProcess.killed) {
    return;
  }

  electronProcess.kill();
  electronProcess = null;
}

function startElectron() {
  stopElectron();

  electronProcess = start('electron', ['.'], {
    VITE_DEV_SERVER_URL: rendererDevUrl
  });
}

function scheduleRestart() {
  if (!electronProcess) {
    return;
  }

  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(() => {
    restartTimer = null;
    startElectron();
  }, 300);
}

start('vite', ['--host', '127.0.0.1', '--port', '5173', '--strictPort']);
start('tsc', ['-p', 'tsconfig.electron.json', '--watch', '--preserveWatchOutput']);

await waitForFile(path.join(electronOutDir, 'main.js'));
startElectron();

fs.watch(electronOutDir, { recursive: true }, scheduleRestart);

process.on('SIGINT', () => {
  stopElectron();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopElectron();
  process.exit(0);
});