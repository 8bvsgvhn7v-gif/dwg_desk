import test from 'node:test';
import assert from 'node:assert/strict';
import {MeasurementSession} from '../src/measurement-session.js';
import {measurePath} from '../src/geometry.js';
const route=[{x:0,y:0},{x:3000,y:0},{x:3000,y:4000}];
test('continuous path sums every segment rather than endpoint displacement',()=>{
  const s=new MeasurementSession();route.forEach(p=>s.add(p));
  assert.equal(s.paths.length,1);assert.equal(s.active.points.length,3);
  assert.equal(measurePath(s.active.points).total,7000);
  assert.deepEqual(measurePath(s.active.points).segments.map(p=>p.cumulative),[3000,7000]);
  const finished=s.finish();assert.equal(finished.complete,true);assert.equal(finished.points.length,3);assert.equal(s.active,null);
  s.add({x:10000,y:10000});s.add({x:10000,y:11000});s.finish();
  assert.equal(s.paths.reduce((n,p)=>n+measurePath(p.points).total,0),8000);
});
test('undo and duplicate clicks preserve an accurate active route',()=>{
  const s=new MeasurementSession();route.forEach(p=>s.add(p));assert.equal(s.add(route[2]),false);assert.equal(s.add({x:NaN,y:0}),false);
  s.undo();assert.equal(measurePath(s.active.points).total,3000);s.add({x:0,y:4000});assert.equal(measurePath(s.active.points).total,8000);
  s.undo();s.undo();s.undo();assert.equal(s.active,null);assert.equal(s.paths.length,0);
});
test('finishing a single point discards it; deleting or clearing removes active reference',()=>{
  const s=new MeasurementSession();const sameArray=s.paths;s.add(route[0]);assert.equal(s.finish(),null);assert.equal(s.paths.length,0);
  s.add(route[0]);s.remove(0);assert.equal(s.active,null);s.add(route[0]);s.add(route[1]);s.clear();assert.equal(s.active,null);assert.equal(sameArray.length,0);
});
