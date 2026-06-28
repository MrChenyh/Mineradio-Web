const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const EXTENSION_DIR = path.join(ROOT, 'extension');
const OUT_DIR = path.join(ROOT, 'web', 'public', 'downloads');
const OUT_FILE = path.join(OUT_DIR, 'mineradio-connector.zip');

function walk(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full, base));
    } else if (entry.isFile()) {
      files.push({
        abs: full,
        rel: path.relative(base, full).replace(/\\/g, '/'),
      });
    }
  }
  return files.sort((a, b) => a.rel.localeCompare(b.rel));
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function u16(value) {
  const b = Buffer.allocUnsafe(2);
  b.writeUInt16LE(value & 0xffff, 0);
  return b;
}

function u32(value) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32LE(value >>> 0, 0);
  return b;
}

function zipFiles(files) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const input = fs.readFileSync(file.abs);
    const compressed = zlib.deflateRawSync(input, { level: 9 });
    const name = Buffer.from(file.rel, 'utf8');
    const stat = fs.statSync(file.abs);
    const stamp = dosTime(stat.mtime);
    const crc = crc32(input);

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(8),
      u16(stamp.time),
      u16(stamp.day),
      u32(crc),
      u32(compressed.length),
      u32(input.length),
      u16(name.length),
      u16(0),
      name,
      compressed,
    ]);

    const headerOffset = offset;
    offset += local.length;
    locals.push(local);

    central.push(Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(8),
      u16(stamp.time),
      u16(stamp.day),
      u32(crc),
      u32(compressed.length),
      u32(input.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(headerOffset),
      name,
    ]));
  }

  const centralDir = Buffer.concat(central);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat([...locals, centralDir, end]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const files = walk(EXTENSION_DIR);
if (!files.length) throw new Error('No extension files found.');
fs.writeFileSync(OUT_FILE, zipFiles(files));
console.log(`Packaged ${files.length} extension files: ${path.relative(ROOT, OUT_FILE)}`);
