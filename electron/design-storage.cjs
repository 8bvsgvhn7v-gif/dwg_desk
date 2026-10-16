const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
class DesignStorage {
  constructor(root){this.root=root;this.queue=Promise.resolve();}
  async validators(){return import('../shared/design-model.js');}
  file(key){if(!/^[a-f\d]{64}$/.test(key))throw new Error('Nieprawidłowy identyfikator rysunku.');return path.join(this.root,'drawings',key+'.json');}
  async read(file,limit){
    await this.queue;
    try{const handle=await fs.open(file,'r');try{if((await handle.stat()).size>limit)throw new Error('Dane projektu przekraczają limit rozmiaru.');return JSON.parse(await handle.readFile('utf8'));}finally{await handle.close();}}
    catch(e){if(e.code==='ENOENT')return null;throw e;}
  }
  write(file,value,limit=32*1024*1024){
    const text=JSON.stringify(value);if(Buffer.byteLength(text)>limit)throw new Error(`Dane przekraczają limit ${limit/1024/1024} MB.`);
    const operation=this.queue.then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(tmp,text,{flag:'wx',mode:0o600});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true});}});
    this.queue=operation.catch(()=>{});return operation;
  }
  async loadDesign(key){const data=await this.read(this.file(key),32*1024*1024);return data?(await this.validators()).validateDesign(data):null;}
  async saveDesign(key,data){const clean=(await this.validators()).validateDesign(data);await this.write(this.file(key),clean);return true;}
  async loadLibrary(){const {DEFAULT_LIBRARY,validateLibrary}=await this.validators();const data=await this.read(path.join(this.root,'library.json'),8*1024*1024);return validateLibrary(data||DEFAULT_LIBRARY);}
  async saveLibrary(data){const clean=(await this.validators()).validateLibrary(data);await this.write(path.join(this.root,'library.json'),clean,8*1024*1024);return true;}
}
module.exports={DesignStorage};
