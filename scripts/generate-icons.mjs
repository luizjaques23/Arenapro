import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderIcon(size, maskable = false) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const cornerRadius = maskable ? 0 : size * 0.22;
  const ballRadius = size * (maskable ? 0.28 : 0.32);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Rounded rect mask
      let inside = true;
      if (!maskable) {
        const dx = Math.max(0, Math.abs(x - cx) - (size / 2 - cornerRadius));
        const dy = Math.max(0, Math.abs(y - cy) - (size / 2 - cornerRadius));
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
          inside = false;
        }
      }

      if (!inside) {
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }

      // Rich sports gradient background (deep turf/night slate to emerald)
      const t = (x + y) / (2 * size);
      let r = Math.round(15 + t * 8);
      let g = Math.round(23 + t * 50);
      let b = Math.round(42 + t * 25);

      // Court boundary lines
      const pad = size * 0.12;
      const lineW = Math.max(2, size * 0.018);
      const onBorder =
        x >= pad &&
        x <= size - pad &&
        y >= pad &&
        y <= size - pad &&
        (x < pad + lineW || x > size - pad - lineW || y < pad + lineW || y > size - pad - lineW);
      if (onBorder) {
        r = 52;
        g = 211;
        b = 153;
      }

      // Futevolei ball in center
      const bdx = x - cx;
      const bdy = y - cy;
      const dist = Math.sqrt(bdx * bdx + bdy * bdy);
      if (dist <= ballRadius) {
        // White base with emerald & amber panels
        const angle = Math.atan2(bdy, bdx);
        const normR = dist / ballRadius;
        if (normR > 0.92) {
          // Outer ring
          r = 255;
          g = 255;
          b = 255;
        } else if (normR < 0.34) {
          // Center amber gold pentagon feel
          r = 245;
          g = 158;
          b = 11;
        } else {
          // Alternating crisp white and emerald/slate panels
          const sector = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 6);
          const seam = Math.abs((((angle + Math.PI) / (2 * Math.PI)) * 6) % 1 - 0.5);
          if (seam > 0.44 || Math.abs(normR - 0.35) < 0.04) {
            r = 15;
            g = 23;
            b = 42;
          } else if (sector % 2 === 0) {
            r = 248;
            g = 250;
            b = 252;
          } else {
            r = 16;
            g = 185;
            b = 129;
          }
        }
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;
    }
  }
  return encodePng(size, size, buf);
}

const publicDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), renderIcon(192, false));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), renderIcon(512, false));
fs.writeFileSync(path.join(publicDir, 'maskable-512.png'), renderIcon(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), renderIcon(180, true));

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#0f172a"/>
  <rect x="14" y="14" width="100" height="100" rx="16" fill="none" stroke="#34d399" stroke-width="3" opacity="0.6"/>
  <circle cx="64" cy="64" r="36" fill="#f8fafc" stroke="#0f172a" stroke-width="4"/>
  <path d="M64 28 L76 48 L98 54 M64 28 L52 48 L30 54 M64 100 L76 80 L98 74 M64 100 L52 80 L30 74" fill="none" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="64" cy="64" r="13" fill="#f59e0b" stroke="#0f172a" stroke-width="3"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgIcon);
console.log('Generated PWA icons in public/');
