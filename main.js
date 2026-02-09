import { startBrowser } from "./src/utils/check-browser.js";

const port = Number(process.env.DEV_UI_PORT) || 5173;
const browser = startBrowser(`http://127.0.0.1:${port}`, process.env.USER_DATA_DIR || "/tmp/threadline");

if (browser) {
  browser.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
  process.on("SIGINT", () => {
    browser.kill("SIGTERM");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    browser.kill("SIGTERM");
    process.exit(0);
  });
}