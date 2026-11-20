// Compact diagnostics for a native or exploration report:
//   node scripts/robot-essentials/summary.mjs [.cache/robot-essentials/explore-report.json]
import fs from 'node:fs/promises';
const file=process.argv[2]||'.cache/robot-essentials/explore-report.json';
const report=JSON.parse(await fs.readFile(file));
const r=report.builds[0],min=report.measurementMinutes;
const fmt=v=>typeof v==='number'?Math.round(v*100)/100:v;
console.log('passed',report.passed,'short',report.short,'protocol',JSON.stringify(report.protocolMinutes));
console.log('checks',JSON.stringify(r.checks));
console.log('steady  ',JSON.stringify(Object.fromEntries(Object.entries(r.outputsPerMinute).map(([k,v])=>[k,fmt(v)]))));
if(r.recovery)console.log('recovery',JSON.stringify(Object.fromEntries(Object.entries(r.recovery.outputsPerMinute).map(([k,v])=>[k,fmt(v)]))),'pause',JSON.stringify(r.recovery.collectionPauseStock?.map(p=>p.item+':'+p.count)));
for(const t of r.independentStockCapTests||[])console.log('selective',t.blockedProduct,'stock',t.finalBlockedStock,JSON.stringify(Object.fromEntries(Object.entries(t.outputsPerMinute).map(([k,v])=>[k,fmt(v)]))));
const by={};for(const m of r.machines)(by[m.recipe]??=[]).push(m);
for(const[recipe,list]of Object.entries(by)){
 const total=list.reduce((a,m)=>a+m.measuredCrafts,0);
 const st=list.map(m=>{const s=m.statusSamples||{};const n=Object.values(s).reduce((a,b)=>a+b,0)||1;return Object.entries(s).filter(([,v])=>v/n>=.05).map(([k,v])=>k.replace('item_ingredient_shortage','short').replace('fluid_ingredient_shortage','fluidshort').replace('full_output','full').replace('working','w')+':'+Math.round(100*v/n)).join(',');});
 console.log(recipe.padEnd(24),'crafts/min',String(fmt(total/min)).padEnd(6),'per machine',JSON.stringify(list.map(m=>m.measuredCrafts)),st.join(' | '),list.some(m=>m.missing&&Object.keys(m.missing).length)?'missing '+list.map(m=>JSON.stringify(m.missing||{})).join(' '):'');
}
const loop=Object.values(r.loopSamples||{})[0];
console.log('ring max',loop?.maxStock,'of',loop?.capacity,'item max',JSON.stringify(r.ringItemMax));
console.log('ring last',JSON.stringify(Object.fromEntries((loop?.lastSignals||[]).map(s=>[s.signal.name,s.count]))));
console.log('tokens',JSON.stringify(r.tokenSamples));
console.log('inputs',JSON.stringify(r.inputs.map(p=>[p.item,Math.round(p.acceptedDuringMeasurement/min),!!p.productiveRoute?.length])),'fluids',JSON.stringify(r.fluids.map(p=>[p.item,Math.round(p.acceptedDuringMeasurement/min),p.productiveConsumers?.length])));
console.log('consumption',JSON.stringify(Object.fromEntries(Object.entries(r.consumptionPerMinute||{}).map(([k,v])=>[k,fmt(v)]))),'bulk',JSON.stringify(r.bulkInserters.map(b=>b.observedMaxHand)));
