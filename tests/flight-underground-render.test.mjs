import test from 'node:test';
import assert from 'node:assert/strict';
import {undergroundTunnelSvg} from '../scripts/flight-underground-render.mjs';
const blueprint={entities:[{entity_number:1,name:'fast-underground-belt',type:'input',position:{x:.5,y:1.5}},{entity_number:9,name:'fast-underground-belt',type:'output',position:{x:7.5,y:1.5}}]};
test('underground schematic uses exact endpoint positions, ignoring stale plan coordinates',()=>{
 const svg=undergroundTunnelSvg(blueprint,[{inputEntityNumber:1,outputEntityNumber:9,inputPosition:{x:99,y:99}}]);
 assert(svg.includes('M0.5 1.5L7.5 1.5'));assert(svg.includes('stroke-dasharray'));assert(!svg.includes('99'));
});
test('rendering rejects missing or reversed underground endpoints',()=>{
 assert.throws(()=>undergroundTunnelSvg(blueprint,[{inputEntityNumber:9,outputEntityNumber:1}]));
 assert.throws(()=>undergroundTunnelSvg(blueprint,[{inputEntityNumber:1,outputEntityNumber:999}]));
 assert.equal(undergroundTunnelSvg(blueprint), '');
});
