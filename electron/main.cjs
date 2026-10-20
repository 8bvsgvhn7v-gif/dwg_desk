const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { isDrawing, readDrawing:readSource } = require('./files.cjs');
const { DesignStorage } = require('./design-storage.cjs');
const {saveCadExport,sourceBuffer}=require('./cad-export.cjs');
const openedFiles=new Set();
async function readDrawing(file){const data=await readSource(file);openedFiles.add(await fs.realpath(file));return data;}

protocol.registerSchemesAsPrivileged([{ scheme: 'cad', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
if (process.env.DWG_DESK_USER_DATA) app.setPath('userData', process.env.DWG_DESK_USER_DATA);
let win, pendingFile, ready = false, quitting=false, exporting=false;
app.on('before-quit',event=>{if(exporting){event.preventDefault();win?.webContents.send('file-error','Poczekaj na zakończenie eksportu CAD.');return;}quitting=true;});
const initialFile = process.argv.find((arg) => isDrawing(arg));
pendingFile = initialFile;
app.on('open-file', (event, file) => { event.preventDefault(); deliverFile(file); });

async function deliverFile(file) {
  if (!ready) { pendingFile = file; return; }
  try { win.webContents.send('drawing', await readDrawing(file)); }
  catch (error) { win.webContents.send('file-error', error.message); }
}
async function chooseFile() {
  const result = await dialog.showOpenDialog(win, { title: 'Otwórz rysunek', properties: ['openFile'], filters: [{ name: 'Rysunki CAD', extensions: ['dwg', 'dxf'] }] });
  if (result.canceled) return null;
  return readDrawing(result.filePaths[0]);
}
function trusted(event) {
  const url = new URL(event.senderFrame.url);
  if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || url.protocol !== 'cad:' || url.host !== 'viewer') throw new Error('Niedozwolone wywołanie.');
}
app.whenReady().then(async () => {
  const designs=new DesignStorage(path.join(app.getPath('userData'),'designs'));
  const root = path.join(__dirname, '../dist');
  protocol.handle('cad', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== 'viewer') return new Response('', { status: 403 });
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(root, '.' + relative);
      if (!file.startsWith(root + path.sep)) return new Response('', { status: 403 });
      return net.fetch(pathToFileURL(file).toString());
    } catch { return new Response('', { status: 404 }); }
  });
  // No remote connections, including references embedded in drawings.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: /^(https?|wss?|ftp):/i.test(details.url) });
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  ipcMain.handle('choose-file', async (event) => { trusted(event); return chooseFile(); });
  ipcMain.handle('load-design',async(event,key)=>{trusted(event);return designs.loadDesign(key);});
  ipcMain.handle('save-design',async(event,key,data)=>{trusted(event);return designs.saveDesign(key,data);});
  ipcMain.handle('load-library',async event=>{trusted(event);return designs.loadLibrary();});
  ipcMain.handle('save-library',async(event,data)=>{trusted(event);return designs.saveLibrary(data);});
  ipcMain.handle('export-cad',async(event,payload)=>{
    trusted(event);if(exporting)throw new Error('Eksport CAD jest już w toku.');sourceBuffer(payload);exporting=true;
    try{
      const result=await dialog.showSaveDialog(win,{title:'Zapisz plik z naniesionymi elementami',defaultPath:path.basename(payload.name,path.extname(payload.name))+'_projekt.'+payload.format,filters:[{name:payload.format.toUpperCase(),extensions:[payload.format]}]});
      if(result.canceled)return null;
      if(path.extname(result.filePath).toLowerCase()!=='.'+payload.format)throw new Error('Nazwa pliku powinna kończyć się na .'+payload.format);
      const target=await fs.realpath(result.filePath).catch(()=>path.resolve(result.filePath));if(openedFiles.has(target))throw new Error('Wybierz nową nazwę. Eksport nie nadpisuje otwartego podkładu.');
      return {...await saveCadExport(result.filePath,payload),fileName:path.basename(result.filePath)};
    }finally{exporting=false;}
  });
  ipcMain.handle('finish-close',event=>{trusted(event);if(quitting)app.quit();else win.close();});
  ipcMain.handle('ready', (event) => { trusted(event); ready = true; if (pendingFile) { const file = pendingFile; pendingFile = null; deliverFile(file); } });
  ipcMain.handle('save-csv', async (event, csv) => {
    trusted(event);
    if (typeof csv !== 'string' || csv.length > 2_000_000) throw new Error('Nieprawidłowy raport.');
    const result = await dialog.showSaveDialog(win, { title: 'Zapisz pomiary', defaultPath: 'pomiary.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (result.canceled) return false;
    await fs.writeFile(result.filePath, '\uFEFF' + csv, 'utf8');
    return true;
  });
  const createWindow = () => {
    ready = false;
    win = new BrowserWindow({ width: 1440, height: 940, minWidth: 980, minHeight: 680, title: 'DWG Desk', backgroundColor: '#11161c', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 19, y: 22 }, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => { if (url !== 'cad://viewer/index.html') event.preventDefault(); });
    win.webContents.on('will-attach-webview', event => event.preventDefault());
    win.loadURL('cad://viewer/index.html');
    win.on('close',event=>{if(exporting){event.preventDefault();win.webContents.send('file-error','Poczekaj na zakończenie eksportu CAD.');}});
    win.on('closed', () => { win = null; ready = false; });
  };
  const action = name => win?.webContents.send('action', name);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'DWG Desk', submenu: [{ role: 'about', label: 'O programie DWG Desk' }, { type: 'separator' }, { role: 'hide', label: 'Ukryj DWG Desk' }, { role: 'quit', label: 'Zakończ DWG Desk' }] },
    { label: 'Plik', submenu: [{ label: 'Otwórz rysunek…', accelerator: 'CmdOrCtrl+O', click: async () => { if (!win) createWindow(); try { const data = await chooseFile(); if (data) win.webContents.send('drawing', data); } catch (error) { win.webContents.send('file-error', error.message); } } }, {label:'Zapisz rysunek DWG / DXF…',accelerator:'CmdOrCtrl+S',click:()=>action('export-cad')}, {label:'Zapisz projekt lokalnie',click:()=>action('save-design')}, { label: 'Eksportuj pomiary…', click: () => action('export') }, { type: 'separator' }, { role: 'close', label: 'Zamknij okno' }] },
    { label: 'Edycja', submenu: [{ role: 'copy', label: 'Kopiuj' }, { role: 'selectAll', label: 'Zaznacz wszystko' }] },
    { label: 'Widok', submenu: [{ label: 'Dopasuj rysunek (F)', click: () => action('fit') }, { label: 'Pomiar odległości (M)', click: () => action('measure') }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Pełny ekran' }] },
    { label: 'Okno', submenu: [{ role: 'minimize', label: 'Minimalizuj' }, { role: 'zoom', label: 'Powiększ' }] }
  ]));
  app.setAboutPanelOptions({ applicationName: 'DWG Desk', applicationVersion: '1.3.2', copyright: 'Lokalny podgląd DWG / DXF • AGPL-3.0-only', credits: 'Silnik: @flyfish-dev/cad-viewer, LibreDWG / mlightcad. Pomiar w płaszczyźnie XY. Źródła i licencje dołączone do wydania.' });
  createWindow();
  app.on('activate', () => { if (!win) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
