import { mkdtemp, mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
// Signing in an unsynchronized temporary directory avoids FinderInfo attributes
// injected by macOS File Provider into bundles under iCloud Documents.
const temporary = await mkdtemp('/private/tmp/dwg-desk-release-');
const output = path.resolve(process.env.DWG_DESK_OUTPUT || 'release');
await mkdir(output,{recursive:true});
await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['node_modules/electron-builder/out/cli/cli.js','--mac','--arm64',`--config.directories.output=${temporary}`],{stdio:'inherit'});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Packaging exited with ${code}`)));
});
for(const file of await readdir(temporary)) if(/\.(dmg|zip)$/.test(file)) await copyFile(path.join(temporary,file),path.join(output,file));
await writeFile('build/last-release-path.txt',temporary+'\n');
console.log(`Signed application retained for acceptance: ${temporary}/mac-arm64/DWG Desk.app`);
console.log(`Artifacts: ${output}`);
