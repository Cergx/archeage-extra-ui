const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  return value >>> 0;
});

const crc32 = (buffer) => {
  let value = 0xffffffff;
  for (const byte of buffer) value = (value >>> 8) ^ crcTable[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
};

const uint16 = (value) => {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
};

const uint32 = (value) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
};

/** Creates a deterministic, deflated ZIP archive without external dependencies. */
const createZip = (outputPath, entries) => {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'));
    const input = fs.readFileSync(entry.path);
    const compressed = zlib.deflateRawSync(input, { level: 9 });
    const checksum = crc32(input);

    const localHeader = Buffer.concat([
      uint32(0x04034b50), uint16(20), uint16(0), uint16(8), uint16(0), uint16(0),
      uint32(checksum), uint32(compressed.length), uint32(input.length), uint16(name.length), uint16(0), name,
    ]);
    localParts.push(localHeader, compressed);

    centralParts.push(Buffer.concat([
      uint32(0x02014b50), uint16(20), uint16(20), uint16(0), uint16(8), uint16(0), uint16(0),
      uint32(checksum), uint32(compressed.length), uint32(input.length), uint16(name.length), uint16(0),
      uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), name,
    ]));
    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.concat([
    uint32(0x06054b50), uint16(0), uint16(0), uint16(entries.length), uint16(entries.length),
    uint32(centralDirectory.length), uint32(offset), uint16(0),
  ]);
  fs.writeFileSync(outputPath, Buffer.concat([...localParts, centralDirectory, endRecord]));
};

const collectFiles = (rootDir, relativePath = '') => {
  const dir = path.join(rootDir, relativePath);
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const childPath = path.join(relativePath, entry.name);
    return entry.isDirectory() ? collectFiles(rootDir, childPath) : [childPath];
  });
};

module.exports = { createZip, collectFiles };
