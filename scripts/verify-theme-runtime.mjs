/**
 * Runtime Electron proof: computed --background / --foreground under dark + light.
 * Run: npx electron scripts/verify-theme-runtime.mjs
 * Requires: npm run build:renderer
 */
import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssDir = path.join(root, "dist/renderer/assets");

function findCssFile() {
  if (!fs.existsSync(cssDir)) {
    throw new Error("dist/renderer/assets missing — run npm run build:renderer first");
  }
  const css = fs.readdirSync(cssDir).find((name) => name.endsWith(".css"));
  if (!css) throw new Error("No built CSS found in dist/renderer/assets");
  return path.join(cssDir, css);
}

function assertTheme(label, values, expected) {
  const fails = [];
  for (const [key, want] of Object.entries(expected)) {
    const got = values[key];
    if (got !== want) fails.push(`${label}.${key}: expected ${want}, got ${got}`);
  }
  return fails;
}

app.whenReady().then(async () => {
  const failures = [];
  try {
    const cssText = fs.readFileSync(findCssFile(), "utf8");
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const dataUrl =
      "data:text/html;charset=utf-8," +
      encodeURIComponent(`<!doctype html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8" /><style>${cssText}</style></head>
<body></body>
</html>`);

    await win.loadURL(dataUrl);

    const readTheme = `
      (() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          theme: document.documentElement.dataset.theme,
          background: cs.getPropertyValue('--background').trim(),
          foreground: cs.getPropertyValue('--foreground').trim(),
          card: cs.getPropertyValue('--card').trim(),
          colorSurface: cs.getPropertyValue('--color-surface').trim(),
          colorCanvas: cs.getPropertyValue('--color-canvas').trim(),
        };
      })()
    `;

    const setAndRead = async (theme) => {
      await win.webContents.executeJavaScript(
        `document.documentElement.dataset.theme = ${JSON.stringify(theme)};`,
      );
      return win.webContents.executeJavaScript(readTheme);
    };

    const dark = await setAndRead("dark");
    failures.push(
      ...assertTheme("dark", dark, {
        theme: "dark",
        background: "#131413",
        foreground: "#fafaf9",
        card: "#1c1d1c",
        colorSurface: "#131413",
        colorCanvas: "#1c1d1c",
      }),
    );

    const light = await setAndRead("light");
    failures.push(
      ...assertTheme("light", light, {
        theme: "light",
        background: "#ffffff",
        foreground: "#131413",
        card: "#ffffff",
        colorSurface: "#fafaf9",
        colorCanvas: "#ffffff",
      }),
    );

    const againDark = await setAndRead("dark");
    if (againDark.background !== "#131413") {
      failures.push(`toggle back to dark failed: ${JSON.stringify(againDark)}`);
    }

    // Bare html (no data-theme) must still be light — product default.
    const bare = await win.webContents.executeJavaScript(`
      (() => {
        document.documentElement.removeAttribute('data-theme');
        const cs = getComputedStyle(document.documentElement);
        return cs.getPropertyValue('--background').trim();
      })()
    `);
    if (bare !== "#ffffff") {
      failures.push(`bare html default background expected #ffffff, got ${bare}`);
    }

    win.destroy();

    if (failures.length) {
      console.error("THEME RUNTIME FAILED:");
      for (const f of failures) console.error(" -", f);
      app.exit(1);
      return;
    }

    console.log("THEME RUNTIME OK");
    console.log(" dark ", dark);
    console.log(" light", light);
    console.log(" bare ", bare);
    app.exit(0);
  } catch (err) {
    console.error("THEME RUNTIME ERROR:", err);
    app.exit(1);
  }
});
