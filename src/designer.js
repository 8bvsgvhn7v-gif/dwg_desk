import markup from './design-ui.html?raw';
import {DEFAULT_LIBRARY,copy,uid,newDesign,DesignHistory,validateLibrary,pathLength,pointOnPath,projectOnSegment,distance,translateObject,cameraStrokes,rotationToward,objectColor} from '../shared/design-model.js';
import {drawDesign,drawSymbol,symbolPoint} from './design-renderer.js';
import './designer.css';
const $=id=>document.getElementById(id);
const editModes=['select','cable','symbol','point','text','flag'];
const option=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;return o;};
const button=(text,action,title)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;if(title)b.title=title;return b;};
export class Designer {
  constructor(api){
    this.api=api;this.history=new DesignHistory();this.library=copy(DEFAULT_LIBRARY);this.key=null;this.loadSequence=0;this.mode='pan';this.selected=null;this.activeLayer='cables';this.draft=[];this.hover=null;this.hits=[];this.drag=null;this.flagTarget=null;this.flagRatio=.5;this.revision=0;this.savedRevision=0;this.saveQueue=Promise.resolve();this.editLayerId=null;
    this.action=null;this.shiftKey=false;
    document.body.insertAdjacentHTML('beforeend',markup);this.installPanel();this.bindUI();
    this.ready=window.desktop.loadLibrary().then(library=>{this.library=validateLibrary(library);this.renderLibrary();}).catch(error=>{this.libraryError=error;this.api.notice(`Nie można odczytać biblioteki: ${error.message}`);});
    this.render();
  }
  get state(){return this.history.state;}
  get dirty(){return this.revision!==this.savedRevision;}
  get hasDraft(){return this.draft.length>0||Boolean(this.drag);}
  installPanel(){
    $('design-panel').innerHTML=`<div class="design-panel-heading"><span class="eyebrow">WARSTWY ROBOCZE DWG DESK</span><h2>Projekt instalacji</h2><p class="microcopy">Projekt zapisuje się automatycznie na tym Macu. Aby otworzyć go w innym programie, użyj „Zapisz DWG / DXF”.</p></div>
    <button id="open-library" class="outline">Biblioteka symboli i kabli</button>
    <label class="field-label">Aktywna warstwa<select id="active-layer"></select></label>
    <div id="placement-settings"><label class="field-label">Typ kabla<select id="cable-preset"></select></label><label class="field-label">Symbol<select id="symbol-preset"></select></label></div>
    <div id="design-hint" class="design-hint">Wybierz narzędzie z paska nad rysunkiem.</div>
    <div id="selection-empty" class="selection-empty">Zaznacz element, aby zmienić jego właściwości. Przeciągaj uchwyty trasy, aby zmienić jej przebieg.</div>
    <form id="object-properties" hidden><div class="section-heading">WŁAŚCIWOŚCI <span id="object-kind"></span></div>
      <div id="symbol-transform" class="property-actions"><button id="move-symbol" type="button">↔ Przesuń</button><button id="aim-symbol" type="button">↗ Wskaż kierunek</button></div>
      <label class="field-label">Nazwa / oznaczenie<input id="object-name" maxlength="200"></label>
      <label class="field-label">Opis / model<textarea id="object-description" rows="2" maxlength="1000"></textarea></label>
      <label class="field-label">Warstwa<select id="object-layer"></select></label>
      <div class="object-color-control"><label class="field-label" for="object-color">Kolor elementu</label><div class="object-color-row"><input id="object-color" type="color" aria-describedby="object-color-source"><button id="object-color-layer" type="button" class="outline">Z warstwy</button></div><div id="object-color-palette" class="color-palette" role="group" aria-label="Gotowe kolory"></div><p id="object-color-source" class="microcopy" aria-live="polite"></p></div>
      <div id="cable-properties"><label class="field-label">Rodzaj kabla<input id="object-cable-type" maxlength="200"></label><strong id="object-length"></strong><div class="property-actions"><button id="add-route-flag" type="button">+ Flaga długości</button><button id="remove-route-flags" type="button">Usuń flagi</button></div><p class="microcopy">Zaznacz trasę i przeciągnij kwadratowy uchwyt. Flagi pokazują długość całej trasy w XY.</p></div>
      <div id="position-properties"><div class="field-pair"><label class="field-label">X<input id="object-x" type="number" step="any"></label><label class="field-label">Y<input id="object-y" type="number" step="any"></label></div><div class="field-pair"><label class="field-label">Obrót (°)<input id="object-rotation" type="number" min="-360" max="360" step="1"></label><label class="field-label">Rozmiar <span class="design-unit"></span><input id="object-size" type="number" min="0.000001" step="any"></label></div></div>
      <div id="camera-properties"><div class="field-pair"><label class="field-label">Kąt widzenia (°)<input id="object-fov" type="number" min="1" max="360" step="1"></label><label class="field-label">Zasięg <span class="design-unit"></span><input id="object-range" type="number" min="0" step="any"></label></div><label class="switch-line"><input id="object-show-fov" type="checkbox"> Pokaż sektor obserwacji</label><p class="microcopy">Sektor pokazuje kierunek, kąt i zasięg w rzucie 2D. Nie uwzględnia przeszkód ani wysokości montażu.</p></div>
      <div class="property-actions"><button id="duplicate-object" type="button">Duplikuj</button><button id="save-object-library" type="button">Do biblioteki</button><button id="delete-object" type="button" class="danger">Usuń</button></div>
    </form><div class="design-summary"><span id="design-object-count">0 elementów</span><span id="design-save-status">Brak rysunku</span></div><button id="save-project" title="Zapisz projekt tylko w DWG Desk; plik CAD zapiszesz przyciskiem na górnym pasku" disabled>Zapisz projekt lokalnie</button>`;
  }
  bindUI(){
    document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
    document.querySelectorAll('[data-design-tool]').forEach(b=>b.onclick=()=>this.api.setMode(b.dataset.designTool));
    $('design-undo').onclick=()=>this.undo();$('design-redo').onclick=()=>this.redo();
    $('open-library').onclick=()=>{this.renderLibrary();$('library-dialog').showModal();};
    $('new-layer').onclick=()=>this.openLayer();$('layer-form').onsubmit=e=>{e.preventDefault();const name=$('layer-name').value.trim();if(!name)return;this.mutate(s=>{if(this.editLayerId){const l=s.layers.find(l=>l.id===this.editLayerId);l.name=name;l.color=$('layer-color').value;}else{const id=uid();s.layers.push({id,name,color:$('layer-color').value,visible:true,locked:false});this.activeLayer=id;}});$('layer-dialog').close();};
    $('active-layer').onchange=()=>{this.activeLayer=$('active-layer').value;this.renderLayers();};
    $('new-symbol').onclick=()=>this.openSymbol();$('new-cable-type').onclick=()=>this.openCableType();
    $('symbol-form').onsubmit=e=>{e.preventDefault();this.saveSymbol().catch(error=>this.api.notice(error.message));};
    $('cable-type-form').onsubmit=e=>{e.preventDefault();this.saveCableType().catch(error=>this.api.notice(error.message));};
    document.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>{this.symbolTool=b.dataset.shape;this.symbolAnchor=null;document.querySelectorAll('[data-shape]').forEach(x=>x.classList.toggle('active',x===b));this.drawSymbolEditor();});
    $('symbol-undo').onclick=()=>{this.symbolDraft.pop();this.symbolAnchor=null;this.drawSymbolEditor();};$('symbol-clear').onclick=()=>{this.symbolDraft=[];this.symbolAnchor=null;this.drawSymbolEditor();};$('symbol-template').onclick=()=>{this.symbolDraft=cameraStrokes();this.symbolAnchor=null;this.drawSymbolEditor();};
    const canvas=$('symbol-canvas');
    const locate=e=>{const r=canvas.getBoundingClientRect();return {x:Math.round(((e.clientX-r.left)*canvas.width/r.width-canvas.width/2)/8)/8,y:Math.round((canvas.height/2-(e.clientY-r.top)*canvas.height/r.height)/8)/8};};
    canvas.onpointermove=e=>{this.symbolHover=locate(e);this.drawSymbolEditor();};canvas.onpointerleave=()=>{this.symbolHover=null;this.drawSymbolEditor();};
    canvas.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const p=locate(e);if(!this.symbolAnchor)this.symbolAnchor=p;else{const shape=this.newStroke(this.symbolAnchor,p);if(shape)this.symbolDraft.push(shape);this.symbolAnchor=null;}this.drawSymbolEditor();};
    canvas.oncontextmenu=e=>{e.preventDefault();this.symbolAnchor=null;this.drawSymbolEditor();};
    $('object-properties').onsubmit=e=>e.preventDefault();
    const colors=[['#ff7f83','Czerwony'],['#ffbf69','Pomarańczowy'],['#ffe066','Żółty'],['#a5ebbd','Zielony'],['#80c7ff','Niebieski'],['#c6a0ff','Fioletowy'],['#ff8cce','Różowy'],['#ffffff','Biały']];
    for(const [color,name] of colors){const swatch=button('',()=>this.updateSelected(o=>o.color=color),name);swatch.dataset.color=color;swatch.style.setProperty('--swatch',color);swatch.setAttribute('aria-label',name);$('object-color-palette').append(swatch);}
    $('object-color-layer').onclick=()=>this.updateSelected(o=>delete o.color);
    $('symbol-color').oninput=()=>this.drawSymbolEditor();
    $('symbol-color-layer').onchange=()=>{$('symbol-color').disabled=$('symbol-color-layer').checked;this.drawSymbolEditor();};
    for(const [id,key] of [['object-name','name'],['object-description','description'],['object-layer','layerId'],['object-cable-type','cableType'],['object-color','color']])$(id).onchange=()=>this.updateSelected(o=>{const v=$(id).value.trim();o[key]=(key==='name'&&!v)?o.name:v;});
    for(const [id,key,length,min,max] of [['object-rotation','rotation',false,-360,360],['object-size','size',true,.000001,1e9],['object-range','range',true,0,1e9],['object-fov','fov',false,1,360]])$(id).onchange=()=>{let v=Number($(id).value);if(!Number.isFinite(v)||v<min||v>max){this.renderProperties();return;}if(length)v=this.api.fromDisplay(v);this.updateSelected(o=>o[key]=v);};
    for(const [id,key] of [['object-x','x'],['object-y','y']])$(id).onchange=()=>{const v=Number($(id).value);if(Number.isFinite(v)&&Math.abs(v)<1e12)this.updateSelected(o=>o.position[key]=v);else this.renderProperties();};
    $('object-show-fov').onchange=()=>this.updateSelected(o=>o.showFov=$('object-show-fov').checked);
    $('move-symbol').onclick=()=>this.startAction('move');$('aim-symbol').onclick=()=>this.startAction('aim');
    $('add-route-flag').onclick=()=>{this.api.setMode('flag');this.flagTarget=this.selected;this.flagRatio=.5;this.updateHint();};
    $('remove-route-flags').onclick=()=>this.updateSelected(o=>o.flags=[]);
    $('duplicate-object').onclick=()=>{const o=this.object();if(!o)return;const clone=copy(o);clone.id=uid();clone.name+=' — kopia';if(clone.flags)clone.flags.forEach(f=>f.id=uid());translateObject(clone,30/this.api.scale(),-30/this.api.scale());this.mutate(s=>s.objects.push(clone));this.selected=clone.id;this.renderProperties();this.api.draw();};
    $('delete-object').onclick=()=>this.deleteSelected();$('save-object-library').onclick=()=>{const o=this.object();if(o?.kind==='symbol')this.openSymbol({...copy(o.symbol),name:o.name,model:o.description||o.symbol.model,fov:o.fov,color:o.color},true);else if(o?.kind==='cable')this.openCableType({name:o.cableType,description:o.description||'',color:objectColor(o,this.layer(o.layerId))},true);};
    window.addEventListener('pointermove',e=>this.moveDrag(e),true);window.addEventListener('pointerup',e=>{if(this.drag&&e.pointerId===this.drag.pointerId)this.endDrag();},true);
    window.addEventListener('pointercancel',e=>{if(this.drag&&e.pointerId===this.drag.pointerId)this.cancelDrag();},true);
    window.addEventListener('lostpointercapture',e=>{if(this.drag&&e.pointerId===this.drag.pointerId){if(e.buttons&1)this.cancelDrag();else this.endDrag();}},true);
    window.addEventListener('blur',()=>{this.cancelDrag();this.cancelAction();});
  }
  object(){return this.state.objects.find(o=>o.id===this.selected);}
  layer(id=this.activeLayer){return this.state.layers.find(l=>l.id===id);}
  editable(o){const l=this.layer(o?.layerId);return l&&l.visible&&!l.locked;}
  mutate(fn){if(!this.key)return;if(this.history.change(fn))this.changed();}
  changed(){if(!this.layer())this.activeLayer=this.state.layers[0].id;this.revision++;this.scheduleSave();this.render();this.api.draw();}
  scheduleSave(){clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>this.flush().catch(error=>this.api.notice(`Nie zapisano warstw: ${error.message}`)),300);this.renderSaveStatus();}
  async flush(finish=false){
    if(finish){this.endDrag();this.finishCable();}else if(this.drag)return;clearTimeout(this.saveTimer);
    const key=this.key,revision=this.revision;if(!key||revision===this.savedRevision){await this.saveQueue;return;}
    const snapshot=copy(this.state);
    const write=this.saveQueue.catch(()=>{}).then(()=>window.desktop.saveDesign(key,snapshot));this.saveQueue=write;
    try{await write;if(this.key===key){this.savedRevision=Math.max(this.savedRevision,revision);this.renderSaveStatus();}}catch(error){this.renderSaveStatus(true);throw error;}
  }
  async load(key,settings){
    const request=++this.loadSequence;
    await this.ready;if(this.libraryError)throw this.libraryError;
    const saved=await window.desktop.loadDesign(key);if(request!==this.loadSequence)return;
    this.key=key;this.history=new DesignHistory(saved||newDesign());if(!saved)this.state.settings=copy(settings);this.revision=this.savedRevision=0;this.activeLayer=this.state.layers[0].id;this.selected=null;this.draft=[];this.flagTarget=null;this.render();return saved?.settings;
  }
  reset(){this.loadSequence++;clearTimeout(this.saveTimer);this.cancelDrag();this.key=null;this.history=new DesignHistory();this.selected=null;this.draft=[];this.revision=this.savedRevision=0;this.render();}
  settingsChanged(settings){if(this.key)this.mutate(s=>s.settings={...s.settings,...copy(settings)});}
  setMode(mode){
    if(this.mode==='cable'&&mode!=='cable')this.finishCable();this.cancelDrag();this.action=null;this.mode=mode;this.draft=[];this.flagTarget=null;this.hover=null;this.api.canvas().style.cursor='';
    if(['cables','cameras','points'].includes(this.activeLayer)){const target={cable:'cables',symbol:'cameras',point:'points',text:'points'}[mode];if(target&&this.layer(target))this.activeLayer=target;this.renderLayers();}
    if(editModes.includes(mode))this.showPanel(true);else if(mode==='measure')this.showPanel(false);
    document.querySelectorAll('[data-design-tool]').forEach(b=>b.classList.toggle('active',b.dataset.designTool===mode));
    this.updateHint();this.renderProperties();this.api.draw();
  }
  showPanel(design){$('design-panel').hidden=!design;$('measurement-panel').hidden=design;$('design-toolbar').hidden=!design;$('design-layers-section').hidden=!this.key;document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',(b.dataset.panel==='design')===design));$('design').classList.toggle('active',design);}
  updateHint(){
    const symbol=this.object()?.kind==='symbol';
    const hints={select:this.action==='move'?'Wskaż nowe położenie i kliknij. Esc / prawy przycisk: anuluj.':this.action==='aim'?'Wskaż punkt, na który ma patrzeć kamera, i kliknij. Shift: co 15°. Esc / prawy: anuluj.':symbol?'Przeciągnij kamerę lub kwadrat, aby ją przesunąć. Kółko ze strzałką obraca kierunek; Shift: co 15°.':'Kliknij element. Przeciągnij go lub uchwyt trasy. Delete usuwa zaznaczenie.',cable:this.draft.length?'Lewy: kolejny punkt · prawy / Enter: zakończ · Backspace: cofnij punkt':'Klikaj przebieg kabla. Prawy przycisk kończy trasę i dodaje flagę długości.',symbol:'Kliknij, aby wstawić symbol. Potem przesuń go lub obróć uchwytem kierunku.',point:'Kliknij, aby dodać punkt instalacyjny.',text:'Kliknij, aby dodać opis. Treść zmienisz we właściwościach.',flag:this.flagTarget?'Kliknij miejsce dla flagi długości.':'Kliknij trasę kablową, a następnie miejsce dla flagi.'};
    $('design-hint').textContent=hints[this.mode]||'Wybierz narzędzie z paska nad rysunkiem.';
    if(editModes.includes(this.mode))this.api.hint((this.mode==='cable'&&this.draft.length?'Lewy: kolejny punkt · prawy / Enter: zakończ':this.mode==='flag'?hints.flag:hints[this.mode])+' · kółko: przesuwaj');
  }
  openLayer(id=null){this.editLayerId=id;const l=this.state.layers.find(l=>l.id===id);$('layer-name').value=l?.name||'';$('layer-color').value=l?.color||'#a5ebbd';$('layer-dialog').showModal();$('layer-name').focus();}
  renderLayers(){
    for(const id of ['active-layer','object-layer']){const select=$(id),value=id==='active-layer'?this.activeLayer:this.object()?.layerId;select.replaceChildren(...this.state.layers.map(l=>option(l.id,l.name+(l.locked?' · blokada':''))));select.value=value||this.state.layers[0].id;}
    $('design-layer-list').replaceChildren();
    for(const l of this.state.layers){
      const row=document.createElement('div');row.className='design-layer'+(this.activeLayer===l.id?' current':'');
      const visibility=document.createElement('input');visibility.type='checkbox';visibility.checked=l.visible;visibility.setAttribute('aria-label',`Pokaż warstwę roboczą ${l.name}`);visibility.onchange=()=>this.mutate(()=>l.visible=visibility.checked);
      const name=button(l.name,()=>{this.activeLayer=l.id;this.renderLayers();},l.name);name.className='design-layer-name';name.style.color=l.color;
      const lock=button(l.locked?'🔒':'◇',()=>this.mutate(()=>l.locked=!l.locked),l.locked?'Odblokuj warstwę':'Zablokuj warstwę');lock.setAttribute('aria-label',`${l.locked?'Odblokuj':'Zablokuj'} ${l.name}`);
      const edit=button('⋯',()=>this.openLayer(l.id),'Nazwa i kolor warstwy');row.append(visibility,name,lock,edit);$('design-layer-list').append(row);
    }
    $('design-layers-section').hidden=!this.key;
  }
  renderSaveStatus(error=false){$('design-save-status').textContent=error?'Błąd zapisu lokalnego':!this.key?'Brak rysunku':this.dirty?'Zapisywanie…':'Zapisano lokalnie';$('save-project').disabled=!this.key;$('save-project').classList.toggle('unsaved',this.dirty);}
  render(){this.renderLayers();this.renderProperties();this.updateHint();this.renderSaveStatus();$('design-undo').disabled=!this.history.undoStack.length;$('design-redo').disabled=!this.history.redoStack.length;$('design-object-count').textContent=`${this.state.objects.length} elementów`;}
  renderProperties(){
    const o=this.object();$('design-panel').classList.toggle('has-selection',Boolean(o));$('object-properties').hidden=!o;$('selection-empty').hidden=Boolean(o);
    $('cable-preset').closest('label').hidden=this.mode!=='cable';$('symbol-preset').closest('label').hidden=this.mode!=='symbol';$('active-layer').closest('label').hidden=this.mode==='select'&&Boolean(o);
    if(!o)return;
    $('object-kind').textContent={cable:'KABEL',symbol:o.symbol?.kind==='camera'?'KAMERA':'SYMBOL',point:'PUNKT',text:'OPIS'}[o.kind];
    $('object-name').value=o.name;$('object-description').value=o.description||'';$('object-layer').value=o.layerId;
    const color=objectColor(o,this.layer(o.layerId));$('object-color').value=color;
    $('object-color-source').textContent=(o.color?'Własny kolor':'Kolor warstwy')+' · '+color.toUpperCase();
    $('object-color-palette').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.color===color.toLowerCase()));
    $('cable-properties').hidden=o.kind!=='cable';$('position-properties').hidden=o.kind==='cable';$('camera-properties').hidden=o.kind!=='symbol'||o.symbol.kind!=='camera';
    $('symbol-transform').hidden=o.kind!=='symbol';$('move-symbol').classList.toggle('active',this.action==='move');$('aim-symbol').classList.toggle('active',this.action==='aim');
    document.querySelectorAll('.design-unit').forEach(el=>el.textContent=`(${this.api.unitLabel()})`);
    if(o.kind==='cable'){$('object-length').textContent=this.api.formatLength(pathLength(o.points));$('object-cable-type').value=o.cableType;}
    else{$('object-x').value=o.position.x;$('object-y').value=o.position.y;$('object-rotation').value=Number(o.rotation.toFixed(2));$('object-size').value=Number(this.api.toDisplay(o.size).toPrecision(8));if(o.kind==='symbol'){$('object-fov').value=o.fov;$('object-range').value=Number(this.api.toDisplay(o.range).toPrecision(8));$('object-show-fov').checked=o.showFov;}}
    const locked=!this.editable(o);$('object-properties').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=locked);$('save-object-library').hidden=!['symbol','cable'].includes(o.kind);$('object-color-layer').disabled=locked||!o.color;
  }
  updateSelected(fn){const o=this.object();if(o&&this.editable(o))this.mutate(()=>fn(o));}
  startAction(action){const o=this.object();if(o?.kind!=='symbol'||!this.editable(o))return;this.api.setMode('select');this.action=action;this.hover=null;this.api.canvas().style.cursor='crosshair';this.renderProperties();this.updateHint();this.api.draw();}
  cancelAction(){if(!this.action)return;this.action=null;this.hover=null;this.api.canvas().style.cursor='';this.renderProperties();this.updateHint();this.api.draw();}
  preview(){const o=this.object();if(!this.action||!this.hover||!this.editable(o))return null;const preview=copy(o);if(this.action==='move')preview.position={x:this.hover.x,y:this.hover.y};else preview.rotation=rotationToward(o.position,this.hover,o.rotation,this.shiftKey);return preview;}
  deleteSelected(){const o=this.object();if(o&&this.editable(o)){this.mutate(s=>s.objects.splice(s.objects.indexOf(o),1));this.selected=null;this.renderProperties();this.api.draw();}}
  undo(){this.cancelAction();this.cancelDrag();this.draft=[];if(this.history.undo()){this.selected=null;this.changed();}this.updateHint();}
  redo(){this.cancelAction();this.cancelDrag();this.draft=[];if(this.history.redo()){this.selected=null;this.changed();}this.updateHint();}
  renderLibrary(){
    const symbolValue=$('symbol-preset').value,cableValue=$('cable-preset').value;
    $('symbol-preset').replaceChildren(...this.library.symbols.map(s=>option(s.id,s.name)));if(this.library.symbols.some(s=>s.id===symbolValue))$('symbol-preset').value=symbolValue;
    $('cable-preset').replaceChildren(...this.library.cables.map(c=>option(c.id,c.name)));if(this.library.cables.some(c=>c.id===cableValue))$('cable-preset').value=cableValue;
    $('library-symbols').replaceChildren();
    for(const s of this.library.symbols){const card=document.createElement('div');card.className='symbol-card';const canvas=document.createElement('canvas');canvas.width=180;canvas.height=90;const ctx=canvas.getContext('2d');ctx.strokeStyle=s.color||'#a5ebbd';ctx.lineWidth=2;drawSymbol(ctx,s,p=>({x:90+p.x*28,y:45-p.y*28}));const name=document.createElement('strong');name.textContent=s.name;const details=document.createElement('small');details.textContent=(s.kind==='camera'?`${s.fov}° · `:'')+s.model;const actions=document.createElement('div');actions.append(button('Wstaw',()=>{$('symbol-preset').value=s.id;$('library-dialog').close();this.api.setMode('symbol');}),button('Edytuj',()=>this.openSymbol(s)),button('Kopia',()=>this.openSymbol(s,true)));card.append(canvas,name,details,actions);$('library-symbols').append(card);}
    $('library-cables').replaceChildren();for(const c of this.library.cables){const row=document.createElement('div');const name=document.createElement('strong');name.textContent=c.name;name.style.color=c.color;const detail=document.createElement('small');detail.textContent=c.description;row.append(name,detail,button('Rysuj',()=>{$('cable-preset').value=c.id;$('library-dialog').close();this.api.setMode('cable');}),button('Edytuj',()=>this.openCableType(c)));$('library-cables').append(row);}
  }
  openSymbol(symbol=null,duplicate=false){
    this.symbolEditId=duplicate?null:symbol?.id;this.symbolDraft=copy(symbol?.strokes||cameraStrokes());this.symbolAnchor=null;this.symbolHover=null;this.symbolTool='line';
    $('symbol-color').value=symbol?.color||'#a5ebbd';$('symbol-color-layer').checked=!symbol?.color;$('symbol-color').disabled=!symbol?.color;
    $('symbol-name').value=symbol?.name||'';$('symbol-model').value=symbol?.model||'';$('symbol-kind').value=symbol?.kind||'camera';$('symbol-fov').value=symbol?.fov||90;$('symbol-error').textContent='';document.querySelectorAll('[data-shape]').forEach(b=>b.classList.toggle('active',b.dataset.shape==='line'));$('symbol-dialog').showModal();this.drawSymbolEditor();$('symbol-name').focus();
  }
  newStroke(a,b){if(distance(a,b)<.01)return null;if(this.symbolTool==='circle')return {type:'circle',center:{...a},radius:distance(a,b)};return {type:'path',points:this.symbolTool==='rect'?[{...a},{x:b.x,y:a.y},{...b},{x:a.x,y:b.y}]:[{...a},{...b}],closed:this.symbolTool==='rect'};}
  drawSymbolEditor(){
    const canvas=$('symbol-canvas'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,transform=p=>({x:w/2+p.x*64,y:h/2-p.y*64});ctx.clearRect(0,0,w,h);ctx.fillStyle='#0f171e';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#ffffff0c';ctx.lineWidth=1;for(let x=w/2%16;x<w;x+=16){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=h/2%16;y<h;y+=16){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.strokeStyle='#6a8896';ctx.beginPath();ctx.moveTo(w/2-9,h/2);ctx.lineTo(w/2+9,h/2);ctx.moveTo(w/2,h/2-9);ctx.lineTo(w/2,h/2+9);ctx.stroke();ctx.strokeStyle=$('symbol-color-layer').checked?'#a5ebbd':$('symbol-color').value;ctx.lineWidth=2;drawSymbol(ctx,{strokes:this.symbolDraft||[]},transform);if(this.symbolAnchor&&this.symbolHover){const shape=this.newStroke(this.symbolAnchor,this.symbolHover);if(shape){ctx.setLineDash([4,3]);drawSymbol(ctx,{strokes:[shape]},transform);ctx.setLineDash([]);}}
  }
  async saveSymbol(){
    const name=$('symbol-name').value.trim();if(!name||!this.symbolDraft.length){$('symbol-error').textContent='Podaj nazwę i narysuj co najmniej jeden kształt.';return;}
    const symbol={id:this.symbolEditId||uid(),name,kind:$('symbol-kind').value,model:$('symbol-model').value.trim(),fov:Number($('symbol-fov').value),strokes:copy(this.symbolDraft)};
    if(!$('symbol-color-layer').checked)symbol.color=$('symbol-color').value;
    const library=copy(this.library),index=library.symbols.findIndex(s=>s.id===symbol.id);if(index<0)library.symbols.push(symbol);else library.symbols[index]=symbol;validateLibrary(library);await window.desktop.saveLibrary(library);this.library=library;this.renderLibrary();$('symbol-preset').value=symbol.id;$('symbol-dialog').close();this.api.status('Symbol zapisany w lokalnej bibliotece');
  }
  openCableType(cable=null,duplicate=false){this.cableEditId=duplicate?null:cable?.id;$('cable-type-name').value=cable?.name||'';$('cable-type-description').value=cable?.description||'';$('cable-type-color').value=cable?.color||'#ffbf69';$('cable-type-dialog').showModal();$('cable-type-name').focus();}
  async saveCableType(){const c={id:this.cableEditId||uid(),name:$('cable-type-name').value.trim(),description:$('cable-type-description').value.trim(),color:$('cable-type-color').value};const library=copy(this.library),i=library.cables.findIndex(x=>x.id===c.id);if(i<0)library.cables.push(c);else library.cables[i]=c;validateLibrary(library);await window.desktop.saveLibrary(library);this.library=library;this.renderLibrary();$('cable-preset').value=c.id;$('cable-type-dialog').close();this.api.status('Typ kabla zapisany w bibliotece');}
  hit(point){
    const p=this.api.screen(point),tolerance=9/this.api.scale();
    for(const hit of [...this.hits].reverse())if(hit.objectId&&p.x>=hit.x&&p.x<=hit.x+hit.width&&p.y>=hit.y&&p.y<=hit.y+hit.height){const o=this.state.objects.find(o=>o.id===hit.objectId);if(this.editable(o))return {object:o,flagId:hit.flagId,handle:hit.handle};}
    const selected=this.object();if(selected?.kind==='cable'&&this.editable(selected)){const vertex=selected.points.findIndex(v=>distance(v,point)<tolerance);if(vertex>=0)return {object:selected,vertex};}
    for(const o of [...this.state.objects].reverse()){
      if(!this.editable(o))continue;
      if(o.kind==='cable'){let travelled=0;const total=pathLength(o.points);for(let i=1;i<o.points.length;i++){const a=o.points[i-1],b=o.points[i],q=projectOnSegment(point,a,b);if(distance(q,point)<tolerance)return {object:o,ratio:total?(travelled+distance(a,q))/total:.5};travelled+=distance(a,b);}}
      else if(o.kind==='symbol'){
        if(distance(point,o.position)<tolerance)return {object:o};
        for(const stroke of o.symbol.strokes){
          if(stroke.type==='circle'){if(Math.abs(distance(point,symbolPoint(o,stroke.center))-stroke.radius*o.size)<tolerance)return {object:o};}
          else{const points=stroke.points.map(p=>symbolPoint(o,p));if(stroke.closed)points.push(points[0]);for(let i=1;i<points.length;i++)if(distance(point,projectOnSegment(point,points[i-1],points[i]))<tolerance)return {object:o};}
        }
      }else if(distance(point,o.position)<Math.max(tolerance,o.size*1.5))return {object:o};
    }return null;
  }
  snap(point,tolerance){let best=null,d=tolerance;for(const o of this.state.objects){if(!this.layer(o.layerId)?.visible||(this.mode==='select'&&o.id===this.selected))continue;for(const p of o.kind==='cable'?o.points:[o.position]){const candidate=distance(point,p);if(candidate<d){best={...p,kind:'Element projektu'};d=candidate;}}}return best;}
  pointerDown(point,event){
    if(!editModes.includes(this.mode)||!this.key)return false;
    if(event.button===2||(event.button===0&&event.ctrlKey)){this.cancelAction();if(this.mode==='cable')this.finishCable();else if(this.mode==='flag'){this.flagTarget=null;this.updateHint();}return true;}
    if(event.button!==0)return false;
    if(this.mode==='select'){
      if(this.action){const action=this.action;this.action=null;this.updateSelected(o=>{if(action==='move')o.position={x:point.x,y:point.y};else o.rotation=rotationToward(o.position,point,o.rotation,event.shiftKey);});this.renderProperties();this.updateHint();this.api.canvas().style.cursor='';this.api.draw();return true;}
      const raw=this.api.world(event),hit=this.hit(raw);this.selected=hit?.object.id||null;this.renderProperties();this.updateHint();this.api.draw();if(!hit)return true;
      this.drag={...hit,start:raw,before:copy(this.state),original:copy(hit.object),pointerId:event.pointerId,canvas:this.api.canvas()};this.drag.canvas.setPointerCapture(event.pointerId);return true;
    }
    if(this.mode==='flag'){
      if(!this.flagTarget){const hit=this.hit(this.api.world(event));if(hit?.object.kind==='cable'){this.flagTarget=hit.object.id;this.flagRatio=hit.ratio??.5;this.selected=hit.object.id;this.renderProperties();}}
      else{const o=this.state.objects.find(o=>o.id===this.flagTarget);if(this.editable(o))this.mutate(()=>o.flags.push({id:uid(),ratio:this.flagRatio,position:{...point}}));this.flagTarget=null;}this.updateHint();this.api.draw();return true;
    }
    const layer=this.layer();if(!layer?.visible||layer.locked){this.api.notice('Wybierz widoczną, odblokowaną warstwę roboczą.');return true;}
    if(this.mode==='cable'){if(!this.draft.length||distance(this.draft.at(-1),point)>1e-10)this.draft.push({x:point.x,y:point.y});this.updateHint();this.api.draw();return true;}
    const kind=this.mode,n=this.state.objects.filter(o=>o.kind===kind).length+1,size=(kind==='point'?5:kind==='text'?15:17)/this.api.scale();
    const o={id:uid(),kind,layerId:this.activeLayer,name:(kind==='symbol'?'K-':kind==='point'?'P-':'Opis ')+String(n).padStart(2,'0'),description:'',position:{x:point.x,y:point.y},size,rotation:0};
    if(kind==='symbol'){const symbol=this.library.symbols.find(s=>s.id===$('symbol-preset').value);if(!symbol)return true;o.symbol=copy(symbol);if(symbol.color)o.color=symbol.color;o.description=symbol.model;o.fov=symbol.fov;o.range=this.api.metersToWorld(20);o.showFov=symbol.kind==='camera';}
    this.mutate(s=>s.objects.push(o));this.selected=o.id;if(kind==='symbol')this.api.setMode('select');this.renderProperties();this.api.draw();return true;
  }
  pointerMove(point,event){this.hover=point;this.shiftKey=Boolean(event?.shiftKey);this.api.canvas().style.cursor=this.mode==='select'?(this.action?'crosshair':this.drag?'grabbing':point&&this.hit(event?this.api.world(event):point)?'grab':'default'):'';}
  finishCable(){
    if(this.draft.length<2){this.draft=[];this.api.draw();return;}
    if(!this.layer()?.visible||this.layer().locked){this.draft=[];return;}
    const type=this.library.cables.find(c=>c.id===$('cable-preset').value)||this.library.cables[0];if(!type)return;
    const points=copy(this.draft),p=pointOnPath(points,.5),o={id:uid(),kind:'cable',layerId:this.activeLayer,name:`TR-${String(this.state.objects.filter(o=>o.kind==='cable').length+1).padStart(2,'0')}`,description:type.description,cableType:type.name,color:type.color,points,flags:[{id:uid(),ratio:.5,position:{x:p.x+25/this.api.scale(),y:p.y+30/this.api.scale()}}]};
    this.draft=[];this.mutate(s=>s.objects.push(o));this.selected=o.id;this.renderProperties();this.updateHint();this.api.draw();
  }
  moveDrag(event){
    const d=this.drag;if(!d||event.pointerId!==d.pointerId)return;if(!(event.buttons&1)){this.endDrag();return;}
    const p=this.api.world(event),o=this.state.objects.find(o=>o.id===d.object.id);if(!o)return;
    if(d.handle==='rotate')o.rotation=rotationToward(o.position,p,o.rotation,event.shiftKey);
    else if(d.vertex!=null){const snap=this.api.locate(event);o.points[d.vertex]={x:snap.x,y:snap.y};}
    else if(d.flagId){const f=o.flags.find(f=>f.id===d.flagId),original=d.original.flags.find(f=>f.id===d.flagId);f.position={x:original.position.x+p.x-d.start.x,y:original.position.y+p.y-d.start.y};}
    else{const moved=copy(d.original);translateObject(moved,p.x-d.start.x,p.y-d.start.y);Object.assign(o,moved);}
    this.renderProperties();this.api.draw();
  }
  endDrag(){const d=this.drag;if(!d)return;this.drag=null;if(d.canvas.hasPointerCapture(d.pointerId))d.canvas.releasePointerCapture(d.pointerId);if(this.history.commit(d.before))this.changed();else if(this.dirty)this.scheduleSave();}
  cancelDrag(){const d=this.drag;if(!d)return;this.drag=null;this.history.state=d.before;if(d.canvas.hasPointerCapture(d.pointerId))d.canvas.releasePointerCapture(d.pointerId);if(this.dirty)this.scheduleSave();this.renderProperties();this.api.draw();}
  keyDown(event){
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?this.redo():this.undo();return true;}
    if(!editModes.includes(this.mode))return false;
    if(event.key==='Escape'){this.cancelDrag();this.draft=[];this.flagTarget=null;this.api.setMode('select');return true;}
    if(event.key==='Enter'&&this.mode==='cable'){event.preventDefault();this.finishCable();return true;}
    if(event.key==='Backspace'&&this.draft.length){event.preventDefault();this.draft.pop();this.updateHint();this.api.draw();return true;}
    if(['Delete','Backspace'].includes(event.key)){event.preventDefault();this.deleteSelected();return true;}return false;
  }
  draw(ctx,options){this.hits=drawDesign(ctx,this.state,{...options,scale:this.api.scale(),selected:this.selected,formatLength:this.api.formatLength,draft:this.draft,hover:this.hover,flagTarget:this.flagTarget,tool:this.mode,preview:this.preview()});}
}
