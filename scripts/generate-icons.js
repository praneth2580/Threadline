/**
 * Generates minimal Tauri icons so the Windows build succeeds.
 * Run: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const iconsDir = path.join(root, 'src-tauri', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

// Minimal 32x32 32bpp ICO (single blue-ish pixel color, rest transparent)
function createIco() {
  const w = 32;
  const h = 32;
  const headerSize = 40;
  const xorSize = w * h * 4;
  const andRowBytes = ((w + 31) >> 5) << 2;
  const andSize = andRowBytes * h;
  const imageSize = headerSize + xorSize + andSize;
  const fileOffset = 6 + 16;

  const buf = Buffer.alloc(6 + 16 + imageSize);
  let o = 0;

  // ICONDIR
  buf.writeUInt16LE(0, o); o += 2;
  buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt16LE(1, o); o += 2;

  // ICONDIRENTRY
  buf.writeUInt8(w, o); o += 1;
  buf.writeUInt8(h, o); o += 1;
  buf.writeUInt8(0, o); o += 1;
  buf.writeUInt8(0, o); o += 1;
  buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt16LE(32, o); o += 2;
  buf.writeUInt32LE(imageSize, o); o += 4;
  buf.writeUInt32LE(fileOffset, o); o += 4;

  // BITMAPINFOHEADER
  buf.writeUInt32LE(40, o); o += 4;
  buf.writeInt32LE(w, o); o += 4;
  buf.writeInt32LE(h * 2, o); o += 4;  // height * 2 for XOR+AND
  buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt16LE(32, o); o += 2;
  buf.writeUInt32LE(0, o); o += 4;
  buf.writeUInt32LE(0, o); o += 4;
  buf.writeInt32LE(0, o); o += 4;
  buf.writeInt32LE(0, o); o += 4;
  buf.writeUInt32LE(0, o); o += 4;
  buf.writeUInt32LE(0, o); o += 4;

  // XOR mask (32bpp BGRA, bottom-up) - simple gradient-ish color
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const t = (x + y) / (w + h);
      const r = Math.floor(65 + t * 100);
      const g = Math.floor(136 + t * 80);
      const b = Math.floor(255);
      buf.writeUInt8(Math.min(255, b), o); o += 1;
      buf.writeUInt8(Math.min(255, g), o); o += 1;
      buf.writeUInt8(Math.min(255, r), o); o += 1;
      buf.writeUInt8(255, o); o += 1;
    }
  }

  // AND mask (1bpp, 0 = opaque)
  for (let i = 0; i < andSize; i++) buf[o++] = 0;

  return buf;
}

// Minimal 32x32 PNG (valid signature + IHDR + IDAT + IEND)
function createPng32() {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = createPngChunk('IHDR', Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x20, 0x08, 0x02, 0x00, 0x00, 0x00
  ])); // 32x32, 8bit, RGB
  const raw = Buffer.alloc(32 * 33 * 3 + 32); // filter byte per row
  let o = 0;
  for (let y = 0; y < 32; y++) {
    raw[o++] = 0;
    for (let x = 0; x < 32; x++) {
      raw[o++] = 65; raw[o++] = 136; raw[o++] = 255;
    }
  }
  const zlib = require('zlib');
  const idat = createPngChunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = createPngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createPngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const chunk = Buffer.concat([Buffer.from(type), data]);
  const crc = crc32(chunk);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, chunk, crcBuf]);
}

function crc32(buf) {
  let c = -1;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let t = n;
    for (let k = 0; k < 8; k++) t = (t & 1) ? (0xedb88320 ^ (t >>> 1)) : (t >>> 1);
    table[n] = t >>> 0;
  }
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ (-1)) >>> 0;
}

// 128x128 PNG - same as 32x32 but different dimensions in IHDR
function createPng128() {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = createPngChunk('IHDR', Buffer.from([
    0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80, 0x08, 0x02, 0x00, 0x00, 0x00
  ])); // 128x128, 8bit RGB
  const raw = Buffer.alloc(128 * 129 * 3 + 128);
  let o = 0;
  for (let y = 0; y < 128; y++) {
    raw[o++] = 0;
    for (let x = 0; x < 128; x++) {
      raw[o++] = 65; raw[o++] = 136; raw[o++] = 255;
    }
  }
  const zlib = require('zlib');
  const idat = createPngChunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = createPngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

fs.writeFileSync(path.join(iconsDir, 'icon.ico'), createIco());
fs.writeFileSync(path.join(iconsDir, '32x32.png'), createPng32());
fs.writeFileSync(path.join(iconsDir, '128x128.png'), createPng128());

// icon.icns required by tauri.conf on macOS; Windows build only needs icon.ico
// Create minimal icns so config doesn't break (macOS build will replace with proper icon)
const icnsHeader = Buffer.alloc(8);
icnsHeader.write('icns', 0);
icnsHeader.writeUInt32BE(8, 4);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), icnsHeader);

console.log('Generated src-tauri/icons/ (icon.ico, 32x32.png, 128x128.png, icon.icns)');
