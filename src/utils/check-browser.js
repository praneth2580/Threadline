import { execSync, spawn } from "child_process";
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
const browsersOrdered = Object.values(browsersByFamily).flat().filter((b) => configKeys.has(b));

function exists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function checkAvaliableBrowser(browserFamily = null) {
  const list = browserFamily
    ? (browsersByFamily[browserFamily] || []).filter((b) => configKeys.has(b))
    : browsersOrdered;
  for (const browser of list) {
    if (exists(browser)) return browser;
  }
  return undefined;
}

export function startBrowser(url, user_path) {
  const key = checkAvaliableBrowser();
  if (!key || !browserConfig[key]) {
    console.error("No supported browser found");
    process.exit(1);
  }
  const { binary, args } = browserConfig[key];
  const temp_args = args.map(arg => 
    arg.replace("${url}", url).replace("${user_path}", user_path)
  );
  spawn(binary, temp_args, { detached: true, stdio: "ignore" }).unref();
}