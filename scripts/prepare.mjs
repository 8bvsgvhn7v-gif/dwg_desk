import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
await mkdir('public/wasm', { recursive: true });
for (const name of ['dwg-worker.js', 'libredwg-web.js', 'libredwg-web.wasm', 'dwfv-render.wasm']) await copyFile(require.resolve('@flyfish-dev/cad-viewer/wasm/' + name), 'public/wasm/' + name);
await copyFile('node_modules/@flyfish-dev/cad-viewer/LICENSE', 'LICENSE');
const packages = ['@flyfish-dev/cad-viewer', '@mlightcad/libredwg-web', '@mlightcad/shx-parser', 'dwf-viewer', 'dxf-parser', 'loglevel'];
let notices = 'DWG Desk 1.3.3 — third-party notices\n\n';
for (const name of packages) {
  const pkg = JSON.parse(await readFile('node_modules/' + name + '/package.json', 'utf8'));
  notices += `\n${name} ${pkg.version} — ${pkg.license}\n${JSON.stringify(pkg.repository || '')}\n`;
  for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING', 'NOTICE']) {
    try { notices += await readFile('node_modules/' + name + '/' + file, 'utf8') + '\n'; } catch {}
  }
}
await writeFile('THIRD-PARTY-NOTICES.txt', notices);
