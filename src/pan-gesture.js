// Own the drag lifecycle; the CAD renderer keeps its wheel/zoom handlers.
// In particular, a missed pointerup must never leave its internal drag latched.
export function bindPanGesture({element,getCanvas,canPan,panBy}){
  const controller=new AbortController(),options={capture:true,signal:controller.signal};
  let drag=null;
  function cancel(){
    const previous=drag;drag=null;
    if(!previous)return;
    previous.canvas.classList.remove('is-dragging');
    if(previous.canvas.hasPointerCapture(previous.pointerId))previous.canvas.releasePointerCapture(previous.pointerId);
  }
  element.addEventListener('pointerdown',event=>{
    const canvas=getCanvas();
    if(event.target!==canvas)return;
    // Measurement handlers on this same ancestor still receive the event.
    // No pointerdown reaches the renderer's unconditional pan handler.
    event.stopPropagation();
    if(!canPan(event)||event.isPrimary===false)return;
    event.preventDefault();cancel();
    const mask={0:1,1:4,2:2}[event.button];
    if(!mask)return;
    drag={canvas,pointerId:event.pointerId,button:event.button,mask,x:event.clientX,y:event.clientY};
    canvas.classList.add('is-dragging');
    canvas.setPointerCapture(event.pointerId);
  },options);
  window.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    if(!(event.buttons&drag.mask)){cancel();return;}
    panBy(event.clientX-drag.x,event.clientY-drag.y);
    drag.x=event.clientX;drag.y=event.clientY;
  },options);
  window.addEventListener('pointerup',event=>{
    if(drag&&event.pointerId===drag.pointerId&&!(event.buttons&drag.mask))cancel();
  },options);
  window.addEventListener('mouseup',event=>{
    if(drag&&(event.button===drag.button||!(event.buttons&drag.mask)))cancel();
  },options);
  for(const type of ['pointercancel','lostpointercapture'])window.addEventListener(type,event=>{
    if(drag&&event.pointerId===drag.pointerId)cancel();
  },options);
  window.addEventListener('blur',cancel,{signal:controller.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();},{signal:controller.signal});
  element.addEventListener('auxclick',event=>{if(event.button===1)event.preventDefault();},options);
  return {cancel,dispose(){cancel();controller.abort();}};
}
