const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {createHash}=require('node:crypto');
const run=promisify(execFile),MAX=256*1024*1024;
const modules=()=>import('../shared/cad-export.js');
async function findConverter(){for(const root of [path.join(os.homedir(),'Applications'),'/Applications']){const file=path.join(root,'ODAFileConverter.app/Contents/MacOS/ODAFileConverter');try{await fs.access(file,require('node:fs').constants.X_OK);return file;}catch{}}throw new Error('Zainstaluj ODA File Converter w folderze Aplikacje, aby eksportować DWG/DXF. Konwersja odbywa się lokalnie.');}
function sourceBuffer(payload){if(!payload||!['dwg','dxf'].includes(payload.format)||typeof payload.includeBase!=='boolean'||typeof payload.name!=='string'||!/^.+\.(dwg|dxf)$/i.test(payload.name))throw new Error('Nieprawidłowe ustawienia eksportu.');const b=Buffer.from(payload.bytes||[]);if(!b.length||b.length>150*1024*1024)throw new Error('Nieprawidłowy rozmiar podkładu.');return b;}
async function createCadExport(payload,options={}){
  const source=sourceBuffer(payload),{mergeDesignDxf,verifyExportLayers}=await modules();
  const {validateDesign}=await import('../shared/design-model.js');validateDesign(payload.design);
  const converter=options.converter||await findConverter();
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'dwg-desk-export-')),warnings=[];
  async function convert(input,folder,format){
    await fs.mkdir(folder,{recursive:true});
    let result;try{result=await run('/usr/bin/sandbox-exec',['-p','(version 1)(allow default)(deny network*)',converter,path.dirname(input),folder,'ACAD2018',format.toUpperCase(),'0','1',path.basename(input)],{cwd:directory,timeout:120000,maxBuffer:4*1024*1024,windowsHide:true});}catch(error){throw new Error(error.killed?'Przekroczono czas lokalnej konwersji CAD.':`Konwerter ODA nie mógł zapisać rysunku. ${(error.stderr||error.message).slice(-400)}`);}
    const output=path.join(folder,path.basename(input,path.extname(input))+'.'+format);
    const err=await fs.readFile(path.join(folder,path.basename(input)+'.err'),'utf8').catch(()=> '');
    for(const line of (err+'\n'+result.stderr).split(/\r?\n/))if(/warning|error|unsupported|skipping/i.test(line))warnings.push(line.replaceAll(directory,'<eksport>').slice(0,300));
    try{await fs.access(output);}catch{throw new Error('Nie udało się przekonwertować podkładu do poprawnego CAD. '+err.replaceAll(directory,'<eksport>').slice(0,600));}
    return output;
  }
  async function read(file){const stat=await fs.stat(file);if(stat.size>MAX||!stat.size)throw new Error('Wynik konwersji jest pusty albo przekracza 256 MB.');return fs.readFile(file);}
  try{
    const inputFolder=path.join(directory,'input');await fs.mkdir(inputFolder);
    const ext=payload.includeBase?path.extname(payload.name).toLowerCase():'.dxf',input=path.join(inputFolder,'source'+ext);
    await fs.writeFile(input,payload.includeBase?source:await fs.readFile(options.templatePath||path.join(__dirname,'../shared/templates/empty-r2000.dxf')),{mode:0o600});
    const base=(await read(await convert(input,path.join(directory,'base'),'dxf'))).toString('latin1');
    const merged=mergeDesignDxf(base,payload.design,payload),projectFolder=path.join(directory,'project');await fs.mkdir(projectFolder);
    const candidate=path.join(projectFolder,'project.dxf');await fs.writeFile(candidate,merged.text,{encoding:'latin1',mode:0o600});
    const output=await convert(candidate,path.join(directory,'output'),payload.format);
    const check=payload.format==='dxf'?output:await convert(output,path.join(directory,'verification'),'dxf');
    verifyExportLayers((await read(check)).toString('latin1'),merged.expected);
    const bytes=await read(output);
    if(payload.format==='dwg'&&bytes.subarray(0,6).toString()!=='AC1032')throw new Error('Nieprawidłowy nagłówek zapisanego DWG.');
    return {bytes,summary:{format:payload.format,version:'AutoCAD 2018',engine:'ODA File Converter',objects:merged.objectCount,layerNames:merged.layerNames,verified:true,warnings:[...new Set(warnings)].slice(0,20),warningCount:warnings.length,includeBase:payload.includeBase}};
  }finally{await fs.rm(directory,{recursive:true,force:true});}
}
async function protectSource(file,payload){
  try{const stat=await fs.lstat(file);if(stat.isSymbolicLink())throw new Error('Wybierz nowy plik zamiast dowiązania.');if(!stat.isFile())throw new Error('Wybierz plik docelowy.');if(stat.size===payload.bytes.length){const existing=await fs.readFile(file),source=sourceBuffer(payload),hash=b=>createHash('sha256').update(b).digest('hex');if(hash(existing)===hash(source))throw new Error('Wybierz nową nazwę. Eksport nie nadpisuje oryginalnego podkładu.');}}catch(error){if(error.code!=='ENOENT')throw error;}
}
async function saveCadExport(file,payload,options){
  await protectSource(file,payload);const result=await createCadExport(payload,options);await protectSource(file,payload);
  const temporary=path.join(path.dirname(file),`.dwgdesk-${require('node:crypto').randomUUID()}.tmp`);
  try{await fs.writeFile(temporary,result.bytes,{mode:0o600,flag:'wx'});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}
  return result.summary;
}
module.exports={createCadExport,saveCadExport,sourceBuffer,findConverter};
