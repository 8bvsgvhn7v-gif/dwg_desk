import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {newDesign,DEFAULT_LIBRARY,copy,validateDesign} from '../shared/design-model.js';
import {mergeDesignDxf,parseDxf,records,section,worldTransform,verifyExportLayers,cadExportColor,suggestCadCableWidth} from '../shared/cad-export.js';
import engine from '../electron/cad-export.cjs';
const template=await readFile(new URL('../shared/templates/empty-r2000.dxf',import.meta.url),'latin1');
const design=()=>{const d=newDesign();d.objects.push({id:'cable',kind:'cable',layerId:'cables',name:'Kabel Łączność',description:'',color:'#ffbf69',cableType:'UTP',points:[{x:0,y:0},{x:6000,y:0},{x:6000,y:4000}],flags:[{id:'flag',ratio:.5,position:{x:2000,y:1000}}]});d.objects.push({id:'camera',kind:'symbol',layerId:'cameras',name:'CAM-01',description:'Kamera 4 MP',symbol:copy(DEFAULT_LIBRARY.symbols[0]),position:{x:1500,y:1500},rotation:135,fov:90,range:2000,size:100,showFov:true});return d;};
test('CAD export retains layers, units, cable vertices and complete length flags',()=>{
 const r=mergeDesignDxf(template,design(),{unit:'mm',displayUnit:'m',textHeight:80}),pairs=parseDxf(r.text),s=section(pairs,'ENTITIES'),entities=records(pairs.slice(s.start+2,s.end));assert.match(r.text,/10 m/);assert.match(Buffer.from(r.text,'latin1').toString('utf8'),/Łączność/);assert.equal(entities[0].find(p=>p[0]===90)[1],'3');assert.deepEqual(entities[0].filter(p=>p[0]===10).map(p=>Number(p[1])),[0,6000,6000]);assert.ok(Object.keys(verifyExportLayers(r.text,r.expected)).length>=2);
 const handles=pairs.filter(p=>p[0]===5).map(p=>p[1]);assert.equal(new Set(handles).size,handles.length);assert.throws(()=>verifyExportLayers(r.text,{DWGDesk_Kamery:100}),/Weryfikacja/);
});
test('export reverses saved UCS rotations into original CAD coordinates',()=>{
 const transform={a:0,b:1,c:-1,d:0,e:10,f:-20},toWorld=worldTransform(transform);assert.deepEqual(toWorld({x:5,y:7}),{x:27,y:5});assert.throws(()=>worldTransform({a:0,b:0,c:0,d:0,e:0,f:0}));
 const r=mergeDesignDxf(template,design(),{sceneTransform:transform,unit:'mm',displayUnit:'m',textHeight:80}),p=parseDxf(r.text),s=section(p,'ENTITIES'),first=records(p.slice(s.start+2,s.end))[0];assert.deepEqual(first.filter(p=>p[0]===10).map(p=>Number(p[1])),[20,20,4020]);assert.deepEqual(first.filter(p=>p[0]===20).map(p=>Number(p[1])),[10,-5990,-5990]);
});
test('failed CAD export never overwrites an existing target or its original source',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'cad-save-test-'));try{const file=path.join(dir,'drawing.dwg'),bytes=Buffer.from('AC1032 source');await writeFile(file,bytes);const payload={name:'source.dwg',bytes,format:'dwg',includeBase:false,design:design(),unit:'mm',displayUnit:'m',textHeight:80};await assert.rejects(engine.saveCadExport(file,payload),/oryginalnego/);assert.deepEqual(await readFile(file),bytes);
 const target=path.join(dir,'target.dwg');await writeFile(target,'previous file');await assert.rejects(engine.saveCadExport(target,payload,{converter:'/usr/bin/false'}),/Konwerter/);assert.equal(await readFile(target,'utf8'),'previous file');}finally{await rm(dir,{recursive:true,force:true});}
});
test('all exported element types and camera sectors keep individual RGB colors',()=>{
 const d=design();d.objects[0].color='#123abc';d.objects[1].color='#ed1287';d.objects.push({id:'point',kind:'point',name:'P1',layerId:'points',position:{x:20,y:30},size:5,rotation:0,color:'#fedcba'},{id:'text',kind:'text',name:'Opis',layerId:'points',position:{x:50,y:60},size:5,rotation:0});
 const exported=mergeDesignDxf(template,d,{unit:'mm'}),p=parseDxf(exported.text),s=section(p,'ENTITIES'),es=records(p.slice(s.start+2,s.end));
 for(const [layer,color] of [['DWGDesk_Trasy kablowe',0x123abc],['DWGDesk_Kamery',0xed1287]]){const objects=es.filter(e=>e.find(p=>p[0]===8)?.[1]===layer);assert.ok(objects.length>1);assert.ok(objects.every(e=>Number(e.find(p=>p[0]===420)?.[1])===color));}
 const pointEntities=es.filter(e=>e.find(p=>p[0]===8)?.[1]==='DWGDesk_Punkty i opisy');assert.deepEqual(pointEntities.map(e=>Number(e.find(p=>p[0]===420)?.[1])),[0xfedcba,0xfedcba,0xfedcba,0xfedcba,0x80c7ff]);
});

test('survey labels use model dimensions instead of screen zoom and camera details are optional',()=>{
 const d=design();d.objects=d.objects.filter(o=>o.kind==='symbol');d.objects[0].size=1.5;d.objects[0].range=20;
 const inspect=options=>{const p=parseDxf(mergeDesignDxf(template,d,{unit:'m',...options}).text),s=section(p,'ENTITIES');return records(p.slice(s.start+2,s.end));};
 const es=inspect({}),name=es.find(r=>r[0][1]==='TEXT');assert.equal(Number(name.find(p=>p[0]===40)[1]),.75);assert.ok(!es.some(r=>r[0][1]==='MTEXT'));
 const explicit=inspect({textHeight:.5,includeCameraDetails:true});assert.equal(Number(explicit.find(r=>r[0][1]==='TEXT').find(p=>p[0]===40)[1]),.5);assert.equal(Number(explicit.find(r=>r[0][1]==='MTEXT').find(p=>p[0]===40)[1]),.4);
 assert.equal(Number(explicit.find(r=>r[0][1]==='TEXT').find(p=>p[0]===10)[1]),d.objects[0].position.x);
});
test('export label preferences remain optional in existing projects and reject invalid heights',()=>{
 const d=design();assert.doesNotThrow(()=>validateDesign(d));d.settings.cadTextHeight=.75;d.settings.cadCameraDetails=false;assert.doesNotThrow(()=>validateDesign(d));
 for(const invalid of [0,-1,NaN,Infinity,1e10,'1']){const bad=copy(d);bad.settings.cadTextHeight=invalid;assert.throws(()=>validateDesign(bad));}
 const bad=copy(d);bad.settings.cadCameraDetails='yes';assert.throws(()=>validateDesign(bad));
});

const exportedEntities=text=>{const p=parseDxf(text),s=section(p,'ENTITIES');return records(p.slice(s.start+2,s.end));};
const field=(r,c)=>r.find(p=>p[0]===c)?.[1];
test('white-background export makes pale colors readable without changing project or base entities',()=>{
 const palette=['#ffbf69','#a5ebbd','#80c7ff','#ff7f83','#ffe066','#c6a0ff','#ff8cce','#ffffff','#000000','#123456'];
 for(const color of palette){
  const result=cadExportColor(color,'white'),rgb=[1,3,5].map(i=>parseInt(result.slice(i,i+2),16)/255);
  const lum=rgb.reduce((s,c,i)=>s+[.2126,.7152,.0722][i]*(c<=.04045?c/12.92:((c+.055)/1.055)**2.4),0);
  assert.ok(1.05/(lum+.05)>=4.5,`${color} → ${result}`);assert.equal(cadExportColor(color,'original'),color);
 }
 assert.equal(cadExportColor('#123456','white'),'#123456');
 const d=design(),before=copy(d),base=mergeDesignDxf(template,design()).text;
 const result=mergeDesignDxf(base,d,{colorMode:'white'}),es=exportedEntities(result.text),original=exportedEntities(base);
 assert.deepEqual(es.slice(0,original.length),original);assert.deepEqual(d,before);
 const added=es.slice(original.length);assert.ok(added.every(r=>field(r,420)===String(parseInt(cadExportColor(field(r,8).includes('Kamery')?'#a5ebbd':'#ffbf69','white').slice(1),16))));
});
test('CAD strokes and model-space widths persist separately without changing coordinates or length',()=>{
 const d=design(),width=suggestCadCableWidth(.75);assert.equal(width,.1875);
 const r=mergeDesignDxf(template,d,{unit:'mm',displayUnit:'m',cableWidth:width,lineWeight:50}),es=exportedEntities(r.text);
 assert.equal(field(es[0],43),String(width));assert.equal(field(es[0],370),'50');
 assert.deepEqual(es[0].filter(p=>p[0]===10).map(p=>Number(p[1])),[0,6000,6000]);assert.match(r.text,/10 m/);
 const camera=es.filter(r=>field(r,8)==='DWGDesk_Kamery'),sector=camera.find(r=>Number(field(r,90))===66);
 assert.equal(field(sector,43),'0');assert.equal(field(sector,370),'18');
 assert.ok(camera.filter(r=>field(r,0)==='LWPOLYLINE'&&r!==sector).every(r=>Number(field(r,43))===width/2));
 assert.ok(es.filter(r=>field(r,0)==='TEXT').every(r=>field(r,370)==='25'));
 const p=parseDxf(r.text),i=p.findIndex(p=>p[0]===9&&p[1]==='$LWDISPLAY');assert.deepEqual(p[i+1],[290,'1']);
 assert.equal(field(exportedEntities(mergeDesignDxf(template,d,{cableWidth:0}).text)[0],43),'0');
 for(const options of [{cableWidth:-1},{cableWidth:NaN},{cableWidth:'1'},{lineWeight:34},{lineWeight:'35'},{colorMode:'unknown'}])assert.throws(()=>mergeDesignDxf(template,d,options),/wygląd/);
});
test('line appearance preferences are backward compatible and reject invalid persisted values',()=>{
 const d=design();assert.doesNotThrow(()=>validateDesign(d));Object.assign(d.settings,{cadColorMode:'white',cadLineWeight:35,cadCableWidth:0});assert.doesNotThrow(()=>validateDesign(d));
 for(const invalid of [{cadColorMode:'invalid'},{cadLineWeight:NaN},{cadLineWeight:10000},{cadCableWidth:-1},{cadCableWidth:Infinity},{cadCableWidth:'0'}]){const bad=copy(d);Object.assign(bad.settings,invalid);assert.throws(()=>validateDesign(bad));}
});
