import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const lockDir = path.join(root, ".entropy");
const lockPath = path.join(lockDir, "start.lock");
const skipBuild = process.argv.includes("--no-build");

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockPid() {
  try {
    const raw = fs.readFileSync(lockPath, "utf8").trim();
    return Number.parseInt(raw, 10);
  } catch {
    return NaN;
  }
}

function acquireStartLock() {
  fs.mkdirSync(lockDir, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, `${process.pid}\n`);
      fs.closeSync(fd);
      return;
    } catch (error) {
      if (error && error.code !== "EEXIST") throw error;
      const existing = readLockPid();
      if (isPidAlive(existing)) {
        console.error(
          `Entropy start is already in progress (pid ${existing}). Wait for it, or close the other terminal.`,
        );
        process.exit(1);
      }
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // Race with another starter; retry once.
      }
    }
  }

  console.error("Could not acquire Entropy start lock. Try again in a moment.");
  process.exit(1);
}

function releaseStartLock() {
  try {
    const existing = readLockPid();
    if (existing === process.pid || Number.isNaN(existing)) {
      fs.unlinkSync(lockPath);
    }
  } catch {
    // Ignore.
  }
}

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: isWindows,
      env,
    });
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} killed by ${signal}`));
      else if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

/** Stop leftover Entropy Electron windows from prior aborted starts (this repo only). */
async function stopStaleEntropyElectron() {
  if (!isWindows) return;

  const marker = root.replace(/'/g, "''");
  const ps = [
    `$root = '${marker}';`,
    "$procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |",
    "  Where-Object {",
    "    $_.Name -match '^(electron|Entropy)\\.exe$' -and",
    "    $_.CommandLine -and ($_.CommandLine.IndexOf($root) -ge 0)",
    "  };",
    "foreach ($p in $procs) {",
    "  try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch {}",
    "}",
  ].join(" ");

  await new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", ps], {
      cwd: root,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("exit", () => resolve());
    child.on("error", () => resolve());
  });
}

async function main() {
  acquireStartLock();
  const release = () => releaseStartLock();
  process.on("exit", release);
  process.on("SIGINT", () => {
    release();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    release();
    process.exit(143);
  });

  try {
    await stopStaleEntropyElectron();

    if (!skipBuild) {
      console.log("Building Entropy…");
      await run("npm", ["run", "build"]);
    }

    console.log("Launching desktop window…");
    await run("npx", ["electron", "."], {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      BROWSER: "none",
    });
  } finally {
    release();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  releaseStartLock();
  process.exit(1);
});
