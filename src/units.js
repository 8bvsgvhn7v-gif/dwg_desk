// INSUNITS: Autodesk CAD reference. PL-2000/PL-1992: GUGiK coordinate
// systems (metres). MEASUREMENT=1 and printed scales do not define a unit.
export const UNITS = {
  unit:{label:'j. rys.',name:'Nieokreślona',meters:null}, mm:{label:'mm',name:'Milimetry',meters:.001},
  cm:{label:'cm',name:'Centymetry',meters:.01}, dm:{label:'dm',name:'Decymetry',meters:.1},
  m:{label:'m',name:'Metry',meters:1}, km:{label:'km',name:'Kilometry',meters:1000},
  in:{label:'cale',name:'Cale',meters:.0254}, ft:{label:'stopy',name:'Stopy',meters:.3048},
  yd:{label:'yd',name:'Jardy',meters:.9144}, mi:{label:'mile',name:'Mile',meters:1609.344}
};
const CODES={1:'in',2:'ft',3:'mi',4:'mm',5:'cm',6:'m',7:'km',10:'yd',14:'dm'};
const ALIASES={millimeter:'mm',millimeters:'mm',millimetre:'mm',millimetres:'mm',centimeter:'cm',centimeters:'cm',meter:'m',meters:'m',metre:'m',metres:'m',kilometer:'km',kilometers:'km',inch:'in',inches:'in',feet:'ft',foot:'ft'};
const unwrap=value=>value&&typeof value==='object'?value.value:value;
function headerValue(header,key){return unwrap(header['$'+key]??header[key]??header[key.toLowerCase()]);}
function textsInModel(document){
  const texts=[];let count=0;
  const visit=(entities,parents=[])=>{
    for(const entity of entities||[]){
      if(++count>100000)return;
      if(entity.isInPaperSpace)continue;
      if(typeof entity.text==='string')texts.push(entity.text.slice(0,8000).replace(/\\P/g,' ').replace(/\\[A-Za-z][^;]*;/g,' ').replace(/[{}]/g,' '));
      if(entity.attribs)visit(entity.attribs,parents);
      const name=entity.blockName||entity.name;
      if(entity.kind==='insert'&&document.blocks?.[name]&&parents.length<16&&!parents.includes(name))visit(document.blocks[name].entities,[...parents,name]);
    }
  };visit(document.entities);return texts;
}
function hasProjectedCoordinates(document,system,zone){
  let matches=0,seen=0;
  const matchesPoint=point=>{
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
    const {x,y}=point;
    if(system==='1992')return x>100000&&x<1000000&&y>100000&&y<1000000;
    const east=e=>e>(zone?zone*1e6+100000:5100000)&&e<(zone?zone*1e6+900000:8900000);
    const north=n=>n>5300000&&n<6200000;
    return (east(x)&&north(y))||(east(y)&&north(x));
  };
  // Use geometry coordinates, not EXTMAX alone (outliers and title blocks).
  for(const entity of document.entities||[]){
    if(entity.isInPaperSpace)continue;
    const points=[entity.startPoint,entity.endPoint,entity.center,entity.insertionPoint,...(entity.vertices||[]).slice(0,20)];
    for(const p of points){if(++seen>100000)return matches>=3;if(matchesPoint(p)&&++matches>=3)return true;}
  }
  return false;
}
export function detectDrawingUnits(document={}){
  const raw=headerValue(document.header||{},'INSUNITS'),code=Number(raw);
  if(CODES[code])return {unit:CODES[code],method:'header',detail:`Wykryto z nagłówka DWG/DXF (INSUNITS=${code}).`};
  // A nonzero unsupported code must not be silently replaced by a heuristic.
  if(raw!=null&&Number.isFinite(code)&&code!==0)return {unit:'unit',method:'unsupported',detail:`Plik podaje nieobsługiwany kod jednostki ${code}.`};
  const named=String(document.units||'').trim().toLowerCase();
  const unit=UNITS[named]?named:ALIASES[named];
  if(unit&&unit!=='unit')return {unit,method:'metadata',detail:'Wykryto z jednostki zapisanej w metadanych rysunku.'};
  const texts=textsInModel(document);
  const declared=new Set();
  for(const text of texts){
    const match=text.match(/(?:jednostk[ai]\s+(?:rysunku|modelu)|drawing\s+units?|model\s+units?)\s*[:=]\s*(mm|cm|dm|km|m|in|ft)\b/i);
    if(match)declared.add(match[1].toLowerCase());
  }
  if(declared.size===1)return {unit:[...declared][0],method:'drawing-note',detail:'Wykryto z deklaracji jednostki w opisie rysunku.'};
  if(declared.size>1)return {unit:'unit',method:'conflict',detail:'Opisy rysunku wskazują różne jednostki; wybierz właściwą ręcznie.'};
  const systems=[];
  for(const text of texts){
    const match=text.match(/(?:układ\s+wsp[oó]łrz[eę]dnych|coordinate\s+(?:system|reference))[^.;\n]{0,65}?\bPL[\s-]*(2000|1992)(?:\s*[/:-]\s*([5-8]))?\b/i);
    if(match&&hasProjectedCoordinates(document,match[1],match[2]?Number(match[2]):null))systems.push(match[0].match(/PL[\s-]*(?:2000|1992)(?:\s*[/:-]\s*[5-8])?/i)[0]);
  }
  if(systems.length)return {unit:'m',method:'coordinate-system',detail:`Wykryto metry: ${systems[0]} w opisie i zgodne współrzędne modelu.`,coordinateSystem:systems[0]};
  return {unit:'unit',method:'unknown',detail:'Brak danych pozwalających ustalić jednostkę. Możesz ustawić ją ręcznie.'};
}
export const detectUnits=document=>detectDrawingUnits(document).unit;
