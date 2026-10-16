import { mkdir, writeFile } from 'node:fs/promises';
const rows=[]; const pair=(code,value)=>rows.push(String(code),String(value));
pair(0,'SECTION');pair(2,'HEADER');pair(9,'$ACADVER');pair(1,'AC1015');pair(9,'$INSUNITS');pair(70,4);pair(0,'ENDSEC');
pair(0,'SECTION');pair(2,'TABLES');pair(0,'TABLE');pair(2,'LAYER');pair(70,4);
for(const [name,color] of [['ŚCIANY',7],['OKNA',4],['WYPOSAŻENIE',8],['WYMIARY',3]]){pair(0,'LAYER');pair(2,name);pair(70,0);pair(62,color);pair(6,'CONTINUOUS');}pair(0,'ENDTAB');pair(0,'ENDSEC');
pair(0,'SECTION');pair(2,'ENTITIES');
function line(x,y,a,b,layer='ŚCIANY'){pair(0,'LINE');pair(8,layer);pair(10,x);pair(20,y);pair(30,0);pair(11,a);pair(21,b);pair(31,0);}
function rect(x,y,w,h,layer='ŚCIANY'){line(x,y,x+w,y,layer);line(x+w,y,x+w,y+h,layer);line(x+w,y+h,x,y+h,layer);line(x,y+h,x,y,layer);}
function circle(x,y,r,layer='WYPOSAŻENIE'){pair(0,'CIRCLE');pair(8,layer);pair(10,x);pair(20,y);pair(40,r);}
function text(x,y,size,value,layer='WYMIARY'){pair(0,'TEXT');pair(8,layer);pair(10,x);pair(20,y);pair(40,size);pair(1,value);}
rect(0,0,6000,4000);rect(150,150,5700,3700);line(3900,150,3900,3850);line(4050,150,4050,3850);
rect(850,3850,2100,150,'OKNA');line(850,3925,2950,3925,'OKNA');rect(5850,1100,150,1700,'OKNA');
rect(450,2700,2300,750,'WYPOSAŻENIE');rect(550,2800,900,550,'WYPOSAŻENIE');rect(1550,2800,1100,550,'WYPOSAŻENIE');
rect(600,1000,1700,850,'WYPOSAŻENIE');rect(1050,650,650,300,'WYPOSAŻENIE');circle(3100,950,350);circle(3100,950,300);
rect(4350,2550,1200,900,'WYPOSAŻENIE');rect(4450,2650,1000,700,'WYPOSAŻENIE');rect(4500,700,900,1200,'WYPOSAŻENIE');
text(800,2150,130,'PRACOWNIA','WYPOSAŻENIE');text(4420,2150,100,'ZAPLECZE','WYPOSAŻENIE');
line(0,-450,6000,-450,'WYMIARY');line(0,-70,0,-600,'WYMIARY');line(6000,-70,6000,-600,'WYMIARY');line(-85,-535,85,-365,'WYMIARY');line(5915,-535,6085,-365,'WYMIARY');text(2660,-350,140,'6 000');
line(-450,0,-450,4000,'WYMIARY');line(-70,0,-600,0,'WYMIARY');line(-70,4000,-600,4000,'WYMIARY');text(-1100,1900,140,'4 000');
text(0,4500,165,'PRACOWNIA / RZUT PARTERU','WYPOSAŻENIE');text(0,-1000,95,'RYSUNEK PRZYKLADOWY  /  jednostka: mm','WYPOSAŻENIE');
pair(0,'ENDSEC');pair(0,'EOF');await mkdir('public',{recursive:true});await writeFile('public/demo.dxf',rows.join('\n')+'\n');
// Attach the demonstration geometry to a complete CAD document, including ownership
// and subclass markers required by strict DWG/DXF converters.
const {readFile}=await import('node:fs/promises');
const {parseDxf,section,records,encodeDxf}=await import('../shared/cad-export.js');
const source=parseDxf(rows.join('\n')+'\n'),base=parseDxf(await readFile('shared/templates/empty-r2000.dxf','latin1'));
const value=(r,c)=>r.find(p=>p[0]===c)?.[1]?.trim();let nextHandle=0x1000;const handle=()=> (nextHandle++).toString(16).toUpperCase();
const table=name=>{const start=base.findIndex(([c,v],i)=>c===0&&v==='TABLE'&&base[i+1]?.[1]===name);return {start,end:base.findIndex(([c,v],i)=>i>start&&c===0&&v==='ENDTAB')};};
const block=table('BLOCK_RECORD'),model=records(base.slice(block.start,block.end)).find(r=>value(r,2)?.toUpperCase()==='*MODEL_SPACE'),owner=value(model,5);
const lt=table('LAYER'),layerOwner=value(records(base.slice(lt.start,lt.end))[0],5);
const sourceLayers=records(source).filter(r=>value(r,0)==='LAYER');const addedLayers=[];
for(const r of sourceLayers)addedLayers.push([0,'LAYER'],[5,handle()],[330,layerOwner],[100,'AcDbSymbolTableRecord'],[100,'AcDbLayerTableRecord'],[2,value(r,2)],[70,0],[62,value(r,62)],[6,'CONTINUOUS']);
const count=base.findIndex(([c],i)=>i>lt.start&&i<lt.end&&c===70);base[count][1]=String(Number(base[count][1])+sourceLayers.length);base.splice(lt.end,0,...addedLayers);
const es=section(source,'ENTITIES'),added=[];
for(const r of records(source.slice(es.start+2,es.end))){const kind=value(r,0),fields=r.filter(([c])=>c!==0&&c!==8);added.push([0,kind],[5,handle()],[330,owner],[100,'AcDbEntity'],[8,value(r,8)],[100,{LINE:'AcDbLine',CIRCLE:'AcDbCircle',TEXT:'AcDbText'}[kind]],...fields);if(kind==='TEXT')added.push([100,'AcDbText']);}
base.splice(section(base,'ENTITIES').end,0,...added);
for(const [name,code,v]of [['$ACADVER',1,'AC1032'],['$INSUNITS',70,'4'],['$HANDSEED',5,handle()]]){const i=base.findIndex(([c,n])=>c===9&&n===name);if(i>=0)base[i+1]=[code,v];else base.splice(section(base,'HEADER').end,0,[9,name],[code,v]);}
await writeFile('public/demo.dxf',encodeDxf(base),'utf8');
