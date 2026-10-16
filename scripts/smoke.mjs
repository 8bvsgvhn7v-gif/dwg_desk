import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyPanning} from './pan-checks.mjs';
const root=process.cwd(), qa=path.resolve(root,'../qa');await mkdir(qa,{recursive:true});
const app=await electron.launch({ executablePath:process.env.DWG_DESK_APP || undefined, args:process.env.DWG_DESK_APP ? [] : [root], env:{...process.env,ELECTRON_RUN_AS_NODE:'',DWG_DESK_USER_DATA:path.join(qa,'profile')}, timeout:30000 });
const screenshot=async name=>{const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await writeFile(path.join(qa,name),Buffer.from(png,'base64'));};
const report={checks:[],errors:[],version:'1.3.1'};
const check=(name)=>{report.checks.push(name);console.log('PASS',name);};
try {
 const page=await app.firstWindow();await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.hide();});await page.waitForSelector('#empty:not([hidden])');
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 await screenshot('welcome.png');check('Native Electron window, offline assets and empty state');
 await page.click('#demo');await page.waitForFunction(()=>window.__dwgDiagnostics?.state().entityCount>0 && !window.__dwgDiagnostics.state().busy);
 let state=await page.evaluate(()=>window.__dwgDiagnostics.state());assert.equal(state.drawingUnit,'mm');assert.ok(state.entityCount>40);assert.ok(state.pointCount>100);check('DXF rendering and automatic millimeter detection');
 await verifyPanning(page,app,check);
 const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const clickPoint=async point=>{await frame();const p=await page.evaluate(p=>window.__dwgDiagnostics.worldToScreen(p),point),box=await page.locator('#viewer').boundingBox();assert.ok(p.x>=0&&p.x<box.width&&p.y>=0&&p.y<box.height,'CAD endpoint lies inside the visible canvas');await page.mouse.click(box.x+p.x+1,box.y+p.y+1);};
 const rightFinish=async()=>{const box=await page.locator('#viewer').boundingBox();await page.mouse.click(box.x+box.width*.4,box.y+box.height*.6,{button:'right'});};
 const route=[{x:0,y:0},{x:6000,y:0},{x:6000,y:4000}];
 await page.click('#measure');for(const point of route)await clickPoint(point);
 state=await page.evaluate(()=>window.__dwgDiagnostics.state());assert.equal(state.measurements.length,1);assert.deepEqual(state.measurements[0].points,route);assert.equal(state.active,0);check('Successive left clicks snap exact endpoints into one continuous route');
 await page.click('#units-panel summary');await page.selectOption('#display-unit','m');await page.click('#units-panel summary');
 assert.equal(await page.locator('.distance').innerText(),'10 m');assert.equal(await page.locator('#grand-total').innerText(),'10 m');check('Two segments of 6 m and 4 m sum to 10 m');
 await rightFinish();state=await page.evaluate(()=>window.__dwgDiagnostics.state());assert.deepEqual(state.measurements[0].points,route);assert.equal(state.measurements[0].complete,true);assert.equal(state.active,null);check('Right button ends route without adding a point');
 await clickPoint({x:0,y:0});await clickPoint({x:0,y:4000});await clickPoint({x:6000,y:4000});await page.keyboard.press('Backspace');
 state=await page.evaluate(()=>window.__dwgDiagnostics.state());assert.equal(state.measurements[1].points.length,2);assert.equal(await page.locator('#grand-total').innerText(),'14 m');
 await page.mouse.move(600,400);assert.equal(await page.locator('#grand-total').innerText(),'14 m');assert.equal(await page.locator('#preview-total').isVisible(),true);
 await page.keyboard.press('Enter');state=await page.evaluate(()=>window.__dwgDiagnostics.state());assert.equal(state.active,null);assert.equal(state.measurements[1].complete,true);assert.equal(await page.locator('#units-panel').evaluate(el=>el.open),false);check('Independent routes, Backspace undo, Enter finish and preview excluded from sum');
 await page.click('#zoom-in');const before=await page.locator('#grand-total').innerText();await page.click('#zoom-out');assert.equal(await page.locator('#grand-total').innerText(),before);check('Measurement is invariant under zoom');
 await page.getByRole('checkbox',{name:'Warstwa ŚCIANY',exact:true}).uncheck();const off=await page.evaluate(()=>window.__dwgDiagnostics.state().pointCount);await page.getByRole('checkbox',{name:'Warstwa ŚCIANY',exact:true}).check();const on=await page.evaluate(()=>window.__dwgDiagnostics.state().pointCount);assert.ok(on>off);check('Layer visibility also removes its snap targets');
 const csvPath=path.join(qa,'pomiary.csv');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},csvPath);await page.click('#export');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('CSV'));const csv=await readFile(csvPath,'utf8');assert.match(csv,/1;2;4;m;10;10/);assert.match(csv,/SUMA POMIARÓW;;14;m/);check('Native CSV export includes every segment, cumulative distance and grand total');
 await screenshot('measurement.png');
 await page.click('#theme');await screenshot('light.png');await page.click('#theme');check('Light and dark drawing backgrounds');
 const remote=await page.evaluate(async()=>{try{await fetch('https://example.com/dwg-desk-offline-test');return 'connected';}catch{return 'blocked';}});assert.equal(remote,'blocked');check('External network access blocked');
 // The deliberate blocked request produces a CSP console error.
 report.errors=report.errors.filter(text=>/example.com|Content Security Policy|Refused to connect/.test(text)===false);
 for(const filename of ['Line-2000.dwg','Line-2018.dwg']) {
   const file=path.join(root,'test/fixtures',filename);
   await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
   await page.click('#open');await page.waitForFunction(name=>window.__dwgDiagnostics?.state().fileName===name&&!window.__dwgDiagnostics.state().busy,filename,{timeout:90000});
   await frame();state=await page.evaluate(()=>window.__dwgDiagnostics.state());assert.ok(state.entityCount>0);assert.ok(state.pointCount>=2);assert.ok(state.stats.drawn>0 || state.stats.primitiveCount>0);
   await page.locator('#notice-close').click({timeout:1000}).catch(()=>{});
   const points=await page.evaluate(()=>window.__dwgDiagnostics.snapPoints());const a=points[0],b=points.find(p=>Math.hypot(p.x-a.x,p.y-a.y)>1e-6);assert.ok(b);
   await page.click('#measure');await clickPoint(a);await clickPoint(b);await rightFinish();state=await page.evaluate(()=>window.__dwgDiagnostics.state());
   if(state.measurements.length!==1){await screenshot('failed-dwg.png');console.log('DWG click diagnostics',JSON.stringify(await page.evaluate(({a,b})=>({a:window.__dwgDiagnostics.worldToScreen(a),b:window.__dwgDiagnostics.worldToScreen(b),mode:window.__dwgDiagnostics.state().mode,hint:document.getElementById('tool-hint').textContent,rect:document.getElementById('viewer').getBoundingClientRect().toJSON()}),{a,b})));}
   assert.equal(state.measurements.length,1);
   const [start,end]=state.measurements[0].points, distance=Math.hypot(start.x-end.x,start.y-end.y),expected=Math.hypot(a.x-b.x,a.y-b.y);assert.ok(Math.abs(distance-expected)<1e-6);assert.equal(state.measurements[0].complete,true);
   report[filename]={entities:state.entityCount,snapPoints:state.pointCount,drawn:state.stats.drawn,primitives:state.stats.primitiveCount,distance,unit:state.drawingUnit,headerUnit:state.header?.INSUNITS??state.header?.$INSUNITS};
   await screenshot(filename+'.png');check(`${filename}: native open → WASM parse → render → exact endpoint measurement`);
 }
 const complex=path.join(root,'test/fixtures/TS1-2000.dwg');
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},complex);await page.click('#open');
 await page.waitForFunction(()=>window.__dwgDiagnostics?.state().fileName==='TS1-2000.dwg'&&!window.__dwgDiagnostics.state().busy,null,{timeout:90000});
 await frame();state=await page.evaluate(()=>window.__dwgDiagnostics.state());report.complex={coverage:'partial; explicit unsupported-object warning',entities:state.entityCount,drawn:state.stats.drawn,primitives:state.stats.primitiveCount,skipped:state.stats.skipped,unsupported:state.stats.unsupported};
 await screenshot('complex-dwg.png');
 assert.ok(state.entityCount>20);assert.ok(state.stats.primitiveCount>100);assert.ok(state.stats.skipped>0);assert.ok(state.stats.unsupported['3DSOLID']>0);assert.match(await page.locator('#notice-text').innerText(),new RegExp(`Niewyświetlone obiekty: ${state.stats.skipped}`));
 check('Mixed DWG: supported 2D geometry renders and unsupported objects are explicitly reported (partial coverage)');
 if(process.env.DWG_DESK_TEST_DRAWING){
   const file=path.resolve(process.env.DWG_DESK_TEST_DRAWING),hash=async()=>createHash('sha256').update(await readFile(file)).digest('hex'),before=await hash();
   await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);await page.click('#open');
   await page.waitForFunction(name=>window.__dwgDiagnostics?.state().fileName===name&&!window.__dwgDiagnostics.state().busy,path.basename(file),{timeout:90000});await frame();
   state=await page.evaluate(()=>window.__dwgDiagnostics.state());assert.equal(state.drawingUnit,'m');assert.equal(state.displayUnit,'m');assert.equal(state.unitDetection.method,'coordinate-system');assert.equal(await page.locator('#drawing-unit').inputValue(),'auto');assert.equal(state.measurements.length,0);
   await page.locator('#notice-close').click({timeout:1000}).catch(()=>{});await page.click('#measure');await page.locator('#snap').uncheck();
   const box=await page.locator('#viewer').boundingBox(),view=await page.evaluate(()=>window.__dwgDiagnostics.view());
   // Whole CSS pixels avoid Float32 quantization in Chromium's native input protocol.
   const clicks=[{x:box.width*.35,y:box.height*.75},{x:box.width*.65,y:box.height*.4},{x:box.width*.72,y:box.height*.38}].map(p=>({x:Math.round(p.x),y:Math.round(p.y)}));
   for(const p of clicks)await page.mouse.click(box.x+p.x,box.y+p.y);await rightFinish();
   state=await page.evaluate(()=>window.__dwgDiagnostics.state());const points=state.measurements[0].points;assert.equal(points.length,3);assert.equal(state.measurements[0].complete,true);
   const sum=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0),expected=clicks.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-clicks[i].x,p.y-clicks[i].y)/view.scale,0);
   assert.ok(Math.abs(sum-expected)<1e-6,JSON.stringify({sum,expected,box,view,clicks,points,actualScreen:await page.evaluate(points=>points.map(p=>window.__dwgDiagnostics.worldToScreen(p)),points),viewAfter:await page.evaluate(()=>window.__dwgDiagnostics.view())}));
   assert.equal(await hash(),before);report.userDrawing={unit:state.drawingUnit,detection:state.unitDetection,segments:2,sum,sourceUnchanged:true,sha256:before};
   await screenshot('user-drawing.png');check('User DWG: automatic PL-2000 metres, continuous measurement, original bytes unchanged');
 }
 const broken=path.join(qa,'uszkodzony.dwg');await writeFile(broken,'invalid DWG');await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},broken);await page.click('#open');await page.waitForFunction(()=>document.getElementById('notice-text').textContent.includes('Nie udało się odczytać'));
 state=await page.evaluate(()=>window.__dwgDiagnostics.state());assert.equal(state.entityCount,0);assert.equal(state.measurements.length,0);assert.ok(await page.locator('#measure').isDisabled());check('Corrupt DWG fails clearly without stale drawing or measurements');
 assert.deepEqual(report.errors,[]);check('No unexpected renderer errors');
 await writeFile(path.join(qa,process.env.DWG_DESK_APP?'packaged-report.json':'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
} finally {await app.close();}
