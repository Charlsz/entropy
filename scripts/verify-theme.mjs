/**
 * Static proofs that dark/light theme wiring cannot regress to "always light".
 * Run: node scripts/verify-theme.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const failures = [];
const ok = (cond, msg) => {
  if (!cond) failures.push(msg);
};

// 1) No force-to-light on provider mount (the bug that wiped dark after boot).
{
  const ctx = read("src/renderer/state/WorkspaceContext.tsx");
  ok(
    !/dataset\.theme\s*=\s*["']light["']/.test(ctx),
    "WorkspaceContext must not force documentElement.dataset.theme = 'light'",
  );
}

// 2) Theme writers only apply the settings value.
{
  const shell = read("src/renderer/components/WorkspaceShell.tsx");
  ok(
    /document\.documentElement\.dataset\.theme\s*=\s*theme/.test(shell),
    "WorkspaceShell must sync html data-theme from settings.theme",
  );
  ok(
    !/dataset\.theme\s*=\s*["']light["']/.test(shell),
    "WorkspaceShell must not hardcode light",
  );

  const app = read("src/renderer/App.tsx");
  ok(
    /document\.documentElement\.dataset\.theme\s*=\s*settings\.theme/.test(app),
    "App boot must apply settings.theme to html",
  );
  ok(
    !/dataset\.theme\s*=\s*["']light["']/.test(app),
    "App must not hardcode light on documentElement",
  );
  ok(
    /initialSettings\?\.theme\s*\?\?\s*["']dark["']/.test(app),
    "Boot splash fallback theme must be dark",
  );
}

// 3) Defaults are dark.
{
  const workspace = read("src/renderer/state/workspace.ts");
  ok(
    /export const DEFAULT_SETTINGS[\s\S]*?theme:\s*["']dark["']/.test(workspace),
    "DEFAULT_SETTINGS.theme must be dark",
  );
  ok(
    !/createWorkspaceState[\s\S]*?theme:\s*["']light["']/.test(workspace),
    "createWorkspaceState must not override theme to light",
  );

  const session = read("src/renderer/state/sessionSettings.ts");
  ok(
    /theme:\s*raw\.theme\s*===\s*["']light["']\s*\?\s*["']light["']\s*:\s*["']dark["']/.test(
      session,
    ),
    "fromSessionSettings must default unknown themes to dark",
  );
}

// 4) CSS: bare html is dark; light only when data-theme=light.
{
  const css = read("src/renderer/styles/global.css");
  const darkBlock = css.match(
    /html,\s*\n\s*html\[data-theme="dark"\]\s*\{([\s\S]*?)\n\s*\}/,
  );
  const lightBlock = css.match(/html\[data-theme="light"\]\s*\{([\s\S]*?)\n\s*\}/);
  ok(Boolean(darkBlock), 'CSS must define tokens on html, html[data-theme="dark"]');
  ok(Boolean(lightBlock), 'CSS must define tokens on html[data-theme="light"]');
  ok(
    darkBlock?.[1]?.includes("--background: #131413"),
    "Default/dark CSS background must be #131413",
  );
  ok(
    lightBlock?.[1]?.includes("--background: #ffffff") ||
      lightBlock?.[1]?.includes("--background: #fff"),
    "Light CSS background must be white",
  );
  ok(
    !/html,\s*\n\s*html\[data-theme="light"\]/.test(css),
    "Bare html must not share the light token block",
  );
}

// 5) index.html paints dark before JS.
{
  const html = read("src/renderer/index.html");
  ok(
    /<html[^>]*data-theme="dark"/.test(html),
    'index.html must set data-theme="dark" on <html>',
  );
}

// 6) No other renderer forces of theme=light on documentElement/body.
{
  const rendererRoot = path.join(root, "src/renderer");
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?|html)$/.test(name)) {
        const text = fs.readFileSync(full, "utf8");
        const re = /dataset\.theme\s*=\s*["']light["']/g;
        let m;
        while ((m = re.exec(text))) {
          failures.push(`${path.relative(root, full)} forces dataset.theme = "light"`);
        }
      }
    }
  };
  walk(rendererRoot);
}

// 7) Simulate session → applied theme round-trip (mirrors fromSessionSettings).
{
  const apply = (raw) => (raw === "light" ? "light" : "dark");
  ok(apply(undefined) === "dark", "missing session theme → dark");
  ok(apply("dark") === "dark", "saved dark → dark");
  ok(apply("light") === "light", "saved light → light");
  ok(apply("nonsense") === "dark", "invalid session theme → dark");
}

if (failures.length) {
  console.error("THEME VERIFY FAILED:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("THEME VERIFY OK — dark default, light opt-in, no force-to-light writers.");
