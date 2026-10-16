const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, callback) => { const listener = (_event, payload) => callback(payload); ipcRenderer.on(channel, listener); return () => ipcRenderer.removeListener(channel, listener); };
contextBridge.exposeInMainWorld('desktop', {
  open: () => ipcRenderer.invoke('choose-file'),
  ready: () => ipcRenderer.invoke('ready'),
  saveCSV: csv => ipcRenderer.invoke('save-csv', csv),
  loadDesign:key=>ipcRenderer.invoke('load-design',key),
  saveDesign:(key,data)=>ipcRenderer.invoke('save-design',key,data),
  loadLibrary:()=>ipcRenderer.invoke('load-library'),
  saveLibrary:data=>ipcRenderer.invoke('save-library',data),
  exportCad:payload=>ipcRenderer.invoke('export-cad',payload),
  finishClose:()=>ipcRenderer.invoke('finish-close'),
  onDrawing: callback => subscribe('drawing', callback),
  onError: callback => subscribe('file-error', callback),
  onAction: callback => subscribe('action', callback)
});
