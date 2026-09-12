import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

// Minimal pure Node PNG encoder using built-in zlib
function createPng(width, height, rgbaBuffer) {
  // PNG signature: 137 80 78 71 13 10 26 10
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // color type 6 (RGBA)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines with filter type 0 (None)
  const rowBytes = width * 4;
  const filteredData = Buffer.alloc(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) {
    filteredData[y * (rowBytes + 1)] = 0; // filter byte
    rgbaBuffer.copy(filteredData, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  const compressed = zlib.deflateSync(filteredData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crc = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Rasterizer for the Argus Sentinel Mark
function renderArgusIcon(size, isApple = false) {
  const buf = Buffer.alloc(size * size * 4);

  // Colors
  const bg = isApple ? [12, 10, 9, 255] : [28, 25, 23, 255]; // Obsidian substrate
  const pillar = [250, 250, 249, 255]; // Warm white
  const accent = [234, 88, 12, 255]; // Ember #EA580C
  const cornerR = isApple ? size * 0.22 : size * 0.22;

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    // Alpha blending
    const srcA = a / 255;
    const dstA = buf[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;
    buf[idx] = Math.round((r * srcA + buf[idx] * dstA * (1 - srcA)) / outA);
    buf[idx + 1] = Math.round((g * srcA + buf[idx + 1] * dstA * (1 - srcA)) / outA);
    buf[idx + 2] = Math.round((b * srcA + buf[idx + 2] * dstA * (1 - srcA)) / outA);
    buf[idx + 3] = Math.round(outA * 255);
  }

  // Draw rounded rect background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Check rounded corners
      let dx = 0;
      let dy = 0;
      if (x < cornerR) dx = cornerR - x;
      else if (x > size - 1 - cornerR) dx = x - (size - 1 - cornerR);
      if (y < cornerR) dy = cornerR - y;
      else if (y > size - 1 - cornerR) dy = y - (size - 1 - cornerR);

      if (dx > 0 && dy > 0) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= cornerR - 0.5) {
          setPixel(x, y, bg[0], bg[1], bg[2], 255);
        } else if (dist <= cornerR + 0.5) {
          const alpha = Math.max(0, Math.min(1, (cornerR + 0.5 - dist))) * 255;
          setPixel(x, y, bg[0], bg[1], bg[2], alpha);
        }
      } else {
        setPixel(x, y, bg[0], bg[1], bg[2], 255);
      }
    }
  }

  // Rasterize geometric mark scaled to size
  const scale = size / 32;
  function transformX(val) { return val * scale; }
  function transformY(val) { return val * scale; }

  // Supersampling grid for crisp vector rasterization
  const SAMPLES = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let pillarHits = 0;
      let accentHits = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const px = (x + (sx + 0.5) / SAMPLES) / scale;
          const py = (y + (sy + 0.5) / SAMPLES) / scale;

          // Check Left Pillar: M16 4 L4.5 25 H10 L16 14 V4 Z
          // Outer edge: (16,4) to (4.5,25) -> slope: dx/dy = -11.5 / 21 = -0.5476 -> x >= 16 - (py - 4) * 0.5476
          // Inner edge: (16,14) to (10,25) -> slope: dx/dy = -6 / 11 = -0.545 -> x <= 16 - (py - 14) * 0.545
          const inLeftPillar = (py >= 4 && py <= 25 && px >= (16 - (py - 4) * 0.5476) && (py < 14 ? px <= 16 : px <= (16 - (py - 14) * 0.545)));

          // Check Right Pillar: M16 4 V14 L22 25 H27.5 L16 4 Z
          const inRightPillar = (py >= 4 && py <= 25 && px <= (16 + (py - 4) * 0.5476) && (py < 14 ? px >= 16 : px >= (16 + (py - 14) * 0.545)));

          // Check Focal Core (Triangle): M16 16 L19.5 22 H12.5 L16 16 Z
          const inFocalCore = (py >= 16 && py <= 22 && px >= (16 - (py - 16) * 0.583) && px <= (16 + (py - 16) * 0.583));

          // Check Ground bar: x: [13, 19], y: [24, 25.5]
          const inGroundBar = (px >= 13 && px <= 19 && py >= 24 && py <= 25.5);

          if (inFocalCore) {
            accentHits++;
          } else if (inLeftPillar || inRightPillar || inGroundBar) {
            pillarHits++;
          }
        }
      }

      const total = SAMPLES * SAMPLES;
      if (accentHits > 0) {
        const a = (accentHits / total) * 255;
        setPixel(x, y, accent[0], accent[1], accent[2], a);
      }
      if (pillarHits > 0) {
        const a = (pillarHits / total) * 255;
        setPixel(x, y, pillar[0], pillar[1], pillar[2], a);
      }
    }
  }

  return createPng(size, size, buf);
}

// Generate files
console.log('Generating Argus brand favicons and touch icons...');

const png16 = renderArgusIcon(16);
fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), png16);
console.log('✔ Generated favicon-16x16.png');

const png32 = renderArgusIcon(32);
fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png32);
console.log('✔ Generated favicon-32x32.png');

const png180 = renderArgusIcon(180, true);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png180);
console.log('✔ Generated apple-touch-icon.png (180x180)');

// Create Windows favicon.ico containing 16x16 and 32x32 PNG entries
function createIco(images) {
  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(images.length, 4); // count

  let offset = 6 + images.length * 16;
  const dirEntries = [];
  const imageBuffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(img.data.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset

    dirEntries.push(entry);
    imageBuffers.push(img.data);
    offset += img.data.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageBuffers]);
}

const icoData = createIco([
  { width: 16, height: 16, data: png16 },
  { width: 32, height: 32, data: png32 }
]);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoData);
console.log('✔ Generated favicon.ico (16x16 + 32x32)');

console.log('All favicon formats exported successfully!');
