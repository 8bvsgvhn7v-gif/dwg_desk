import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDrawingUnits} from '../src/units.js';
const points=[{x:7514000,y:5936000},{x:7514100,y:5936050},{x:7514200,y:5936100}];
const drawing=(text='Układ współrzędnych: PL 2000/7')=>({
  header:{INSUNITS:0,MEASUREMENT:1},entities:[{kind:'polyline',vertices:points},{kind:'insert',blockName:'title'}],
  blocks:{title:{entities:[{kind:'text',text}]}}
});
test('projected Polish survey drawing with unitless header is identified from used title block and geometry',()=>{
  const result=detectDrawingUnits(drawing());assert.equal(result.unit,'m');assert.equal(result.method,'coordinate-system');assert.equal(result.coordinateSystem,'PL 2000/7');
  const d=drawing('Układ współrzędnych: PL-1992');d.entities[0].vertices=points.map(p=>({x:p.x-7000000,y:p.y-5500000}));assert.equal(detectDrawingUnits(d).unit,'m');
});
test('header unit is authoritative; unsupported units remain explicit',()=>{
  const d=drawing();d.header.INSUNITS=4;assert.equal(detectDrawingUnits(d).unit,'mm');d.header.INSUNITS=21;assert.equal(detectDrawingUnits(d).method,'unsupported');
  assert.equal(detectDrawingUnits({header:{$INSUNITS:{value:6}}}).unit,'m');
});
test('metric flag, printed scale, cable labels and large coordinates alone are insufficient',()=>{
  for(const text of ['Skala 1:500','kabel 4x185 mm², długość 120 m',''])assert.equal(detectDrawingUnits(drawing(text)).unit,'unit');
  const d=drawing();d.entities[0].vertices=[{x:0,y:0},{x:3000,y:0},{x:3000,y:4000}];assert.equal(detectDrawingUnits(d).unit,'unit');
  d.entities[0].vertices=points;d.blocks.title.entities[0].text='Układ współrzędnych: PL 2000/6';assert.equal(detectDrawingUnits(d).unit,'unit');
});
test('unreferenced and paper-space notes do not override model units',()=>{
  const d=drawing();d.entities.pop();assert.equal(detectDrawingUnits(d).unit,'unit');
  d.entities.push({kind:'text',text:'Jednostki rysunku: mm',isInPaperSpace:true});assert.equal(detectDrawingUnits(d).unit,'unit');
});
test('explicit unit declarations work, conflicting declarations require manual selection',()=>{
  const d=drawing('Jednostki rysunku: cm');assert.equal(detectDrawingUnits(d).unit,'cm');
  d.entities.push({kind:'text',text:'Drawing units: mm'});assert.equal(detectDrawingUnits(d).method,'conflict');
  d.blocks.title.entities.push({kind:'insert',blockName:'title'});assert.equal(detectDrawingUnits(d).unit,'unit');
});
