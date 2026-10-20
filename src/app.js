import { CadViewer, colorFromAci } from '@flyfish-dev/cad-viewer';
import { UNITS, measure, measurePath, convert, collectSnapPoints, buildSnapIndex, measurementsCSV } from './geometry.js';
import { restoreDxfLayers } from './layers.js';
import { detectDrawingUnits } from './units.js';
import { MeasurementSession } from './measurement-session.js';
import { bindPanGesture } from './pan-gesture.js';
import { dxfForViewer } from './dxf-encoding.js';
import { Designer } from './designer.js';
import { suggestCadTextHeight } from '../shared/cad-export.js';
import './style.css';

const $ = id => document.getElementById(id);
const icons = {
  folder: '<path d="M3 7V5h6l2 2h10v12H3z"/><path d="M3 10h18"/>',
  hand: '<path d="M7 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v7c0 5-3 7-6 7s-5-2-6-4l-3-5c-1-2 1-3 2-2l3 3"/>',
  ruler: '<path d="M3 15L15 3l6 6L9 21zM12 6l3 3M8 10l3 3M5 13l3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  fit: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  file: '<path d="M14 3H5v18h14V8zM14 3v5h5"/><path d="M8 13h8m-8 4h5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>'
};
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[el.dataset.icon]}</svg>`; });

let source, sourceBytes, designer, fileName = '', mode = 'pan', pointer = null, snapped = null, exportBusy=false;
const session = new MeasurementSession(), measurements = session.paths;
let unitDetection = detectDrawingUnits();
let snapQuery = () => null, controller, generation = 0, light = false, pointCount = 0;
let drawingUnit = 'unit', displayUnit = 'mm', busy = false, lastStats;
const viewport = $('viewport'), overlay = $('annotations'), ctx = overlay.getContext('2d');
const viewer = new CadViewer({
  container: $('viewer'), renderer: 'auto', useWorker: true, workerTimeoutMs: 120000, includePaperSpace: false,
  wasmPath: new URL('wasm/', document.baseURI).href, workerUrl: new URL('wasm/dwg-worker.js', document.baseURI).href,
  canvasOptions: { background: '#10151b', foreground: '#e5ecef', showPageBounds: false, showImagePlaceholders: true, showUnsupportedMarkers: false, maxInsertDepth: 16, maxCurveSegments: 128, minScale: 1e-10, maxScale: 1e10 },
  onLoadProgress: event => {
    $('progress').value = event.percent || 0;
    const labels = { read: 'Odczyt pliku…', detect: 'Rozpoznawanie formatu…', 'worker-start': 'Uruchamianie silnika DWG…', 'worker-ready': 'Silnik gotowy…', 'wasm-init': 'Przygotowanie odczytu DWG…', parse: 'Odczyt geometrii…', normalize: 'Przygotowanie rysunku…', render: 'Rysowanie…', done: 'Gotowe' };
    $('progress-label').textContent = labels[event.phase] || 'Przetwarzanie rysunku…';
  },
  onViewChange: event => { $('zoom').textContent = `${Math.round(event.zoomPercent)}%`; drawOverlay(); },
  onRenderStats: stats => { lastStats = stats; }
});
const format = (number, digits = 3) => new Intl.NumberFormat('pl-PL', { maximumFractionDigits: digits }).format(number);
const unitLabel = () => drawingUnit === 'unit' ? 'j. rys.' : UNITS[displayUnit].label;
const valueLabel = value => `${format(convert(value, drawingUnit, displayUnit))} ${unitLabel()}`;
function notice(message) { $('notice-text').textContent = message; $('notice').hidden = !message; }
function status(message) { $('status').textContent = message; }
function controls(enabled) { for (const id of ['measure','start-measure','design','export-cad','fit','zoom-in','zoom-out']) $(id).disabled = !enabled; }

function rebuildSnaps() {
  const { points, truncated } = collectSnapPoints(viewer.getDocument());
  pointCount = points.length; snapQuery = buildSnapIndex(points);
  if (truncated) notice('Rysunek ma bardzo dużo geometrii. Przyciąganie obejmuje pierwsze 400 000 punktów; do pozostałych punktów można mierzyć ręcznie.');
}
function updateUnits() {
  const selection=$('drawing-unit').value;
  drawingUnit=selection==='auto'?unitDetection.unit:selection;
  displayUnit=$('display-unit').value;
  $('display-unit').disabled=drawingUnit==='unit';
  $('unit-note').textContent=selection==='auto'?unitDetection.detail:'Jednostka ustawiona ręcznie dla tego rysunku.';
  const auto=$('drawing-unit').querySelector('[value="auto"]');
  auto.textContent=unitDetection.unit==='unit'?'Automatycznie — brak danych':`Auto: ${UNITS[unitDetection.unit].name} (${UNITS[unitDetection.unit].label})`;
  $('unit-summary').textContent=drawingUnit==='unit'?'nieokreślone':`${UNITS[drawingUnit].name.toLowerCase()} (${UNITS[drawingUnit].label})`;
  $('unit-summary-source').textContent=selection!=='auto'?'Ustawiono ręcznie':unitDetection.method==='coordinate-system'?`Auto · ${unitDetection.coordinateSystem}`:unitDetection.unit==='unit'?'Brak danych w pliku':'Wykryto automatycznie';
  renderMeasurements(); designer?.renderProperties(); drawOverlay();
}
function renderLayers() {
  $('layer-count').textContent = Object.keys(source?.layers || {}).length;
  $('layers').replaceChildren();
  const filter = $('layer-search').value.toLocaleLowerCase('pl');
  for (const [key, layer] of Object.entries(source?.layers || {}).sort(([a],[b]) => a.localeCompare(b))) {
    if (!key.toLocaleLowerCase('pl').includes(filter)) continue;
    const label = document.createElement('label'); label.className = 'layer'; label.title = key;
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = layer.isVisible !== false && !layer.isFrozen; input.setAttribute('aria-label', `Warstwa ${key}`);
    const swatch = document.createElement('span'); swatch.className = 'layer-swatch';
    try { swatch.style.backgroundColor = colorFromAci(layer.colorIndex || 7) || '#a5ebbd'; } catch {}
    const text = document.createElement('span'); text.textContent = key;
    input.addEventListener('change', () => {
      const view = viewer.renderer.getViewState(); layer.isVisible = input.checked; layer.isFrozen = false;
      viewer.setDocument(source, fileName); viewer.renderer.setViewState(view); rebuildSnaps(); snapped = null; drawOverlay();
    });
    label.append(input, swatch, text); $('layers').append(label);
  }
}
function resetDocument() {
  designer?.reset();
  document.body.classList.remove('has-drawing');
  source = undefined; sourceBytes=undefined; fileName = ''; session.clear(); pointer = null; snapped = null; unitDetection=detectDrawingUnits();
  pointCount = 0; snapQuery = () => null; viewer.clear(); setMode('pan'); controls(false);
  $('filename').textContent = 'Brak otwartego pliku'; $('filemeta').textContent = 'DWG / DXF';
  $('empty').hidden = false; $('drawing-label').hidden = true; $('tool-hint').hidden = true;
  $('layer-search').value = ''; renderLayers(); renderMeasurements(); drawOverlay();
  $('drawing-unit').value = 'auto'; $('display-unit').value = 'mm'; updateUnits();
  $('coordinates').textContent = 'X —   Y —'; document.title = 'DWG Desk';
}
async function openDrawing(fileOrData) {
  const name = fileOrData.name, size = fileOrData.size ?? fileOrData.bytes?.byteLength ?? 0;
  if (!/\.(dwg|dxf)$/i.test(name)) { notice('Wybierz rysunek w formacie DWG lub DXF.'); return; }
  if (!size || size > 150 * 1024 * 1024) { notice('Rysunek jest pusty albo przekracza limit 150 MB.'); return; }
  try{await designer.flush(true);}catch(error){notice(`Nie można zmienić rysunku: zapis warstw nie powiódł się. ${error.message}`);return;}
  const token = ++generation; controller?.abort(); controller = new AbortController();
  resetDocument(); notice(''); busy = true; $('loading').hidden = false; $('progress').value = 0;
  status('Otwieranie rysunku…');
  try {
    const bytes=fileOrData instanceof File?new Uint8Array(await fileOrData.arrayBuffer()):new Uint8Array(fileOrData.bytes);
    const key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    const result=await viewer.loadBuffer(dxfForViewer(bytes,name),name,{signal:controller.signal});
    if (token !== generation) return;
    source = restoreDxfLayers(result.document, result.raw); sourceBytes=bytes;fileName = name;
    viewer.setDocument(source, name);
    if (!source.entities.length) throw new Error('Nie znaleziono geometrii modelu 2D, którą można wyświetlić.');
    $('filename').textContent = name; $('filename').title = name; document.title = `${name} — DWG Desk`;
    $('filemeta').textContent = `${result.format.toUpperCase()} · ${format(size / 1024, 0)} KB · ${format(source.entities.length,0)} obiektów`;
    document.body.classList.add('has-drawing');
    $('empty').hidden = true; $('drawing-label').hidden = false; $('tool-hint').hidden = false;
    viewer.renderer.fitToView(0.86,'auto');
    unitDetection=detectDrawingUnits(source);
    $('drawing-unit').value='auto'; $('display-unit').value=unitDetection.unit==='unit'?'mm':unitDetection.unit;
    const savedSettings=await designer.load(key,{drawingUnit:'auto',displayUnit:$('display-unit').value});
    if(token!==generation)return;
    if(savedSettings){$('drawing-unit').value=savedSettings.drawingUnit;$('display-unit').value=savedSettings.displayUnit;}
    updateUnits(); renderLayers(); rebuildSnaps(); controls(true); setMode('pan');
    status(`${result.format.toUpperCase()} · ${format(source.entities.length,0)} obiektów`);
    const warnings = [...new Set(result.warnings || [])];
    if (lastStats?.skipped) warnings.unshift(`Niewyświetlone obiekty: ${lastStats.skipped}.`);
    if (warnings.length) notice(`Rysunek otwarto z uwagami (${warnings.length}). Niektóre elementy mogą być uproszczone lub pominięte.\n` + warnings.slice(0,4).join('\n'));
  } catch (error) {
    if (token !== generation) return;
    resetDocument();
    if (controller.signal.aborted) status('Otwieranie anulowane');
    else { status('Nie udało się otworzyć pliku'); notice(`Nie udało się odczytać rysunku. ${error.message || 'Plik może być uszkodzony lub zawierać nieobsługiwane obiekty.'}`); }
  } finally {
    if (token === generation) { busy = false; $('loading').hidden = true; }
  }
}
async function chooseFile() {
  try { if (window.desktop) { const data = await window.desktop.open(); if (data) await openDrawing(data); } else $('file-input').click(); }
  catch (error) { notice(error.message); }
}
function updateHint(){
  $('tool-hint').textContent=mode!=='measure'?'Przeciągnij, aby przesunąć · przewijaj, aby przybliżyć':session.active?'Lewy: kolejny punkt · prawy / Enter: zakończ · ⌫: cofnij punkt':'Lewy: pierwszy punkt · prawy: zakończ · środkowy: przesuwaj';
}
function finishMeasurement(){
  const finished=session.finish();
  if(finished)status(`Pomiar zakończony · suma ${valueLabel(measurePath(finished.points).total)}`);
  snapped=null; updateHint(); renderMeasurements(); drawOverlay();
}
function setMode(next) {
  if (next !== 'pan' && !source) return;
  panGesture.cancel();
  session.finish(); mode=next; snapped=null;
  $('pan').classList.toggle('active', mode === 'pan'); $('measure').classList.toggle('active', mode === 'measure');
  $('pan').setAttribute('aria-pressed', mode === 'pan'); $('measure').setAttribute('aria-pressed', mode === 'measure');
  viewport.classList.toggle('measuring', mode === 'measure');
  viewport.classList.toggle('drawing', ['cable','symbol','point','text','flag'].includes(mode));
  updateHint(); renderMeasurements(); drawOverlay();
  designer?.setMode(next);
}
function renderMeasurements() {
  const grandTotal=measurements.reduce((total,item)=>total+measurePath(item.points).total,0);
  const segmentCount=measurements.reduce((count,item)=>count+Math.max(0,item.points.length-1),0);
  $('measurement-count').textContent = measurements.length;
  $('clear').disabled=!measurements.length; $('export').disabled=!segmentCount;
  $('finish-measure').disabled=!session.active||session.active.points.length<2;
  $('undo-point').disabled=!session.active;
  $('path-controls').hidden=!session.active;
  $('total-panel').hidden=!measurements.length;
  $('grand-total').textContent=valueLabel(grandTotal);
  $('total-detail').textContent=`${segmentCount} odc. · ${measurements.length} pom.`;
  $('measurements').replaceChildren();
  if (!measurements.length) { const p = document.createElement('p'); p.className = 'muted empty-measurements'; p.textContent = 'Klikaj kolejne punkty. Pokażemy sumę całej trasy.'; $('measurements').append(p); }
  measurements.forEach((item,index)=>{
    const result=measurePath(item.points),card=document.createElement('div');card.className='measurement'+(item===session.active?' in-progress':'');
    const title=document.createElement('span');title.className='measurement-title';title.textContent=`POMIAR ${String(index+1).padStart(2,'0')} · ${item.complete?'ZAKOŃCZONY':'W TRAKCIE'}`;
    const distance=document.createElement('strong');distance.className='distance';distance.textContent=valueLabel(result.total);
    const details=document.createElement('div');details.className='details';details.textContent=result.segments.length?`Liczba odcinków: ${result.segments.length}`:'Wskaż kolejny punkt';
    const list=document.createElement('ol');list.className='segment-list';
    for(const [i,segment] of result.segments.entries()){
      const row=document.createElement('li'),label=document.createElement('span'),value=document.createElement('strong');
      label.textContent=`${i+1}. odcinek`;value.textContent=valueLabel(segment.distance);row.title=`ΔX ${valueLabel(segment.dx)} · ΔY ${valueLabel(segment.dy)}`;row.append(label,value);list.append(row);
    }
    const remove=document.createElement('button');remove.className='delete';remove.textContent='×';remove.title=`Usuń pomiar ${index+1}`;remove.setAttribute('aria-label',remove.title);
    remove.addEventListener('click',()=>{session.remove(index);updateHint();renderMeasurements();drawOverlay();});
    card.append(title,distance,details,list,remove);$('measurements').prepend(card);
  });
  updatePreviewTotal();
}
function updatePreviewTotal(){
  const label=$('preview-total');
  label.hidden=!session.active||!pointer;
  if(!label.hidden){const total=measurePath(session.active.points).total+measure(session.active.points.at(-1),pointer).distance;label.textContent=`Po dodaniu punktu: ${valueLabel(total)}`;}
}
function drawOverlay() {
  if (!ctx) return;
  const width = viewport.clientWidth, height = viewport.clientHeight, dpr = window.devicePixelRatio || 1;
  if (overlay.width !== Math.round(width*dpr) || overlay.height !== Math.round(height*dpr)) { overlay.width = Math.round(width*dpr); overlay.height = Math.round(height*dpr); }
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
  if (!source) return;
  const screen = p => viewer.renderer.worldToScreen(p);
  designer?.draw(ctx,{screen,light});
  const placed=[];
  function label(text,x,y,primary=false){
    if(x<0||y<0||x>width||y>height)return;
    ctx.font=`${primary?'600':'500'} ${primary?13:11}px -apple-system, sans-serif`;
    const w=ctx.measureText(text).width+18;
    for(const dy of [-18,20,-46,48]){
      const left=Math.max(5,Math.min(width-w-5,x-w/2)),top=Math.max(5,Math.min(height-30,y+dy-12));
      const box={left,top,right:left+w,bottom:top+25};
      if(placed.some(p=>box.left<p.right+4&&box.right>p.left-4&&box.top<p.bottom+4&&box.bottom>p.top-4))continue;
      placed.push(box);ctx.fillStyle=primary?'#2b5140':'#21362f';ctx.beginPath();ctx.roundRect(left,top,w,25,5);ctx.fill();ctx.fillStyle='#c2f6d2';ctx.textAlign='center';ctx.fillText(text,left+w/2,top+17);return;
    }
  }
  function segment(a,b,preview,text){
    const p=screen(a),q=screen(b);ctx.strokeStyle=light?'#007c55':'#a5ebbd';ctx.lineWidth=1.5;
    ctx.setLineDash(preview?[5,5]:[]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.setLineDash([]);
    for(const v of [p,q]){ctx.fillStyle=light?'#007c55':'#a5ebbd';ctx.beginPath();ctx.arc(v.x,v.y,3.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(v.x,v.y,6.5,0,Math.PI*2);ctx.stroke();}
    if(Math.hypot(p.x-q.x,p.y-q.y)>80)label(text,(p.x+q.x)/2,(p.y+q.y)/2);
  }
  // Place total labels first. Short segments remain listed in the side panel.
  measurements.forEach((item,i)=>{if(item.points.length<2)return;const end=screen(item.points.at(-1));label(`${i+1} · Σ ${valueLabel(measurePath(item.points).total)}`,end.x,end.y,true);});
  measurements.forEach((item,i)=>measurePath(item.points).segments.forEach((part,j)=>segment(part.a,part.b,false,`${i+1}.${j+1} · ${valueLabel(part.distance)}`)));
  if(session.active&&pointer)segment(session.active.points.at(-1),pointer,true,`+ ${valueLabel(measure(session.active.points.at(-1),pointer).distance)}`);
  if (snapped && mode === 'measure') {
    const p = screen(snapped); ctx.strokeStyle = light ? '#007c55' : '#a5ebbd'; ctx.lineWidth = 1.5; ctx.strokeRect(p.x-6,p.y-6,12,12);
    ctx.font = '10px -apple-system, sans-serif'; ctx.fillStyle = light ? '#005b43' : '#b9eec9'; ctx.textAlign = 'left'; ctx.fillText(snapped.kind, p.x+12,p.y-11);
  }
}
function locate(event) {
  const rect = viewer.canvas.getBoundingClientRect();
  const point = viewer.renderer.screenToWorld({ x:event.clientX-rect.left, y:event.clientY-rect.top });
  const radius=12/viewer.renderer.getViewState().scale;
  let snap = $('snap').checked && !event.altKey ? snapQuery(point,radius) : null;
  if($('snap').checked&&!event.altKey){const own=designer?.snap(point,radius);if(own&&(!snap||measure(point,own).distance<measure(point,snap).distance))snap=own;}
  return { point: snap || point, snap };
}
designer=new Designer({
  setMode,draw:drawOverlay,notice,status,hint:text=>$('tool-hint').textContent=text,
  screen:p=>viewer.renderer.worldToScreen(p),scale:()=>viewer.renderer.getViewState().scale,canvas:()=>viewer.canvas,
  world:event=>{const r=viewer.canvas.getBoundingClientRect();return viewer.renderer.screenToWorld({x:event.clientX-r.left,y:event.clientY-r.top});},
  locate:event=>locate(event).point,formatLength:valueLabel,unitLabel,
  toDisplay:value=>convert(value,drawingUnit,displayUnit),fromDisplay:value=>convert(value,displayUnit,drawingUnit),
  metersToWorld:value=>drawingUnit==='unit'?value:convert(value,'m',drawingUnit)
});
const panGesture=bindPanGesture({
  element:viewport,getCanvas:()=>viewer.canvas,
  canPan:event=>Boolean(source)&&!busy&&(event.button===1||mode==='pan'),
  panBy:(x,y)=>viewer.renderer.panByScreenDelta(x,y)
});
viewport.addEventListener('pointermove', event => {
  if (!source || busy) return;
  const {point,snap} = locate(event); pointer = point; snapped = mode === 'measure' ? snap : null;
  designer.pointerMove(point,event);
  $('coordinates').textContent = `X ${format(point.x)}   Y ${format(point.y)}`;
  if (mode === 'measure' && (event.buttons === 1 || event.buttons === 2)) event.stopPropagation();
  updatePreviewTotal(); drawOverlay();
}, true);
viewport.addEventListener('pointerdown',event=>{
  if(!source||busy||!event.target.closest('#viewer'))return;
  document.activeElement?.blur();
  if(mode!=='measure'){if(designer.pointerDown(locate(event).point,event)){event.preventDefault();event.stopPropagation();}return;}
  if(event.button===2||(event.button===0&&event.ctrlKey)){
    event.preventDefault();event.stopPropagation();finishMeasurement();return;
  }
  if(event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  const {point,snap}=locate(event);pointer=point;snapped=snap;
  if(session.add(point)){updateHint();renderMeasurements();drawOverlay();}
},true);
viewport.addEventListener('pointerleave',()=>{pointer=null;snapped=null;designer.pointerMove(null);updatePreviewTotal();drawOverlay();});
viewport.addEventListener('contextmenu',event=>event.preventDefault());
new ResizeObserver(drawOverlay).observe(viewport);
$('pan').onclick = () => setMode('pan');
$('measure').onclick = $('start-measure').onclick = () => setMode('measure');
$('design').onclick=()=>setMode('select');
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{if(source)setMode(b.dataset.panel==='design'?'select':'measure');});
$('save-project').onclick=async()=>{try{document.activeElement?.blur();await designer.flush(true);status('Projekt zapisany w DWG Desk · do innych programów: Zapisz DWG / DXF');}catch(error){notice(`Nie zapisano warstw: ${error.message}`);}};
$('export-cad').onclick=()=>{if(source&&!busy&&!exportBusy){document.activeElement?.blur();$('cad-export-format').value=/\.dwg$/i.test(fileName)?'dwg':'dxf';$('cad-export-base').checked=true;$('cad-export-text-height').value=designer.state.settings.cadTextHeight??suggestCadTextHeight(designer.state,drawingUnit);$('cad-export-text-unit').textContent=drawingUnit==='unit'?'j. rys.':drawingUnit;$('cad-export-details').checked=designer.state.settings.cadCameraDetails===true;$('cad-export-error').textContent='';$('cad-export-dialog').showModal();}};
$('cad-export-form').onsubmit=async event=>{
  event.preventDefault();if(exportBusy||!sourceBytes)return;exportBusy=true;
  const submit=$('cad-export-submit');submit.disabled=true;$('cad-export-cancel').disabled=true;submit.textContent='Konwertuję lokalnie…';$('cad-export-error').textContent='';
  try{
    document.activeElement?.blur();
    const textHeight=Number($('cad-export-text-height').value);
    if(!Number.isFinite(textHeight)||textHeight<1e-8||textHeight>1e9)throw new Error('Podaj dodatnią wysokość opisów w jednostkach rysunku.');
    const includeCameraDetails=$('cad-export-details').checked;
    designer.settingsChanged({cadTextHeight:textHeight,cadCameraDetails:includeCameraDetails});await designer.flush(true);
    const doc=viewer.getDocument();
    const result=await window.desktop.exportCad({format:$('cad-export-format').value,includeBase:$('cad-export-base').checked,name:fileName,bytes:sourceBytes,design:structuredClone(designer.state),unit:drawingUnit,displayUnit:drawingUnit==='unit'?'unit':displayUnit,textHeight,includeCameraDetails,sceneTransform:doc.metadata?.sceneTransformApplied?doc.savedView?.sceneTransform:null});
    if(result){$('cad-export-dialog').close();status(`Zapisano ${result.fileName} z ${result.objects} elementami · otwórz ten plik w drugim programie`);if(result.warningCount)notice(`Plik CAD zapisano z uwagami konwertera (${result.warningCount}).\n`+result.warnings.slice(0,5).join('\n'));else notice('');}
  }catch(error){$('cad-export-error').textContent=error.message;}
  finally{exportBusy=false;submit.disabled=false;$('cad-export-cancel').disabled=false;submit.textContent='Zapisz plik…';}
};
$('cad-export-dialog').addEventListener('cancel',event=>{if(exportBusy)event.preventDefault();});
$('open').onclick = $('empty-open').onclick = chooseFile;
$('file-input').onchange = async event => { const file = event.target.files[0]; event.target.value = ''; if (file) await openDrawing(file); };
$('fit').onclick = () => viewer.renderer.fitToView(0.86,'extents');
$('zoom-in').onclick = () => viewer.zoomIn(); $('zoom-out').onclick = () => viewer.zoomOut();
$('layer-search').oninput = renderLayers;
$('drawing-unit').onchange = $('display-unit').onchange = ()=>{updateUnits();designer.settingsChanged({drawingUnit:$('drawing-unit').value,displayUnit:$('display-unit').value});};
$('snap').onchange = () => { $('snap-status').textContent = $('snap').checked ? 'PRZYCIĄGANIE WŁ.' : 'PRZYCIĄGANIE WYŁ.'; snapped = null; drawOverlay(); };
$('theme').onclick = () => { light = !light; viewer.setCanvasOptions({ background:light ? '#f3f3ed' : '#10151b', foreground:light ? '#162b30' : '#e5ecef' }); drawOverlay(); };
$('clear').onclick = () => { session.clear(); updateHint(); renderMeasurements(); drawOverlay(); };
$('finish-measure').onclick=finishMeasurement;
$('undo-point').onclick=()=>{session.undo();updateHint();renderMeasurements();drawOverlay();};
$('notice-close').onclick = () => notice('');
$('cancel').onclick = () => controller?.abort();
$('export').onclick = async () => {
  if (!measurements.length) return;
  try {
    const csv = measurementsCSV(measurements,drawingUnit,displayUnit);
    if (window.desktop) { if (await window.desktop.saveCSV(csv)) status('Pomiary zapisane w CSV'); }
    else { const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv'})); a.download='pomiary.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  } catch (error) { notice(`Nie udało się zapisać pomiarów. ${error.message}`); }
};
$('demo').onclick = async () => { try { const response=await fetch(new URL('demo.dxf',document.baseURI)); await openDrawing(new File([await response.arrayBuffer()],'Przykład — pracownia.dxf')); } catch (error) { notice(error.message); } };
document.addEventListener('keydown', event => {
  if(document.querySelector('dialog[open]'))return;
  if (['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) return;
  if(designer.keyDown(event))return;
  if(event.key==='Escape'){if(busy)controller?.abort();else if(session.active)finishMeasurement();else setMode('pan');}
  if(event.key==='Enter'&&mode==='measure'&&session.active){event.preventDefault();finishMeasurement();}
  if(event.key==='Backspace'&&mode==='measure'){event.preventDefault();session.undo();updateHint();renderMeasurements();drawOverlay();}
  if (event.metaKey || event.ctrlKey) return;
  if (event.key.toLowerCase() === 'v') setMode('pan');
  if (event.key.toLowerCase() === 'm') setMode('measure');
  if (event.key.toLowerCase() === 'f') viewer.renderer.fitToView(0.86,'extents');
  if (event.key.toLowerCase() === 's') { $('snap').checked = !$('snap').checked; $('snap').dispatchEvent(new Event('change')); }
});
let dragDepth=0;
document.addEventListener('dragenter',event => { event.preventDefault(); if (event.dataTransfer?.types.includes('Files')) { dragDepth++; $('drop-overlay').hidden=false; } });
document.addEventListener('dragover',event => event.preventDefault());
document.addEventListener('dragleave',event => { event.preventDefault(); if (--dragDepth<=0) {dragDepth=0;$('drop-overlay').hidden=true;} });
document.addEventListener('drop',async event => { event.preventDefault(); dragDepth=0;$('drop-overlay').hidden=true; const file=event.dataTransfer?.files[0]; if(file) await openDrawing(file); });
window.desktop?.onDrawing(openDrawing); window.desktop?.onError(notice);
window.desktop?.onAction(action => { if(action==='fit')viewer.fit('extents');if(action==='measure')setMode('measure');if(action==='export')$('export').click();if(action==='save-design')$('save-project').click();if(action==='export-cad')$('export-cad').click(); });
window.addEventListener('beforeunload',event=>{document.activeElement?.blur();if(designer.dirty||designer.hasDraft){event.preventDefault();event.returnValue='';designer.flush(true).then(()=>window.desktop.finishClose()).catch(error=>notice(`Nie zapisano warstw. Okno pozostaje otwarte. ${error.message}`));}});
window.desktop?.ready();
// Read-only diagnostics used by the native Electron acceptance suite.
Object.defineProperty(window, '__dwgDiagnostics', { value: Object.freeze({
  state: () => ({ fileName, mode, busy, pointCount, drawingUnit, displayUnit, measurements:structuredClone(measurements), active:session.active?measurements.indexOf(session.active):null, unitDetection, entityCount:source?.entities.length || 0, stats:lastStats, header:source?.header, units:source?.units }),
  worldToScreen: point => viewer.renderer.worldToScreen(point),
  drawing:()=>structuredClone(viewer.getDocument()),
  snapPoints: () => source ? collectSnapPoints(viewer.getDocument()).points.slice(0,50) : [],
  view: () => viewer.renderer.getViewState()
  ,design:()=>structuredClone({state:designer.state,library:designer.library,selected:designer.selected,dirty:designer.dirty,key:designer.key})
}) });
