import assert from 'node:assert/strict';

export async function verifyPanning(page,app,check){
  const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const view=async()=>{await frame();return page.evaluate(()=>window.__dwgDiagnostics.view());};
  const box=await page.locator('#viewer').boundingBox(),a={x:Math.round(box.x+box.width*.4),y:Math.round(box.y+box.height*.5)},b={x:a.x+60,y:a.y+35};
  const begin=async(button='middle')=>{await page.mouse.move(a.x,a.y);await page.mouse.down({button});await page.mouse.move(b.x,b.y);};
  const stable=async(label)=>{const before=await view();await page.mouse.move(a.x+110,a.y+65);await page.mouse.move(a.x+130,a.y+85);assert.deepEqual(await view(),before,label);};
  await page.click('#measure');
  let before=await view();await begin();let after=await view();
  assert.ok(Math.abs(after.centerX-(before.centerX-60/before.scale))<1e-7);
  assert.ok(Math.abs(after.centerY-(before.centerY+35/before.scale))<1e-7);
  await page.mouse.up({button:'middle'});await stable('Release inside must stop panning');check('Middle drag pans once by the correct delta and stops on release');
  for(let i=0;i<3;i++){await page.mouse.click(a.x,a.y,{button:'middle'});await stable('Middle click must not latch');}
  check('Repeated middle clicks do not latch panning');
  await begin();await page.mouse.move(100,100);await page.mouse.up({button:'middle'});await stable('Release outside drawing must stop panning');check('Release over toolbar ends a captured drag');
  // Emulate OS capture loss, then use native input to release outside the canvas.
  await page.evaluate(()=>{window.__panTestPointer=null;document.addEventListener('pointerdown',e=>window.__panTestPointer=e.pointerId,{capture:true,once:true});});
  await begin();await page.evaluate(()=>{for(const el of document.querySelectorAll('#viewport, #viewer canvas'))if(el.hasPointerCapture(window.__panTestPointer))el.releasePointerCapture(window.__panTestPointer);});
  await page.mouse.move(100,100);await page.mouse.up({button:'middle'});await stable('Lost capture and outside release must not leave the drawing attached to cursor');check('Lost pointer capture cannot leave panning stuck');
  // Playwright forces focus by default; disable that override for native focus QA.
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
  await app.evaluate(({app,BrowserWindow})=>{app.focus({steal:true});BrowserWindow.getAllWindows()[0].show();BrowserWindow.getAllWindows()[0].focus();});
  await page.waitForFunction(()=>document.hasFocus(),null,{timeout:5000});await begin();
  await app.evaluate(({BrowserWindow})=>{const main=BrowserWindow.getAllWindows()[0];const focusWindow=new BrowserWindow({width:180,height:100,show:true});focusWindow.setAlwaysOnTop(true);focusWindow.focus();global.__panFocusWindow=focusWindow;global.__panMain=main;});
  await page.waitForFunction(()=>!document.hasFocus(),null,{timeout:5000});
  await app.evaluate(()=>{global.__panFocusWindow.close();global.__panMain.focus();});
  await page.waitForFunction(()=>document.hasFocus(),null,{timeout:5000});await stable('Switching windows must cancel panning');await page.mouse.up({button:'middle'});check('Focus loss cancels the drag');
  await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp.detach();await app.evaluate(()=>global.__panMain.hide());
  await begin();await page.evaluate(()=>{const canvas=document.querySelector('#viewer canvas');canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:window.__panTestPointer,bubbles:true}));});await stable('Pointer cancellation must stop panning');await page.mouse.up({button:'middle'});check('Cancelled pointer stops panning');
  // A missing release event is represented by the next move with buttons=0.
  await begin();await page.evaluate(()=>{const canvas=document.querySelector('#viewer canvas');canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:window.__panTestPointer,clientX:400,clientY:300,buttons:0,bubbles:true}));});
  await stable('No pressed button must stop panning even if pointerup was missed');await page.mouse.up({button:'middle'});check('Button state recovers safely from a missed release event');
  await page.click('#pan');before=await view();await begin('left');after=await view();assert.notDeepEqual(after,before);await page.mouse.up({button:'left'});await stable('Left pan release');check('Left-button pan mode still works');
  assert.equal((await page.evaluate(()=>window.__dwgDiagnostics.state())).measurements.length,0);check('Middle-button gestures do not create measurement points');
  await page.click('#fit');await frame();await page.click('#measure');
  await page.mouse.click(a.x,a.y);await page.mouse.click(a.x+100,a.y);
  const route=await page.evaluate(()=>window.__dwgDiagnostics.state().measurements);
  assert.equal(route[0].points.length,2);await begin();await page.mouse.up({button:'middle'});await stable('Panning during an active measurement stops on release');
  assert.deepEqual(await page.evaluate(()=>window.__dwgDiagnostics.state().measurements),route);
  await page.mouse.click(a.x+200,a.y+100);await page.mouse.click(a.x,a.y,{button:'right'});
  const finished=(await page.evaluate(()=>window.__dwgDiagnostics.state())).measurements[0];assert.equal(finished.points.length,3);assert.equal(finished.complete,true);
  check('Panning preserves the active measurement and left/right clicks continue the same route');
  await page.click('#clear');await page.click('#pan');await page.click('#fit');await frame();
}
