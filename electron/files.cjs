const fs = require('node:fs/promises');
const path = require('node:path');
const MAX_BYTES = 150 * 1024 * 1024;
const isDrawing = value => typeof value === 'string' && /\.(dwg|dxf)$/i.test(value);
async function readDrawing(file) {
  if (!isDrawing(file)) throw new Error('Wybierz plik DWG lub DXF.');
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size === 0) throw new Error('Plik jest pusty albo nie jest rysunkiem.');
    if (stat.size > MAX_BYTES) throw new Error('Limit rozmiaru rysunku wynosi 150 MB.');
    const bytes = await handle.readFile();
    if (bytes.length > MAX_BYTES) throw new Error('Limit rozmiaru rysunku wynosi 150 MB.');
    return { name: path.basename(file), bytes };
  } finally { await handle.close(); }
}
module.exports = { isDrawing, readDrawing, MAX_BYTES };
