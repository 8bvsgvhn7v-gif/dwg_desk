import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import files from '../electron/files.cjs';
test('native file access rejects wrong types, directories, empty and oversized files',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'dwg-desk-test-'));try{
 await assert.rejects(files.readDrawing(path.join(dir,'x.txt')),/DWG/);
 const empty=path.join(dir,'empty.dwg');await writeFile(empty,'');await assert.rejects(files.readDrawing(empty),/pusty/);
 const huge=path.join(dir,'huge.dwg');const {open}=await import('node:fs/promises');const h=await open(huge,'w');await h.truncate(files.MAX_BYTES+1);await h.close();await assert.rejects(files.readDrawing(huge),/150 MB/);
 const sample=await files.readDrawing(new URL('./fixtures/Line-2000.dwg',import.meta.url).pathname);assert.equal(Buffer.from(sample.bytes).subarray(0,6).toString(),'AC1015');
 }finally{await rm(dir,{recursive:true,force:true});}
});
