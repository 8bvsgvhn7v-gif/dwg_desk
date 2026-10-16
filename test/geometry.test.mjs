import test from 'node:test';
import assert from 'node:assert/strict';
import { measure, convert, detectUnits, collectSnapPoints, buildSnapIndex, measurementsCSV } from '../src/geometry.js';
const doc = entities => ({entities,layers:{},blocks:{}});
test('distance is geometric with signed axes; large CAD coordinates remain precise',()=>{
  const a={x:6500000,y:5300000},b={x:6503000,y:5304000};
  assert.deepEqual(measure(a,b),{distance:5000,dx:3000,dy:4000,angle:Math.atan2(4,3)*180/Math.PI});
  assert.equal(measure(b,a).distance,5000);assert.equal(convert(5000,'mm','m'),5);assert.ok(Math.abs(convert(12,'in','ft')-1)<1e-12);
});
test('unitless or unsupported headers never pretend to be millimeters',()=>{
  assert.equal(detectUnits({header:{$INSUNITS:4}}),'mm');assert.equal(detectUnits({header:{INSUNITS:6}}),'m');assert.equal(detectUnits({header:{$INSUNITS:0}}),'unit');assert.equal(detectUnits({header:{$INSUNITS:21}}),'unit');assert.equal(detectUnits({}),'unit');
});
test('snap uses a pixel-derived radius and excludes hidden layers',()=>{
  const d=doc([{kind:'line',layer:'visible',startPoint:{x:0,y:0},endPoint:{x:3000,y:4000}},{kind:'line',layer:'hidden',startPoint:{x:3,y:4},endPoint:{x:5,y:6}}]);d.layers.hidden={isVisible:false};
  const {points}=collectSnapPoints(d),query=buildSnapIndex(points);assert.equal(points.length,3);assert.deepEqual(query({x:2998,y:4001},4),{x:3000,y:4000,kind:'Koniec'});assert.equal(query({x:20,y:20},4),null);
});
test('nested block endpoints include base point, scale and rotation',()=>{
  const d=doc([{kind:'insert',blockName:'A',insertionPoint:{x:100,y:200},scale:{x:2,y:2},rotation:Math.PI/2}]);
  d.blocks.A={basePoint:{x:10,y:10},entities:[{kind:'insert',blockName:'B',insertionPoint:{x:10,y:10}}]};
  d.blocks.B={entities:[{kind:'line',startPoint:{x:0,y:0},endPoint:{x:3,y:4}}]};
  const p=collectSnapPoints(d).points;assert.ok(Math.abs(p[0].x-100)<1e-8);assert.ok(Math.abs(p[0].y-200)<1e-8);assert.ok(Math.abs(p[1].x-92)<1e-8);assert.ok(Math.abs(p[1].y-206)<1e-8);assert.equal(measure(p[0],p[1]).distance,10);
});
test('cyclic blocks and point caps are bounded; curved segments have no false chord midpoint',()=>{
  const d=doc([{kind:'insert',blockName:'A'},{kind:'polyline',vertices:[{x:0,y:0,bulge:1},{x:2,y:0}]}]);d.blocks.A={entities:[{kind:'insert',blockName:'A'}]};assert.equal(collectSnapPoints(d).points.length,2);assert.equal(collectSnapPoints(d,1).truncated,true);
});
test('CSV exports real converted values plus original coordinates',()=>{
  const csv=measurementsCSV([{points:[{x:0,y:0},{x:3000,y:0},{x:3000,y:4000}],complete:true},{points:[{x:0,y:0},{x:1000,y:0}],complete:false}],'mm','m');
  assert.match(csv,/1;1;3;m;3;7;3;0;0;0;0;3000;0;Zakończony/);
  assert.match(csv,/1;2;4;m;7;7;0;4;90;3000;0;3000;4000;Zakończony/);
  assert.match(csv,/2;1;1;m;1;1;1;0;0;0;0;1000;0;W trakcie/);
  assert.ok(csv.endsWith('SUMA POMIARÓW;;8;m'));
});
