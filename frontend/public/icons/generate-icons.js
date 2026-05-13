/**
 * Genera iconos PWA para NutriDiabetes sin dependencias externas.
 * Ejecutar: node generate-icons.js
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// CRC32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeB = Buffer.from(type, 'ascii');
  const lenB  = Buffer.allocUnsafe(4); lenB.writeUInt32BE(data.length, 0);
  const crcB  = Buffer.allocUnsafe(4); crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([lenB, typeB, data, crcB]);
}

function createPNG(size) {
  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); ihdr.writeUInt8(6, 9); // RGBA
  ihdr.fill(0, 10);

  // Dibujar píxeles RGBA para cada pixel
  const rowSize = size * 4 + 1;
  const raw = Buffer.allocUnsafe(rowSize * size);

  const cx = size / 2, cy = size / 2, r = size * 0.45;

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const off = y * rowSize + 1 + x * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const pad  = size * 0.12; // margen interior redondeado
      const cornerR = size * 0.22;

      // Detectar si está dentro del rectángulo redondeado
      const rx = Math.abs(dx) - (r - cornerR);
      const ry = Math.abs(dy) - (r - cornerR);
      const inRect = rx <= 0 || ry <= 0 || Math.sqrt(Math.max(rx,0)**2 + Math.max(ry,0)**2) <= cornerR;

      if (!inRect) { raw[off]=0; raw[off+1]=0; raw[off+2]=0; raw[off+3]=0; continue; }

      // Gradiente azul-verde de arriba-izquierda a abajo-derecha
      const t = (x + y) / (size * 2);
      const rr = Math.round(0   + t * 0);
      const gg = Math.round(87  + t * (110 - 87));
      const bb = Math.round(184 + t * (65  - 184));

      raw[off]=rr; raw[off+1]=gg; raw[off+2]=bb; raw[off+3]=255;
    }
  }

  // Dibujar el logo (línea ECG simplificada) encima
  drawECG(raw, rowSize, size);

  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function setPixel(raw, rowSize, x, y, size, rr, gg, bb, aa=255) {
  if (x<0||y<0||x>=size||y>=size) return;
  const off = y * rowSize + 1 + x * 4;
  raw[off]=rr; raw[off+1]=gg; raw[off+2]=bb; raw[off+3]=aa;
}

function drawLine(raw, rowSize, size, x0, y0, x1, y1, rr, gg, bb, thick=2) {
  const steps = Math.max(Math.abs(x1-x0), Math.abs(y1-y0)) * 2;
  for (let i=0; i<=steps; i++) {
    const t = i/steps;
    const px = Math.round(x0 + t*(x1-x0));
    const py = Math.round(y0 + t*(y1-y0));
    for (let dx=-thick; dx<=thick; dx++)
      for (let dy=-thick; dy<=thick; dy++)
        setPixel(raw, rowSize, px+dx, py+dy, size, rr, gg, bb);
  }
}

function drawECG(raw, rowSize, size) {
  const s = size / 100;
  const pts = [
    [22,55],[38,55],[45,38],[55,72],[62,55],[78,55]
  ].map(([x,y]) => [Math.round(x*s), Math.round(y*s)]);

  for (let i=0; i<pts.length-1; i++)
    drawLine(raw, rowSize, size, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1], 255,255,255, Math.max(1, Math.round(s*3)));
}

const sizes = [72, 128, 192, 512];
const dir = __dirname;

sizes.forEach(size => {
  const file = path.join(dir, `icon-${size}x${size}.png`);
  fs.writeFileSync(file, createPNG(size));
  console.log(`✅ Generado: icon-${size}x${size}.png`);
});

console.log('\n🎉 Todos los iconos PWA generados correctamente.');
