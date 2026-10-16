import { UNITS } from './units.js';
export { UNITS, detectUnits } from './units.js';
export function measure(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return { distance: Math.hypot(dx, dy), dx, dy, angle: Math.atan2(dy, dx) * 180 / Math.PI };
}
export function measurePath(points){
  let total=0;
  const segments=[];
  for(let i=1;i<points.length;i++){
    const result=measure(points[i-1],points[i]);total+=result.distance;
    segments.push({...result,a:points[i-1],b:points[i],cumulative:total});
  }
  return {segments,total};
}
export function convert(value, drawingUnit, displayUnit) {
  const from = UNITS[drawingUnit]?.meters, to = UNITS[displayUnit]?.meters;
  return from && to ? value * from / to : value;
}
const identity = [1, 0, 0, 1, 0, 0];
const apply = (p, m) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
const multiply = (a, b) => [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
function insertMatrix(entity, base = { x: 0, y: 0 }) {
  const c = Math.cos(entity.rotation || 0), s = Math.sin(entity.rotation || 0), x = entity.scale?.x ?? 1, y = entity.scale?.y ?? x, p = entity.insertionPoint || { x: 0, y: 0 };
  return [c*x, s*x, -s*y, c*y, p.x-c*x*base.x+s*y*base.y, p.y-s*x*base.x-c*y*base.y];
}
// Coordinates stay in render space, including nested block transforms and UCS.
export function collectSnapPoints(document, maxPoints = 400000) {
  const points = []; let visited = 0, truncated = false;
  const add = (p, matrix, kind) => {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    if (points.length >= maxPoints) { truncated = true; return; }
    const value = apply(p, matrix);
    if (Number.isFinite(value.x) && Number.isFinite(value.y)) points.push({ ...value, kind });
  };
  const visit = (entities, matrix, parents, inheritedLayer) => {
    for (const e of entities) {
      if (++visited > 500000 || points.length >= maxPoints) { truncated = true; return; }
      const layerName = e.layer === '0' && inheritedLayer ? inheritedLayer : e.layer;
      const layer = document.layers[layerName];
      if (e.isVisible === false || layer?.isVisible === false || layer?.isFrozen || e.isInPaperSpace) continue;
      if (e.kind === 'insert') {
        const name = e.blockName || e.name, block = document.blocks[name];
        if (block && parents.length < 16 && !parents.includes(name)) visit(block.entities, multiply(matrix, insertMatrix(e, block.basePoint)), [...parents, name], layerName);
        continue;
      }
      if (e.kind === 'line') {
        add(e.startPoint, matrix, 'Koniec'); add(e.endPoint, matrix, 'Koniec');
        if (e.startPoint && e.endPoint) add({ x: (e.startPoint.x+e.endPoint.x)/2, y: (e.startPoint.y+e.endPoint.y)/2 }, matrix, 'Środek');
      }
      if (['polyline', 'solid'].includes(e.kind)) {
        const vertices = e.vertices || e.points || [];
        for (let i = 0; i < vertices.length; i++) {
          add(vertices[i], matrix, 'Wierzchołek');
          const b = vertices[i+1] || (e.isClosed ? vertices[0] : null);
          if (b && !vertices[i].bulge) add({ x: (vertices[i].x+b.x)/2, y: (vertices[i].y+b.y)/2 }, matrix, 'Środek');
        }
      }
      if (['circle', 'arc', 'ellipse'].includes(e.kind)) add(e.center, matrix, 'Środek');
      if (e.center && e.radius && ['circle', 'arc'].includes(e.kind)) {
        const angles = e.kind === 'circle' ? [0, Math.PI/2, Math.PI, Math.PI*1.5] : [e.startAngle, e.endAngle];
        for (const a of angles) if (Number.isFinite(a)) add({ x: e.center.x + Math.cos(a)*e.radius, y: e.center.y + Math.sin(a)*e.radius }, matrix, e.kind === 'circle' ? 'Kwadrant' : 'Koniec łuku');
      }
      if (e.kind === 'point') add(e.insertionPoint || e.position || e.startPoint, matrix, 'Punkt');
    }
  };
  visit(document.entities, identity, [], null);
  return { points, truncated };
}
export function buildSnapIndex(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  return (point, tolerance) => {
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid].x < point.x - tolerance) lo = mid + 1; else hi = mid; }
    let best = null, distance = tolerance;
    for (let i = lo; i < sorted.length && sorted[i].x <= point.x + tolerance; i++) {
      const p = sorted[i]; if (Math.abs(p.y - point.y) > distance) continue;
      const d = Math.hypot(p.x-point.x, p.y-point.y);
      if (d <= distance) { distance = d; best = p; }
    }
    return best;
  };
}
export function measurementsCSV(items, drawingUnit, displayUnit) {
  const num = n => String(n).replace('.', ',');
  const unit = drawingUnit === 'unit' ? 'j. rys.' : UNITS[displayUnit].label;
  const rows = [['Pomiar','Odcinek','Odległość','Jednostka','Narastająco','Suma pomiaru','Delta X','Delta Y','Kąt XY [stopnie]','A X [j. rys.]','A Y [j. rys.]','B X [j. rys.]','B Y [j. rys.]','Stan']];
  const value=n=>num(convert(n,drawingUnit,displayUnit));let grandTotal=0;
  items.forEach((item, i) => {
    const path=measurePath(item.points);grandTotal+=path.total;
    path.segments.forEach((m,j)=>rows.push([i+1,j+1,value(m.distance),unit,value(m.cumulative),value(path.total),value(m.dx),value(m.dy),num(m.angle),num(m.a.x),num(m.a.y),num(m.b.x),num(m.b.y),item.complete?'Zakończony':'W trakcie']));
  });
  rows.push(['SUMA POMIARÓW','',value(grandTotal),unit]);
  return rows.map(row => row.join(';')).join('\r\n');
}
