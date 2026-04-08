import { execSync, spawn } from "child_process";
import fs from "fs";
import os from "os";
import browserConfig from "../../browser-start-cmd.json" with { type: "json" };

// Keys must match browser-start-cmd.json. Order = preference per family.
const browsersByFamily = {
  chrome: [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ],
  edge: ["microsoft-edge", "microsoft-edge-stable"],
  brave: ["brave-browser", "brave-browser-stable"],
  firefox: ["firefox"],
};

const configKeys = new Set(Object.keys(browserConfig));
const browsersOrdered = Object.values(browsersByFamily).flat();

function exists(cmd) {
  try {
    const isWin = os.platform() === 'win32';
    execSync(`${isWin ? 'where' : 'command -v'} ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function checkAvaliableBrowser(browserFamily = null) {
  const list = browserFamily ? (browsersByFamily[browserFamily] || []) : browsersOrdered;
  for (const browser of list) {
    if (exists(browser)) return browser;
  }
  
  // If not found in PATH, check common hardcoded Windows paths
  if (os.platform() === 'win32') {
    const winPaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

/**
 * Start the browser and return the child process so caller can tie lifecycles:
 * - When the browser window is closed, the child exits → caller can process.exit().
 * - When the Node process exits, the (non-detached) child is killed by the OS.
 * Caller should: child.on('exit', () => process.exit()); and process.on('SIGINT', () => { child.kill(); process.exit(); });
 */
export function startBrowser(url, user_path) {
  const key = checkAvaliableBrowser();
  if (!key) {
    console.error("No supported browser found");
    process.exit(1);
  }
  
  // Map Windows executable/absolute names back to the config keys safely
  let configKey = key;
  if (key.includes("chrome") || key === "chrome") configKey = "google-chrome";
  else if (key.includes("edge") || key === "msedge") configKey = "microsoft-edge";
  else if (key.includes("brave") || key === "brave") configKey = "brave-browser";

  if (!browserConfig[configKey]) {
      configKey = Object.keys(browserConfig)[0];
  }

  const { args } = browserConfig[configKey];
  const temp_args = args.map(arg =>
    arg.replace("${url}", url).replace("${user_path}", user_path)
  );
  const child = spawn(key, temp_args, { stdio: "ignore" });
  return child;
}