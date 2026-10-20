import {validateDesign,pathLength,pointOnPath,objectColor} from './design-model.js';
const unitCodes={unit:0,in:1,ft:2,mi:3,mm:4,cm:5,m:6,km:7,yd:10,dm:14};
const meters={mm:.001,cm:.01,dm:.1,m:1,km:1000,in:.0254,ft:.3048,yd:.9144,mi:1609.344};
export const CAD_LINE_WEIGHTS=[18,25,35,50,70];
// Preserve hue while lowering lightness until thin strokes contrast with white.
export function cadExportColor(color,mode='original'){
  if(mode==='original')return color;
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255),lightness=(Math.max(...rgb)+Math.min(...rgb))/2,span=Math.min(lightness,1-lightness);
  const shade=l=>rgb.map(c=>Math.round(255*(l+(span?(c-lightness)/span:0)*Math.min(l,1-l))));
  const luminance=rgb=>rgb.reduce((s,v,i)=>{const c=v/255;return s+[.2126,.7152,.0722][i]*(c<=.04045?c/12.92:((c+.055)/1.055)**2.4);},0);
  let low=0,high=lightness;
  if(luminance(shade(high))<=(1.05/4.5-.05))return color;
  for(let i=0;i<24;i++){const mid=(low+high)/2;if(luminance(shade(mid))<=(1.05/4.5-.05))low=mid;else high=mid;}
  return '#'+shade(low).map(c=>c.toString(16).padStart(2,'0')).join('');
}
export const suggestCadCableWidth=height=>Number(Math.min(1e9,height*.25).toPrecision(6));
// Text is measured in drawing units, never in pixels or current viewport zoom.
export function suggestCadTextHeight(design,unit='unit'){
  const sizes=design.objects.filter(o=>['symbol','point'].includes(o.kind)&&Number.isFinite(o.size)&&o.size>0).map(o=>o.size).sort((a,b)=>a-b);
  const size=sizes.length?sizes[Math.floor(sizes.length/2)]*.5:(meters[unit] ? 0.25/meters[unit] : 1);
  return Math.max(1e-8,Math.min(1e9,Number(size.toPrecision(6))));
}
export function parseDxf(text){
  if(typeof text!=='string'||text.length>256*1024*1024||text.startsWith('AutoCAD Binary DXF'))throw new Error('Eksport wymaga tekstowego pliku DXF.');
  const lines=text.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/);if(lines.at(-1)==='')lines.pop();
  if(lines.length%2)throw new Error('Niepełna para kodów DXF.');
  const pairs=[];for(let i=0;i<lines.length;i+=2){const code=Number(lines[i].trim());if(!/^\d+$/.test(lines[i].trim())||!Number.isInteger(code)||code>1071)throw new Error('Nieprawidłowy kod DXF.');pairs.push([code,lines[i+1]]);}
  if(!pairs.some(([c,v])=>c===0&&v.trim()==='EOF'))throw new Error('Niekompletny plik DXF.');return pairs;
}
export const encodeDxf=pairs=>pairs.map(([c,v])=>`${c}\n${v}`).join('\n')+'\n';
export function section(pairs,name){const start=pairs.findIndex(([c,v],i)=>c===0&&v.trim()==='SECTION'&&pairs[i+1]?.[1].trim()===name);if(start<0)throw new Error(`Brak sekcji ${name} w DXF.`);const end=pairs.findIndex(([c,v],i)=>i>start&&c===0&&v.trim()==='ENDSEC');if(end<0)throw new Error('Niepełna sekcja DXF.');return {start,end};}
export function records(pairs){const result=[];let current;for(const pair of pairs){if(pair[0]===0){current=[];result.push(current);}current?.push(pair);}return result;}
const value=(record,code)=>record.find(p=>p[0]===code)?.[1]?.trim();
const unicode=s=>Array.from(new TextEncoder().encode(String(s).replace(/[\r\n\x00-\x1f]/g,' ')),b=>String.fromCharCode(b)).join('');
export function worldTransform(matrix){
  const m=matrix||{a:1,b:0,c:0,d:1,e:0,f:0};if(!['a','b','c','d','e','f'].every(k=>Number.isFinite(m[k])))throw new Error('Nieprawidłowy układ współrzędnych.');
  const det=m.a*m.d-m.b*m.c;if(Math.abs(Math.abs(det)-1)>1e-5||Math.abs(m.a*m.c+m.b*m.d)>1e-5)throw new Error('Nieobsługiwane przekształcenie widoku CAD.');
  return p=>({x:(m.d*(p.x-m.e)-m.c*(p.y-m.f))/det,y:(-m.b*(p.x-m.e)+m.a*(p.y-m.f))/det});
}
function aci(color){
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));let best=7,min=Infinity;
  const test=(index,c)=>{const d=c.reduce((s,v,i)=>s+(v-rgb[i])**2,0);if(d<min){min=d;best=index;}};
  [[255,0,0],[255,255,0],[0,255,0],[0,255,255],[0,0,255],[255,0,255],[255,255,255],[128,128,128],[192,192,192]].forEach((c,i)=>test(i+1,c));
  for(let h=0;h<24;h++)for(let j=0;j<10;j++){const v=[255,165,127,76,38][Math.floor(j/2)],s=j%2?.5:1,c=v*s,x=c*(1-Math.abs((h/4)%2-1)),m=v-c;const a=h/4;const channels=a<1?[c,x,0]:a<2?[x,c,0]:a<3?[0,c,x]:a<4?[0,x,c]:a<5?[x,0,c]:[c,0,x];test(10+h*10+j,channels.map(n=>Math.round(n+m)));}return best;
}
export function mergeDesignDxf(base,design,options={}){
  design=validateDesign(design);let pairs=parseDxf(base);const toWorld=worldTransform(options.sceneTransform),height=options.textHeight??suggestCadTextHeight(design,options.unit);
  if(!Number.isFinite(height)||height<1e-8||height>1e9)throw new Error('Nieprawidłowy rozmiar opisów.');
  const colorMode=options.colorMode??'original',lineWeight=options.lineWeight??35,cableWidth=options.cableWidth??0;
  if(!['original','white'].includes(colorMode)||!CAD_LINE_WEIGHTS.includes(lineWeight)||!Number.isFinite(cableWidth)||cableWidth<0||cableWidth>1e9)throw new Error('Nieprawidłowy wygląd linii eksportu.');
  const unit=options.unit||'unit',display=options.displayUnit||unit;if(!(unit in unitCodes)||!(display in unitCodes))throw new Error('Nieprawidłowa jednostka eksportu.');
  let handle=1n;for(const [c,v]of pairs)if((c===5||c===105)&&/^[0-9a-f]+$/i.test(v.trim())){const n=BigInt('0x'+v.trim());if(n>=handle)handle=n+1n;}
  const next=()=> (handle++).toString(16).toUpperCase();
  function table(name){const ts=section(pairs,'TABLES');const start=pairs.findIndex(([c,v],i)=>i>ts.start&&i<ts.end&&c===0&&v.trim()==='TABLE'&&pairs[i+1]?.[1].trim()===name);if(start<0)throw new Error(`Brak tabeli ${name} w podkładzie.`);const end=pairs.findIndex(([c,v],i)=>i>start&&c===0&&v.trim()==='ENDTAB');return {start,end};}
  const block=table('BLOCK_RECORD'),model=records(pairs.slice(block.start,block.end)).find(r=>value(r,0)==='BLOCK_RECORD'&&value(r,2)?.toUpperCase()==='*MODEL_SPACE');
  const owner=model&&value(model,5);if(!owner)throw new Error('Brak przestrzeni modelu w podkładzie.');
  const lt=table('LAYER'),layerRecords=records(pairs.slice(lt.start,lt.end)),layerOwner=value(layerRecords[0],5),names=new Set(layerRecords.map(r=>value(r,2)?.toLowerCase())),layerNames=new Map(),newLayers=[];
  for(const l of design.layers){const color=cadExportColor(l.color,colorMode);let stem='DWGDesk_'+l.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/Ł/g,'L').replace(/[^a-zA-Z0-9 _-]/g,'_').slice(0,90),name=stem,n=2;while(names.has(name.toLowerCase()))name=stem+'_'+n++;names.add(name.toLowerCase());layerNames.set(l.id,name);newLayers.push([0,'LAYER'],[5,next()],[330,layerOwner],[100,'AcDbSymbolTableRecord'],[100,'AcDbLayerTableRecord'],[2,name],[70,l.locked?4:0],[62,(l.visible?1:-1)*aci(color)],[420,parseInt(color.slice(1),16)],[6,'CONTINUOUS'],[370,lineWeight]);}
  const layerCount=pairs.findIndex(([c],i)=>i>lt.start&&i<lt.end&&c===70);if(layerCount>=0)pairs[layerCount][1]=String(layerRecords.filter(r=>value(r,0)==='LAYER').length+design.layers.length);pairs.splice(lt.end,0,...newLayers);
  const baseSection=section(pairs,'ENTITIES'),entities=[],expected={},bounds=[];for(const r of records(pairs.slice(baseSection.start+2,baseSection.end))){const l=value(r,8);if(l)expected[l]=(expected[l]||0)+1;}let currentLayer,currentColor;
  function entity(kind,subclass,data,weight=lineWeight){entities.push([0,kind],[5,next()],[330,owner],[100,'AcDbEntity'],[8,currentLayer],[62,aci(currentColor)],[420,parseInt(currentColor.slice(1),16)],[370,['TEXT','MTEXT'].includes(kind)?Math.min(weight,25):weight],[100,subclass],...data);expected[currentLayer]=(expected[currentLayer]||0)+1;}
  const coord=(p,code=10)=>{const w=toWorld(p);bounds.push(w);return [[code,w.x],[code+10,w.y],[code+20,0]];};
  const line=(a,b)=>entity('LINE','AcDbLine',[...coord(a),...coord(b,11)]);
  const poly=(points,closed=false,width=0,weight=lineWeight)=>entity('LWPOLYLINE','AcDbPolyline',[[90,points.length],[70,closed?1:0],[43,width],...points.flatMap(p=>{const w=toWorld(p);bounds.push(w);return [[10,w.x],[20,w.y]];})],weight);
  const circle=(p,r)=>{const w=toWorld(p);bounds.push({x:w.x-r,y:w.y-r},{x:w.x+r,y:w.y+r});entity('CIRCLE','AcDbCircle',[...coord(p),[40,r]]);};
  const text=(p,s,size=height,rotation=0)=>{const a=rotation*Math.PI/180,zero=toWorld({x:0,y:0}),v=toWorld({x:Math.cos(a),y:Math.sin(a)}),angle=Math.atan2(v.y-zero.y,v.x-zero.x)*180/Math.PI;entity('TEXT','AcDbText',[...coord(p),[40,size],[1,unicode(s)],[50,angle],[7,'STANDARD'],[100,'AcDbText']]);};
  const mtext=(p,s,size=height)=>{const encoded=unicode(s.replace(/[\\{}]/g,'\\$&')),chunks=encoded.match(/.{1,250}/g)||[''],zero=toWorld({x:0,y:0}),dir=toWorld({x:1,y:0});entity('MTEXT','AcDbMText',[...coord(p),[40,size],[41,size*30],[71,1],[7,'STANDARD'],[11,dir.x-zero.x],[21,dir.y-zero.y],[31,0],...chunks.slice(0,-1).map(c=>[3,c]),[1,chunks.at(-1)]]);};
  const length=n=>`${new Intl.NumberFormat('pl-PL',{maximumFractionDigits:3}).format(meters[unit]&&meters[display]?n*meters[unit]/meters[display]:n)} ${unit==='unit'?'j. rys.':display}`;
  for(const o of design.objects){const layer=design.layers.find(l=>l.id===o.layerId);currentLayer=layerNames.get(o.layerId);currentColor=cadExportColor(objectColor(o,layer),colorMode);
    if(o.kind==='cable'){poly(o.points,false,cableWidth);for(const flag of o.flags){line(pointOnPath(o.points,flag.ratio),flag.position);text(flag.position,`${o.name} · ${length(pathLength(o.points))}`);}}
    else if(o.kind==='symbol'){
      const a=o.rotation*Math.PI/180,transform=p=>({x:o.position.x+o.size*(Math.cos(a)*p.x-Math.sin(a)*p.y),y:o.position.y+o.size*(Math.sin(a)*p.x+Math.cos(a)*p.y)});
      for(const s of o.symbol.strokes){if(s.type==='circle')circle(transform(s.center),s.radius*o.size);else poly(s.points.map(transform),s.closed,Math.min(cableWidth/2,o.size*.1));}
      text({x:o.position.x,y:o.position.y+o.size+height},o.name);
      const info=[o.description,o.symbol.kind==='camera'?`${o.fov}° · ${length(o.range)}`:''].filter(Boolean).join(' · ');if(info&&options.includeCameraDetails===true)mtext({x:o.position.x,y:o.position.y+o.size+2.5*height},info,height*.8);
      if(o.symbol.kind==='camera'&&o.showFov&&o.range){const sector=[o.position];for(let i=0;i<=64;i++){const a=(o.rotation-o.fov/2+o.fov*i/64)*Math.PI/180;sector.push({x:o.position.x+Math.cos(a)*o.range,y:o.position.y+Math.sin(a)*o.range});}poly(sector,true,0,18);}
    }else if(o.kind==='point'){circle(o.position,o.size);line({x:o.position.x-o.size*1.5,y:o.position.y},{x:o.position.x+o.size*1.5,y:o.position.y});line({x:o.position.x,y:o.position.y-o.size*1.5},{x:o.position.x,y:o.position.y+o.size*1.5});text({x:o.position.x+o.size*2,y:o.position.y+height},o.name);}
    else if(o.kind==='text')text(o.position,o.name,o.size,o.rotation);
  }
  const es=section(pairs,'ENTITIES');pairs=[...pairs.slice(0,es.end),...entities,...pairs.slice(es.end)];
  const header=(name,values)=>{const h=section(pairs,'HEADER'),i=pairs.findIndex(([c,v],j)=>j>h.start&&j<h.end&&c===9&&v.trim()===name);if(i<0)pairs.splice(h.end,0,[9,name],...values);else{let end=i+1;while(end<h.end&&pairs[end][0]!==9)end++;pairs.splice(i+1,end-i-1,...values);}};
  header('$ACADVER',[[1,'AC1032']]);header('$INSUNITS',[[70,unitCodes[unit]]]);header('$HANDSEED',[[5,next()]]);header('$LWDISPLAY',[[290,1]]);
  for(const [name,fn]of [['$EXTMIN',Math.min],['$EXTMAX',Math.max]]){const h=section(pairs,'HEADER'),i=pairs.findIndex(([c,v],j)=>j>h.start&&j<h.end&&c===9&&v===name);if(bounds.length){const old=i<0?[]:pairs.slice(i+1,i+4);const xs=bounds.map(p=>p.x),ys=bounds.map(p=>p.y);const ox=Number(old.find(p=>p[0]===10)?.[1]),oy=Number(old.find(p=>p[0]===20)?.[1]);const reduce=(a,b)=>fn(a,b);header(name,[[10,xs.reduce(reduce,Number.isFinite(ox)?ox:xs[0])],[20,ys.reduce(reduce,Number.isFinite(oy)?oy:ys[0])],[30,0]]);}}
  return {text:encodeDxf(pairs),expected,layerNames:Object.fromEntries(layerNames),objectCount:design.objects.length};
}
export function verifyExportLayers(text,expected){const pairs=parseDxf(text),s=section(pairs,'ENTITIES'),counts={};for(const r of records(pairs.slice(s.start+2,s.end))){const layer=value(r,8);if(layer in expected)counts[layer]=(counts[layer]||0)+1;}for(const [layer,count]of Object.entries(expected))if(counts[layer]!==count)throw new Error(`Weryfikacja eksportu nie powiodła się dla warstwy ${layer}: ${counts[layer]||0}/${count} obiektów.`);return counts;}
