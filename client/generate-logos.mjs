#!/usr/bin/env node
/**
 * Archangels Club — Logo PNG Generator
 * Generates icon.png (64×64) and favicon.png (32×32) from the icon geometry.
 *
 * wordmark.png and full-logo.png require font rendering — export those manually
 * from /public/assets/logo/wordmark.svg and /public/assets/logo/full-logo.svg
 * using Figma, Inkscape, or any SVG → PNG tool.
 *
 * Run: node generate-logos.mjs
 */

import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'public', 'assets', 'logo');

// ── PNG encoder ───────────────────────────────────────────────────────────────

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const combined = Buffer.concat([t, d]);
  const lenBuf = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(d.length, 0);
  const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([lenBuf, t, d, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Scanlines: 1 filter byte + 4 bytes per pixel
  const raw = Buffer.allocUnsafe(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 4) + 1 + x * 4;
      raw[dst] = rgba[src]; raw[dst+1] = rgba[src+1];
      raw[dst+2] = rgba[src+2]; raw[dst+3] = rgba[src+3];
    }
  }

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ── Icon geometry ─────────────────────────────────────────────────────────────
// Source viewBox 0 0 48 48
// circle cx=24 cy=24 r=23 fill=#0A0A0F stroke=#D4AF37 stroke-width=1.5
// path M24 10 L30 22 L38 24 L30 30 L32 38 L24 34 L16 38 L18 30 L10 24 L18 22 Z fill=#D4AF37

const STAR = [
  [24, 10], [30, 22], [38, 24], [30, 30], [32, 38],
  [24, 34], [16, 38], [18, 30], [10, 24], [18, 22],
];

function pointInPoly(px, py, poly) {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function renderIcon(size) {
  const samples = 4; // 4×4 supersampling
  const rgba = new Uint8Array(size * size * 4);
  const scale = size / 48;
  const cx = 24 * scale, cy = 24 * scale;
  const r = 23 * scale, strokeW = 1.5 * scale;
  const scaledStar = STAR.map(([x, y]) => [x * scale, y * scale]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rA = 0, gA = 0, bA = 0, aA = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          const dx = px - cx, dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let sr = 0x0A, sg = 0x0A, sb = 0x0F, sa = 0;
          if (dist <= r) {
            sa = 255;
            if (dist > r - strokeW) {
              sr = 0xD4; sg = 0xAF; sb = 0x37; // gold ring
            } else if (pointInPoly(px, py, scaledStar)) {
              // gold star blended at 0.9 opacity over dark bg
              sr = Math.round(0xD4 * 0.9 + 0x0A * 0.1);
              sg = Math.round(0xAF * 0.9 + 0x0A * 0.1);
              sb = Math.round(0x37 * 0.9 + 0x0F * 0.1);
            }
          }
          rA += sr; gA += sg; bA += sb; aA += sa;
        }
      }
      const n = samples * samples;
      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(rA / n);
      rgba[idx+1] = Math.round(gA / n);
      rgba[idx+2] = Math.round(bA / n);
      rgba[idx+3] = Math.round(aA / n);
    }
  }
  return rgba;
}

// ── Generate files ────────────────────────────────────────────────────────────

fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(path.join(OUT, 'icon.png'), encodePng(64, 64, renderIcon(64)));
console.log('✓ icon.png (64×64)');

fs.writeFileSync(path.join(OUT, 'favicon.png'), encodePng(32, 32, renderIcon(32)));
console.log('✓ favicon.png (32×32)');

console.log('');
console.log('  wordmark.png and full-logo.png require font rendering.');
console.log('  Export them manually from:');
console.log('    public/assets/logo/wordmark.svg  → wordmark.png  (280×40)');
console.log('    public/assets/logo/full-logo.svg → full-logo.png (200×120)');
