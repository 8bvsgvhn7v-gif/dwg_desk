import {pointOnPath,pathLength,objectColor} from '../shared/design-model.js';
export function symbolPoint(object,p){const angle=object.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);return {x:object.position.x+object.size*(c*p.x-s*p.y),y:object.position.y+object.size*(s*p.x+c*p.y)};}
export function drawSymbol(ctx,symbol,transform){
  for(const stroke of symbol.strokes){
    ctx.beginPath();
    if(stroke.type==='circle'){
      const p=transform(stroke.center),q=transform({x:stroke.center.x+stroke.radius,y:stroke.center.y});ctx.arc(p.x,p.y,Math.hypot(q.x-p.x,q.y-p.y),0,Math.PI*2);
    }else{stroke.points.forEach((p,i)=>{const q=transform(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});if(stroke.closed)ctx.closePath();}
    ctx.stroke();
  }
}
export function symbolHandles(object,screen,scale){
  const center=screen(object.position),angle=object.rotation*Math.PI/180;
  const radius=Math.max(64,Math.min(110,object.size*scale*1.5+24));
  return {center,rotate:{x:center.x+Math.cos(angle)*radius,y:center.y-Math.sin(angle)*radius}};
}
export function drawDesign(ctx,state,{screen,scale,selected,formatLength,light=false,draft=[],hover,flagTarget,tool,preview}){
  const hits=[];ctx.save();
  const layers=new Map(state.layers.map(l=>[l.id,l]));
  const shown=state.objects.filter(o=>layers.get(o.layerId)?.visible).map(o=>preview?.id===o.id?preview:o);
  const label=(text,p,color,objectId,flagId)=>{
    ctx.font='500 12px -apple-system,sans-serif';const width=Math.min(500,ctx.measureText(text).width+18),height=27;
    ctx.fillStyle=light?'#fcfdf9f2':'#19232af2';ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();ctx.roundRect(p.x,p.y-height/2,width,height,5);ctx.fill();ctx.stroke();ctx.fillStyle=light?'#182b31':'#edf6ef';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(text,p.x+9,p.y,width-18);
    hits.push({objectId,flagId,x:p.x,y:p.y-height/2,width,height});
  };
  for(const o of shown){
    if(o.kind!=='symbol'||o.symbol.kind!=='camera'||!o.showFov||!o.range)continue;
    const color=objectColor(o,layers.get(o.layerId)),start=(o.rotation-o.fov/2)*Math.PI/180;
    const center=screen(o.position);ctx.beginPath();ctx.moveTo(center.x,center.y);
    for(let i=0;i<=64;i++){const a=start+(o.fov*Math.PI/180)*i/64,p=screen({x:o.position.x+Math.cos(a)*o.range,y:o.position.y+Math.sin(a)*o.range});ctx.lineTo(p.x,p.y);}
    ctx.closePath();ctx.fillStyle=color+'16';ctx.fill();ctx.strokeStyle=color+'70';ctx.lineWidth=1;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
  }
  for(const o of shown){
    const color=objectColor(o,layers.get(o.layerId));ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=o.id===selected?3:1.8;ctx.setLineDash([]);
    if(o.kind==='cable'){
      ctx.beginPath();o.points.forEach((p,i)=>{const q=screen(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.stroke();
      for(const flag of o.flags){const a=screen(pointOnPath(o.points,flag.ratio)),b=screen(flag.position);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.arc(a.x,a.y,3,0,Math.PI*2);ctx.fill();label(`${o.name} · ${formatLength(pathLength(o.points))}`,b,color,o.id,flag.id);}
    }else if(o.kind==='symbol'){
      drawSymbol(ctx,o.symbol,p=>screen(symbolPoint(o,p)));
      const p=screen(o.position);ctx.font='11px -apple-system,sans-serif';ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(o.name,p.x,p.y-o.size*scale-8);
      const width=ctx.measureText(o.name).width;hits.push({objectId:o.id,x:p.x-width/2-4,y:p.y-o.size*scale-24,width:width+8,height:20});
    }else if(o.kind==='point'){
      const p=screen(o.position),r=Math.max(4,o.size*scale);ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.moveTo(p.x-r-4,p.y);ctx.lineTo(p.x+r+4,p.y);ctx.moveTo(p.x,p.y-r-4);ctx.lineTo(p.x,p.y+r+4);ctx.stroke();ctx.font='11px -apple-system,sans-serif';ctx.textAlign='left';ctx.fillText(o.name,p.x+r+7,p.y-7);
    }else if(o.kind==='text'){
      const p=screen(o.position),angle=-o.rotation*Math.PI/180,height=Math.max(10,Math.min(100,o.size*scale));ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.font=`${height}px -apple-system,sans-serif`;ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillText(o.name,0,0);
      const width=ctx.measureText(o.name).width,c=Math.cos(angle),s=Math.sin(angle),corners=[[0,0],[width,0],[width,-height],[0,-height]].map(([x,y])=>({x:p.x+c*x-s*y,y:p.y+s*x+c*y}));const minX=Math.min(...corners.map(p=>p.x)),minY=Math.min(...corners.map(p=>p.y));hits.push({objectId:o.id,x:minX,y:minY,width:Math.max(...corners.map(p=>p.x))-minX,height:Math.max(...corners.map(p=>p.y))-minY});ctx.restore();
    }
    if(o.id===selected){
      ctx.strokeStyle='#f1f7fd';ctx.fillStyle='#213e50';ctx.lineWidth=1;
      for(const p of o.kind==='cable'?o.points:[o.position]){const q=screen(p);ctx.fillRect(q.x-4,q.y-4,8,8);ctx.strokeRect(q.x-4,q.y-4,8,8);}
    }
  }
  // Draw selected-symbol controls last so other geometry cannot cover them.
  const active=shown.find(o=>o.id===selected);
  if(tool==='select'&&active?.kind==='symbol'&&!layers.get(active.layerId).locked){
    const {center,rotate}=symbolHandles(active,screen,scale),color=light?'#236947':'#a5ebbd';
    ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(rotate.x,rotate.y);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=light?'#fafffc':'#142a24';ctx.fillRect(center.x-6,center.y-6,12,12);ctx.strokeRect(center.x-6,center.y-6,12,12);
    ctx.beginPath();ctx.arc(rotate.x,rotate.y,9,0,Math.PI*2);ctx.fill();ctx.stroke();
    const a=-active.rotation*Math.PI/180;ctx.beginPath();ctx.moveTo(rotate.x+Math.cos(a)*4,rotate.y+Math.sin(a)*4);ctx.lineTo(rotate.x+Math.cos(a+2.5)*4,rotate.y+Math.sin(a+2.5)*4);ctx.lineTo(rotate.x+Math.cos(a-2.5)*4,rotate.y+Math.sin(a-2.5)*4);ctx.closePath();ctx.fillStyle=color;ctx.fill();
    ctx.font='11px -apple-system,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';const text=`${active.symbol.kind==='camera'?'Kierunek':'Obrót'} ${Math.round((active.rotation%360+360)%360)}°`,w=ctx.measureText(text).width;ctx.fillStyle=light?'#fffffff2':'#102019ee';ctx.fillRect(rotate.x+13,rotate.y-10,w+10,20);ctx.fillStyle=color;ctx.fillText(text,rotate.x+18,rotate.y);
    hits.push({objectId:active.id,handle:'move',x:center.x-11,y:center.y-11,width:22,height:22},{objectId:active.id,handle:'rotate',x:rotate.x-14,y:rotate.y-14,width:28,height:28});
  }
  if(draft.length){ctx.setLineDash([6,4]);ctx.lineWidth=2;ctx.strokeStyle='#ffbf69';ctx.beginPath();[...draft,...(hover?[hover]:[])].forEach((p,i)=>{const q=screen(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.stroke();ctx.setLineDash([]);for(const p of draft){const q=screen(p);ctx.fillStyle='#ffbf69';ctx.fillRect(q.x-3,q.y-3,6,6);}if(hover)label(formatLength(pathLength([...draft,hover])),{x:screen(hover).x+15,y:screen(hover).y-20},'#ffbf69');}
  if(tool==='flag'&&flagTarget&&hover){const cable=state.objects.find(o=>o.id===flagTarget);if(cable)label(`${cable.name} · ${formatLength(pathLength(cable.points))}`,screen(hover),objectColor(cable,layers.get(cable.layerId)));}
  ctx.restore();return hits;
}
