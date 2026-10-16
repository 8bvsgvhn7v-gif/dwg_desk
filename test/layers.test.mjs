import {dxfForViewer} from '../src/dxf-encoding.js';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {DxfLoader} from '@flyfish-dev/cad-viewer';import {restoreDxfLayers} from '../src/layers.js';
test('real DXF parser layer table survives normalization with its colors',async()=>{
 const result=await new DxfLoader().load({buffer:dxfForViewer(await readFile('public/demo.dxf'),'demo.dxf'),fileName:'demo.dxf'});
 const doc=restoreDxfLayers(result.document,result.raw);assert.ok(doc.layers['ŚCIANY']);assert.equal(doc.layers.OKNA.colorIndex,4);assert.equal(doc.layers.WYMIARY.colorIndex,3);assert.equal(doc.layers['ŚCIANY'].isVisible,true);
});
test('DWG layer aliases share one canonical name and visibility, including block entities',()=>{
 const layer={name:'DWGDesk_Kamery',colorIndex:3,isVisible:false};
 const doc=restoreDxfLayers({format:'dwg',layers:{DWGDesk_Kamery:layer,dwgdesk_kamery:layer},entities:[{layer:'DWGDesk_Kamery'}],blocks:{symbol:{entities:[{layer:'dwgdesk_kamery'}]}}});
 assert.deepEqual(Object.keys(doc.layers),['DWGDesk_Kamery']);
 assert.equal(doc.entities[0].layer,doc.blocks.symbol.entities[0].layer);
 assert.equal(doc.layers[doc.blocks.symbol.entities[0].layer].isVisible,false);
});
