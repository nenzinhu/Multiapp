/**
 * Empacota `extension/` em `public/extension/multiapp-cofre.zip`, o arquivo que
 * a página /extensao entrega para instalação manual no Chrome.
 *
 * Sem dependências: escreve o ZIP (deflate + CRC32) com o `node:zlib`.
 *
 *   node scripts/build-extension.mjs
 */

import { deflateRawSync } from "node:zlib";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceDir = path.join(root, "extension");
const outputDir = path.join(root, "public", "extension");
const outputFile = path.join(outputDir, "multiapp-cofre.zip");
const folderName = "multiapp-cofre";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, day };
}

/** ZIP sem compressão de diretórios: cada arquivo vira uma entrada deflate. */
function buildZip(files) {
  const chunks = [];
  const directory = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(`${folderName}/${file.name}`, "utf8");
    const raw = file.data;
    const compressed = deflateRawSync(raw, { level: 9 });
    const checksum = crc32(raw);
    const { time, day } = dosDateTime(file.mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuffer, end]);
}

async function collect(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = path.join(dir, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await collect(absolute, name)));
    else if (entry.isFile()) {
      const info = await stat(absolute);
      files.push({ name, data: await readFile(absolute), mtime: info.mtime });
    }
  }
  return files;
}

const files = await collect(sourceDir);
const manifest = JSON.parse(
  await readFile(path.join(sourceDir, "manifest.json"), "utf8"),
);
const zip = buildZip(files);
await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, zip);

console.log(
  `${folderName} ${manifest.version} → ${path.relative(root, outputFile)} (${files.length} arquivos, ${(zip.length / 1024).toFixed(1)} KB)`,
);
