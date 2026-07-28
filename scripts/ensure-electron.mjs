import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronDir = path.join(root, "node_modules", "electron");
const pathTxt = path.join(electronDir, "path.txt");
const installJs = path.join(electronDir, "install.js");

if (!fs.existsSync(installJs)) {
  console.warn("Electron package not present; skip binary check.");
  process.exit(0);
}

function isReady() {
  try {
    const relative = fs.readFileSync(pathTxt, "utf8").trim();
    return fs.existsSync(path.join(electronDir, "dist", relative));
  } catch {
    return false;
  }
}

if (isReady()) {
  process.exit(0);
}

console.log("Electron binary missing — downloading…");
const result = spawnSync(process.execPath, [installJs], {
  cwd: electronDir,
  stdio: "inherit",
  env: { ...process.env, force_no_cache: "true" },
});

if (result.status !== 0 || !isReady()) {
  // Fallback for environments where extract-zip fails silently.
  console.log("Trying PowerShell fallback extraction…");
  const fallback = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      [
        "$ErrorActionPreference = 'Stop'",
        "$cache = Join-Path $env:LOCALAPPDATA 'electron\\Cache'",
        "$zip = Get-ChildItem -Path $cache -Recurse -Filter 'electron-*-win32-*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -First 1",
        "if (-not $zip) { throw 'No Electron zip found in cache' }",
        "$dist = Join-Path (Get-Location) 'dist'",
        "New-Item -ItemType Directory -Force -Path $dist | Out-Null",
        "Expand-Archive -Path $zip.FullName -DestinationPath $dist -Force",
        "Set-Content -Path (Join-Path (Get-Location) 'path.txt') -Value 'electron.exe' -NoNewline",
      ].join("; "),
    ],
    { cwd: electronDir, stdio: "inherit" },
  );

  if (fallback.status !== 0 || !isReady()) {
    console.error(
      "Failed to install Electron binary. Delete node_modules/electron and run: npm install",
    );
    process.exit(1);
  }
}

console.log("Electron binary ready.");
