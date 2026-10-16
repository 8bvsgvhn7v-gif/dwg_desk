// dxf-parser exposes tables.layer.layers as a name-keyed map. cad-viewer 0.8.3
// only expands arrays here, so preserve the original table in our adapter.
export function restoreDxfLayers(document, raw) {
  document.entities = document.entities.filter(entity => !entity.isInPaperSpace);
  if (document.format === 'dxf') {
    const layers = raw?.tables?.layer?.layers;
    if (layers && typeof layers === 'object') for (const [key, value] of Object.entries(layers)) {
      const name = value.name || key;
      document.layers[name] = {
        name, colorIndex:Math.abs(value.colorIndex ?? value.colorNumber ?? 7),
        trueColor:value.trueColor, lineType:value.lineType,
        isVisible:value.visible !== false && Number(value.colorIndex ?? value.colorNumber ?? 7) >= 0,
        isFrozen:!!value.frozen, isLocked:!!value.locked
      };
    }
  }
  // The DWG normalizer exposes both original-name and lowercase aliases.
  // Keep one canonical entry so the layer list and snap visibility agree.
  const canonical = new Map();
  for (const [key, layer] of Object.entries(document.layers)) {
    const name = layer.name || key;
    canonical.set(name.toLowerCase(), {...layer, name});
  }
  document.layers = Object.fromEntries([...canonical.values()].map(layer => [layer.name, layer]));
  // Malformed files sometimes reference a layer absent from the table.
  const entities = [...document.entities, ...Object.values(document.blocks).flatMap(b => b.entities)];
  for (const e of entities) if (e.layer) {
    const existing = canonical.get(e.layer.toLowerCase());
    if (existing) e.layer = existing.name;
    else {
      const layer = {name:e.layer,colorIndex:7,isVisible:true};
      document.layers[e.layer] = layer; canonical.set(e.layer.toLowerCase(), layer);
    }
  }
  return document;
}
