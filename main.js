import { startBrowser } from "./src/utils/check-browser.js";
import db from "./src/db.js";

const port = Number(process.env.DEV_UI_PORT) || 5173;
startBrowser(`http://127.0.0.1:${port}`, "/tmp/threadline");