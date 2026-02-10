/**
 * CommonJS entry for pkg. Loads the bundled CJS server (no dynamic import).
 * Build: npm run build:server then pkg entry.cjs
 */
// Node 18 lacks global File; undici (used by fetch) expects it. Polyfill for pkg snapshot.
if (typeof globalThis.File === "undefined") {
  const { Blob } = require("buffer");
  globalThis.File = class File extends Blob {
    constructor(bits, name, options) {
      super(bits, options);
      this.name = name || "";
    }
  };
}
try {
  // pkg extracts assets next to the executable; __dirname is the snapshot path, so use exec path
  const path = require("path");
  process.env.THREADLINE_BUNDLE_DIR =
    process.pkg ? path.dirname(process.execPath) : __dirname;
  require("./server.bundle.cjs");
} catch (err) {
  console.error(err);
  process.exit(1);
}
