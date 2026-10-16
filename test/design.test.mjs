import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {newDesign,DEFAULT_LIBRARY,copy,validateDesign,validateLibrary,pathLength,pointOnPath,translateObject,DesignHistory,rotationToward} from '../shared/design-model.js';
import storage from '../electron/design-storage.cjs';
const cable=()=>({id:'route',kind:'cable',layerId:'cables',name:'TR-01',description:'',cableType:'UTP',color:'#ffbf69',points:[{x:0,y:0},{x:6000,y:0},{x:6000,y:4000}],flags:[{id:'flag',ratio:.5,position:{x:5200,y:200}}]});
test('camera aiming uses model XY directions, preserves a zero-length aim and snaps across north',()=>{
  const origin={x:7514100,y:5936288};
  for(const [dx,dy,expected] of [[1,0,0],[0,1,90],[-1,0,180],[0,-1,270],[-1,1,135]])assert.equal(rotationToward(origin,{x:origin.x+dx,y:origin.y+dy}),expected);
  assert.equal(rotationToward(origin,origin,73),73);
  assert.equal(rotationToward({x:0,y:0},{x:10,y:-.1},0,true),0);
  assert.equal(rotationToward({x:0,y:0},{x:Math.cos(37*Math.PI/180),y:Math.sin(37*Math.PI/180)},0,true),30);
});
test('cable flag anchor follows edited route and length is geometric',()=>{
  const c=cable();assert.equal(pathLength(c.points),10000);assert.deepEqual(pointOnPath(c.points,.5),{x:5000,y:0});
  c.points[1]={x:3000,y:4000};assert.equal(pathLength(c.points),8000);assert.deepEqual(pointOnPath(c.points,.5),{x:2400,y:3200});
  translateObject(c,100,200);assert.equal(pathLength(c.points),8000);assert.deepEqual(c.flags[0].position,{x:5300,y:400});
});
test('undo and redo retain complete layer, geometry and flag snapshots',()=>{
  const h=new DesignHistory();h.change(s=>s.objects.push(cable()));h.change(s=>s.objects[0].points[1]={x:3000,y:4000});h.undo();assert.equal(pathLength(h.state.objects[0].points),10000);h.redo();assert.equal(pathLength(h.state.objects[0].points),8000);h.undo();h.undo();assert.equal(h.state.objects.length,0);
});
test('project validation rejects malformed geometry and unknown references',()=>{
  const d=newDesign();d.objects.push(cable());assert.deepEqual(validateDesign(d),d);
  for(const mutate of [x=>x.objects[0].layerId='missing',x=>x.objects[0].points[0].x=NaN,x=>x.objects[0].flags[0].ratio=3,x=>x.layers.push(copy(x.layers[0])),x=>x.objects.push(copy(x.objects[0]))]){const invalid=copy(d);mutate(invalid);assert.throws(()=>validateDesign(invalid),/Nieprawidłowe/);}
  const library=copy(DEFAULT_LIBRARY);library.symbols[0].fov=999;assert.throws(()=>validateLibrary(library));
});
test('drawing overlays and reusable library persist independently and validate before replacing files',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'dwg-design-test-'));try{
    const store=new storage.DesignStorage(dir),a='a'.repeat(64),b='b'.repeat(64);const d=newDesign();d.objects.push(cable());await store.saveDesign(a,d);assert.equal(await store.loadDesign(b),null);
    const second=new storage.DesignStorage(dir);assert.deepEqual(await second.loadDesign(a),d);
    const library=await second.loadLibrary();library.symbols[0].fov=103;await second.saveLibrary(library);assert.equal((await store.loadLibrary()).symbols[0].fov,103);
    const file=store.file(a),before=await readFile(file,'utf8');await assert.rejects(store.saveDesign(a,{version:5}));assert.equal(await readFile(file,'utf8'),before);
    await assert.rejects(store.loadDesign('../../x'));
    await writeFile(store.file(b),'{broken');await assert.rejects(store.loadDesign(b));assert.equal(await readFile(store.file(b),'utf8'),'{broken');
    const next=copy(d);next.objects[0].name='Latest';await Promise.all([store.saveDesign(a,d),store.saveDesign(a,next)]);assert.equal((await store.loadDesign(a)).objects[0].name,'Latest');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('optional element colors preserve legacy projects and reject malformed overrides',()=>{
  const d=newDesign();d.objects.push(cable(),{id:'camera',kind:'symbol',layerId:'cameras',name:'K-01',position:{x:100,y:200},size:10,rotation:0,symbol:copy(DEFAULT_LIBRARY.symbols[0]),fov:90,range:100,showFov:true},{id:'point',kind:'point',layerId:'points',name:'P-01',position:{x:200,y:200},size:5,rotation:0},{id:'text',kind:'text',layerId:'points',name:'Opis',position:{x:300,y:200},size:10,rotation:0});
  assert.deepEqual(validateDesign(d),d); // Existing v1 projects have no symbol/point/text overrides.
  for(const o of d.objects)o.color='#123abc';
  assert.deepEqual(validateDesign(d),d);
  for(let i=0;i<d.objects.length;i++){const bad=copy(d);bad.objects[i].color='red';assert.throws(()=>validateDesign(bad));}
  for(const o of d.objects)delete o.color;
  assert.deepEqual(validateDesign(d),d);
  const lib=copy(DEFAULT_LIBRARY);lib.symbols[0].color='#123abc';assert.deepEqual(validateLibrary(lib),lib);lib.symbols[0].color='#oops';assert.throws(()=>validateLibrary(lib));
});
