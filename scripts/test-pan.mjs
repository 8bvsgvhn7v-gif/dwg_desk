import {_electron as electron} from 'playwright';
import path from 'node:path';
import {verifyPanning} from './pan-checks.mjs';
const app=await electron.launch({args:[process.cwd()],env:{...process.env,ELECTRON_RUN_AS_NODE:'',DWG_DESK_USER_DATA:path.resolve('../qa/pan-profile')}});
try{
  const page=await app.firstWindow();await page.click('#demo');await page.waitForFunction(()=>window.__dwgDiagnostics?.state().entityCount>0&&!window.__dwgDiagnostics.state().busy);
  await verifyPanning(page,app,name=>console.log('PASS',name));
}finally{await app.close();}
