/**
 * Renders the README screenshots and the community directory thumbnail from
 * the real Obsidian app, running headless on the sample vault in
 * scripts/render/vault.
 *
 *   OBSIDIAN=/path/to/obsidian pnpm render
 *
 * OBSIDIAN is the `obsidian` binary from Obsidian's Linux tarball
 * (obsidian-<version>.tar.gz on github.com/obsidianmd/obsidian-releases).
 * Set LD_LIBRARY_PATH too if the system lacks GTK or its dependencies.
 * Obsidian runs with its own config directory, so no real vault is touched.
 */
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cdp } from "./lib/cdp.ts";
import { ROOT } from "./lib/colors.ts";

const binary = process.env.OBSIDIAN;
if (!binary) throw new Error("set OBSIDIAN to the obsidian binary (see the header of this file)");

const work = mkdtempSync(join(tmpdir(), "mistpine-obsidian-"));
const vault = join(work, "vault");
const config = join(work, "config");

// The sample vault, with the theme installed and the app in dark mode.
cpSync(join(ROOT, "scripts", "render", "vault"), vault, { recursive: true });
const themeDir = join(vault, ".obsidian", "themes", "mistpine");
mkdirSync(themeDir, { recursive: true });
for (const file of ["theme.css", "manifest.json"]) cpSync(join(ROOT, file), join(themeDir, file));
const json = (path: string, data: unknown) => writeFileSync(path, `${JSON.stringify(data)}\n`);
json(join(vault, ".obsidian", "appearance.json"), { cssTheme: "mistpine", theme: "obsidian" });
// Sync's "not signed in" icon would sit in every status bar.
json(join(vault, ".obsidian", "core-plugins.json"), {
  "file-explorer": true,
  "global-search": true,
  switcher: true,
  graph: true,
  backlink: true,
  "outgoing-link": true,
  "tag-pane": true,
  properties: true,
  "page-preview": true,
  "command-palette": true,
  outline: true,
  "word-count": true,
  bases: true,
  sync: false,
});
mkdirSync(join(config, "obsidian"), { recursive: true });
json(join(config, "obsidian", "obsidian.json"), {
  vaults: { "0000000000000001": { path: vault, ts: 1, open: true } },
  updateDisabled: true,
});

const app = spawn(
  binary,
  ["--no-sandbox", "--ozone-platform=headless", "--remote-debugging-port=0"],
  { env: { ...process.env, XDG_CONFIG_HOME: config }, stdio: ["ignore", "ignore", "pipe"] },
);

/** Waits for Chromium to print its DevTools port. */
const port = await new Promise<number>((resolve, reject) => {
  let log = "";
  const timer = setTimeout(() => reject(new Error(`Obsidian did not start:\n${log}`)), 60_000);
  app.stderr.on("data", (chunk: Buffer) => {
    log += chunk;
    const m = log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
    if (m) {
      clearTimeout(timer);
      resolve(Number(m[1]));
    }
  });
  app.on("exit", (code) => reject(new Error(`Obsidian exited (${code}):\n${log}`)));
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mainWindow(): Promise<string> {
  for (let i = 0; i < 120; i++) {
    const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as {
      type: string;
      url: string;
      webSocketDebuggerUrl: string;
    }[];
    const page = targets.find((t) => t.type === "page" && t.url === "app://obsidian.md/index.html");
    if (page) return page.webSocketDebuggerUrl;
    await sleep(500);
  }
  throw new Error("Obsidian's main window never appeared");
}

const cdp = await Cdp.connect(await mainWindow());

try {
  await cdp.send("Page.bringToFront");
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  for (let i = 0; !(await cdp.eval("typeof app === 'object' && app.workspace.layoutReady")); i++) {
    if (i > 120) throw new Error("the workspace never became ready");
    await sleep(500);
  }

  // Helpers inside the page: open a note in a mode, reveal it, scroll.
  await cdp.eval(`window.mistpine = {
    async open(path, mode = "source", scroll = 0) {
      document.querySelectorAll(".modal-container").forEach((m) => m.remove());
      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(app.vault.getAbstractFileByPath(path));
      if (leaf.view.getViewType() === "markdown") {
        const state = leaf.getViewState();
        state.state.mode = mode;
        state.state.source = false;
        await leaf.setViewState(state);
      }
      app.workspace.setActiveLeaf(leaf, { focus: true });
      const explorer = app.workspace.getLeavesOfType("file-explorer")[0]?.view;
      for (const folder of ["Trails", "Station"]) explorer?.fileItems[folder]?.setCollapsed(false);
      explorer?.revealInFolder?.(leaf.view.file);
      await new Promise((r) => setTimeout(r, 1200));
      // Revealing a file focuses its row; the ring would show in every shot.
      document.querySelectorAll(".has-focus").forEach((el) => el.classList.remove("has-focus"));
      const scroller = leaf.view.containerEl.querySelector(
        mode === "preview" ? ".markdown-preview-view" : ".cm-scroller",
      );
      if (scroller) scroller.scrollTop = scroll;
      document.activeElement?.blur?.();
      await new Promise((r) => setTimeout(r, 800));
    },
  }; true`);

  const shots: {
    file: string;
    width?: number;
    height?: number;
    scale?: number;
    setup: string;
  }[] = [
    { file: "assets/preview.png", setup: `mistpine.open("Trails/Ridge walk.md", "source", 400)` },
    {
      file: "assets/screenshots/properties.png",
      setup: `mistpine.open("Trails/Ridge walk.md")`,
    },
    {
      file: "assets/screenshots/table.png",
      setup: `mistpine.open("Trails/Ridge walk.md", "preview", 900)`,
    },
    {
      file: "assets/screenshots/code.png",
      setup: `mistpine.open("Station/Weather station.md", "preview", 335)`,
    },
    { file: "assets/screenshots/bases.png", setup: `mistpine.open("Trails/Trails.base")` },
    {
      file: "assets/screenshots/graph.png",
      setup: `(async () => {
        await mistpine.open("Station/Fog forecast.md");
        app.commands.executeCommandById("graph:open");
        await new Promise((r) => setTimeout(r, 5000));
      })()`,
    },
    {
      file: "assets/screenshots/command-palette.png",
      setup: `(async () => {
        await mistpine.open("Station/Weather station.md", "preview");
        app.commands.executeCommandById("command-palette:open");
        await new Promise((r) => setTimeout(r, 400));
        const input = document.querySelector(".prompt-input");
        input.value = "open";
        input.dispatchEvent(new Event("input"));
        await new Promise((r) => setTimeout(r, 600));
      })()`,
    },
    // The community directory's card: 512 × 288.
    {
      file: "screenshot.png",
      width: 1024,
      height: 576,
      scale: 0.5,
      setup: `mistpine.open("Trails/Ridge walk.md", "source", 400)`,
    },
  ];

  for (const shot of shots) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: shot.width ?? 1200,
      height: shot.height ?? 800,
      deviceScaleFactor: shot.scale ?? 2,
      mobile: false,
    });
    await cdp.eval("window.dispatchEvent(new Event('resize')), true");
    await cdp.eval(shot.setup);
    await sleep(500);
    writeFileSync(join(ROOT, shot.file), await cdp.screenshot());
    console.log(`wrote ${shot.file}`);
  }
} finally {
  cdp.close();
  app.kill();
  rmSync(work, { recursive: true, force: true });
}
