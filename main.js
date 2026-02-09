import { startBrowser } from "./src/utils/check-browser.js";

const port = Number(process.env.DEV_UI_PORT) || 5173;
startBrowser(`http://127.0.0.1:${port}`, "/tmp/threadline");