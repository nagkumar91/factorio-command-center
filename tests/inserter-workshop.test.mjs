import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const root=new URL('../blueprint-sources/inserter-workshop/',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
test('frozen inserter mall has matching native production, independent caps and demand recovery',async()=>{
 const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root)));assert.equal(manifest.length,1);const [m]=manifest;
 const code=(await fs.readFile(new URL(m.file,root),'utf8')).trim();assert.equal(sha(code),m.blueprintSha256);
 const b=decodeBlueprint(code).blueprint;assert.equal(b.entities.filter(e=>e.name==='assembling-machine-2').length,13);
 assert.deepEqual(m.inputs.map(p=>p.item).sort(),['copper-plate','iron-plate','plastic-bar']);assert(m.inputs.every(p=>p.externalSide==='west'));assert(m.outputs.every(p=>p.externalSide==='east'));
 assert(b.entities.every(e=>!e.items?.length&&!e.name.startsWith('express-')&&e.name!=='stack-inserter'));
 const report=JSON.parse(await fs.readFile(new URL('native-report.json',root)));assert.equal(report.harnessSha256,sha(await fs.readFile(new URL('../scripts/inserter-workshop/control.lua',import.meta.url))));assert.equal(report.validatorSha256,sha(await fs.readFile(new URL('../scripts/inserter-workshop/validate.mjs',import.meta.url))));assert(report.passed);const [r]=report.builds;assert.equal(r.blueprintSha256,m.blueprintSha256);assert.equal(report.prototypeSha256,m.prototypeSha256);
 assert(r.powered&&r.externalApproachesClear&&r.stockGateChecks>0);assert(r.inputs.every(p=>p.acceptedDuringMeasurement>0&&p.productiveRoute.length));assert(r.machines.every(p=>p.measuredCrafts>0));
 for(const n of m.products){assert(r.outputsPerMinute[n]>=m.targets[n]*.95);assert(r.recovery.outputsPerMinute[n]>=m.targets[n]*.95);const port=m.outputs.find(p=>p.item===n);assert.equal(port.cap,m.outputCaps[n]);const stock=r.stockReplenishment.find(s=>s.item===n);assert.equal(stock.restored,port.cap);assert(stock.newCrafts>0&&stock.otherProvidersStayedFull);}
 assert.equal(r.inserterCapacityResearch.fast,0);assert.equal(r.inserterCapacityResearch.bulkUnlockBonus,1);assert(r.bulkInserters.some(p=>p.observedMaxHand===2));assert(r.bulkInserters.every(p=>p.observedMaxHand<=2));
});
