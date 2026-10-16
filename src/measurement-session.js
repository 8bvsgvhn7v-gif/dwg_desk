import { measure } from './geometry.js';
export class MeasurementSession {
  paths=[];
  active=null;
  add(point){
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
    const previous=this.active?.points.at(-1);
    if(previous&&measure(previous,point).distance<=1e-12)return false;
    if(!this.active){this.active={points:[],complete:false};this.paths.push(this.active);}
    this.active.points.push({x:point.x,y:point.y});return true;
  }
  finish(){
    const path=this.active;if(!path)return null;
    if(path.points.length<2)this.paths.splice(this.paths.indexOf(path),1);
    else path.complete=true;
    this.active=null;return path.complete?path:null;
  }
  undo(){
    if(!this.active)return;
    this.active.points.pop();
    if(!this.active.points.length){this.paths.splice(this.paths.indexOf(this.active),1);this.active=null;}
  }
  remove(index){if(this.paths[index]===this.active)this.active=null;this.paths.splice(index,1);}
  clear(){this.paths.splice(0);this.active=null;}
}
