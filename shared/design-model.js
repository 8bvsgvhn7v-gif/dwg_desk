export const uid=()=>globalThis.crypto.randomUUID();
export const copy=value=>structuredClone(value);
export const objectColor=(object,layer)=>object.color||layer.color;
export const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
export function rotationToward(origin,target,previous=0,snap=false){
  if(distance(origin,target)<1e-10)return previous;
  let angle=Math.atan2(target.y-origin.y,target.x-origin.x)*180/Math.PI;
  if(snap)angle=Math.round(angle/15)*15;
  return (angle%360+360)%360;
}
export const pathLength=points=>points.slice(1).reduce((n,p,i)=>n+distance(points[i],p),0);
export function pointOnPath(points,ratio=.5){
  let remaining=pathLength(points)*Math.max(0,Math.min(1,ratio));
  for(let i=1;i<points.length;i++){const d=distance(points[i-1],points[i]);if(remaining<=d&&d)return {x:points[i-1].x+(points[i].x-points[i-1].x)*remaining/d,y:points[i-1].y+(points[i].y-points[i-1].y)*remaining/d};remaining-=d;}
  return {...points.at(-1)};
}
export function projectOnSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return {x:a.x+t*dx,y:a.y+t*dy,t};
}
export const cameraStrokes=()=>[
  {type:'path',points:[{x:-.7,y:-.4},{x:.35,y:-.4},{x:.35,y:.4},{x:-.7,y:.4}],closed:true},
  {type:'path',points:[{x:.35,y:-.22},{x:.85,y:-.45},{x:.85,y:.45},{x:.35,y:.22}],closed:true},
  {type:'path',points:[{x:-.4,y:-.4},{x:-.6,y:-.8},{x:-.95,y:-.8}],closed:false}
];
export const DEFAULT_LIBRARY={version:1,symbols:[
  {id:'camera-bullet',name:'Kamera tubowa',model:'Kamera IP',kind:'camera',fov:90,strokes:cameraStrokes()},
  {id:'camera-dome',name:'Kamera kopułkowa',model:'Kamera IP',kind:'camera',fov:110,strokes:[{type:'circle',center:{x:0,y:0},radius:.65},{type:'path',points:[{x:0,y:0},{x:.9,y:0}],closed:false}]},
  {id:'junction',name:'Puszka przyłączeniowa',model:'Punkt instalacyjny',kind:'symbol',fov:90,strokes:[{type:'path',points:[{x:-.6,y:-.6},{x:.6,y:-.6},{x:.6,y:.6},{x:-.6,y:.6}],closed:true},{type:'path',points:[{x:-.45,y:-.45},{x:.45,y:.45}],closed:false},{type:'path',points:[{x:-.45,y:.45},{x:.45,y:-.45}],closed:false}]}
],cables:[
  {id:'utp-cat6',name:'UTP kat. 6',description:'Skrętka miedziana',color:'#ffbf69'},
  {id:'fiber',name:'Światłowód',description:'Trasa światłowodowa',color:'#c6a0ff'},
  {id:'power',name:'Zasilanie',description:'Przewód zasilający',color:'#ff7f83'}
]};
export function newDesign(){return {version:1,layers:[{id:'cables',name:'Trasy kablowe',color:'#ffbf69',visible:true,locked:false},{id:'cameras',name:'Kamery',color:'#a5ebbd',visible:true,locked:false},{id:'points',name:'Punkty i opisy',color:'#80c7ff',visible:true,locked:false}],objects:[],settings:{drawingUnit:'auto',displayUnit:'m'}};}
const fail=()=>{throw new Error('Nieprawidłowe dane warstw lub biblioteki DWG Desk.');};
const finite=(v,min=-1e12,max=1e12)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const string=(s,max=200)=>typeof s==='string'&&s.length<=max;
const point=p=>p&&finite(p.x)&&finite(p.y);
const id=s=>string(s,100)&&/^[\w-]+$/.test(s);
const color=s=>typeof s==='string'&&/^#[\da-f]{6}$/i.test(s);
function validateSymbol(s){
  if(!s||!id(s.id)||!string(s.name)||!s.name.trim()||!string(s.model,1000)||!['camera','symbol'].includes(s.kind)||!finite(s.fov,1,360)||!Array.isArray(s.strokes)||!s.strokes.length||s.strokes.length>500)fail();
  if(s.color!==undefined&&!color(s.color))fail();
  for(const p of s.strokes){if(p.type==='circle'){if(!point(p.center)||!finite(p.radius,.001,100))fail();}else if(p.type==='path'){if(!Array.isArray(p.points)||p.points.length<2||p.points.length>1000||!p.points.every(point)||typeof p.closed!=='boolean')fail();}else fail();}
}
export function validateLibrary(library){
  if(!library||library.version!==1||!Array.isArray(library.symbols)||!Array.isArray(library.cables)||library.symbols.length>500||library.cables.length>500)fail();
  library.symbols.forEach(validateSymbol);
  for(const c of library.cables)if(!id(c.id)||!string(c.name)||!c.name.trim()||!string(c.description,1000)||!color(c.color))fail();
  for(const entries of [library.symbols,library.cables])if(new Set(entries.map(e=>e.id)).size!==entries.length)fail();
  return copy(library);
}
export function validateDesign(design){
  if(!design||design.version!==1||!Array.isArray(design.layers)||!design.layers.length||design.layers.length>200||!Array.isArray(design.objects)||design.objects.length>20000)fail();
  for(const l of design.layers)if(!id(l.id)||!string(l.name)||!l.name.trim()||!color(l.color)||typeof l.visible!=='boolean'||typeof l.locked!=='boolean')fail();
  const layers=new Set(design.layers.map(l=>l.id));if(layers.size!==design.layers.length)fail();
  const ids=new Set();let count=0;
  for(const o of design.objects){
    if(!id(o.id)||ids.has(o.id)||!layers.has(o.layerId)||!string(o.name)||!string(o.description||'',1000))fail();ids.add(o.id);
    if(o.color!==undefined&&!color(o.color))fail();
    if(o.kind==='cable'){
      if(!Array.isArray(o.points)||o.points.length<2||o.points.length>10000||!o.points.every(point)||!Array.isArray(o.flags)||o.flags.length>100||!string(o.cableType))fail();
      count+=o.points.length;
      for(const f of o.flags)if(!id(f.id)||!finite(f.ratio,0,1)||!point(f.position))fail();
    }else if(['symbol','point','text'].includes(o.kind)){
      if(!point(o.position)||!finite(o.size,.000001,1e9)||!finite(o.rotation,-36000,36000))fail();
      if(o.kind==='symbol'){validateSymbol(o.symbol);if(!finite(o.fov,1,360)||!finite(o.range,0,1e9)||typeof o.showFov!=='boolean')fail();}
    }else fail();
  }
  if(count>500000)fail();
  const units=['auto','unit','mm','cm','dm','m','km','in','ft','yd','mi'];
  if(!design.settings||!units.includes(design.settings.drawingUnit)||!units.slice(1).includes(design.settings.displayUnit))fail();
  if(design.settings.cadTextHeight!==undefined&&(!Number.isFinite(design.settings.cadTextHeight)||design.settings.cadTextHeight<1e-8||design.settings.cadTextHeight>1e9))fail();
  if(design.settings.cadCameraDetails!==undefined&&typeof design.settings.cadCameraDetails!=='boolean')fail();
  return copy(design);
}
export function translateObject(object,dx,dy){
  const move=p=>({x:p.x+dx,y:p.y+dy});
  if(object.kind==='cable'){object.points=object.points.map(move);object.flags.forEach(f=>f.position=move(f.position));}
  else object.position=move(object.position);
}
export class DesignHistory {
  constructor(state=newDesign()){this.state=state;this.undoStack=[];this.redoStack=[];}
  commit(before){if(JSON.stringify(before)===JSON.stringify(this.state))return false;this.undoStack.push(before);if(this.undoStack.length>50)this.undoStack.shift();this.redoStack=[];return true;}
  change(fn){const before=copy(this.state);fn(this.state);return this.commit(before);}
  undo(){if(!this.undoStack.length)return false;this.redoStack.push(copy(this.state));this.state=this.undoStack.pop();return true;}
  redo(){if(!this.redoStack.length)return false;this.undoStack.push(copy(this.state));this.state=this.redoStack.pop();return true;}
}
