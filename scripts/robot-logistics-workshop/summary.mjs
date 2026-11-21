// Compact diagnostics for a native report of the robot logistics workshop:
//   node scripts/robot-logistics-workshop/summary.mjs [path/to/native-report.json]
import fs from 'node:fs/promises';
const file=process.argv[2]||'blueprint-sources/robot-logistics-workshop/native-report.json';
const report=JSON.parse(await fs.readFile(file));
const r=report.builds[0],min=report.measurementMinutes;
const fmt=v=>typeof v==='number'?Math.round(v*100)/100:v;
const rates=o=>JSON.stringify(Object.fromEntries(Object.entries(o).map(([k,v])=>[k,fmt(v)])));
console.log('passed',report.passed,'sha',r.blueprintSha256?.slice(0,8),'minutes',report.warmupMinutes,'+',min);
console.log('steady  ',rates(r.outputsPerMinute));
if(r.recovery)console.log('recovery',rates(r.recovery.outputsPerMinute),'closed',JSON.stringify(r.recovery.collectionPauseStock?.map(p=>p.item+':'+p.count)));
for(const t of r.independentStockCapTests||[])console.log('selective',t.blockedProduct.padEnd(22),'stock',t.finalBlockedStock,rates(t.outputsPerMinute));
const by={};for(const m of r.machines)(by[m.recipe]??=[]).push(m);
for(const[recipe,list]of Object.entries(by)){
 const total=list.reduce((a,m)=>a+m.measuredCrafts,0);
 const st=list.map(m=>{const s=m.statusSamples||{};const n=Object.values(s).reduce((a,b)=>a+b,0)||1;return Object.entries(s).filter(([,v])=>v/n>=.05).map(([k,v])=>k.replace('item_ingredient_shortage','short').replace('fluid_ingredient_shortage','fluidshort').replace('full_output','full').replace('working','w')+':'+Math.round(100*v/n)).join(',');});
 console.log(recipe.padEnd(24),'crafts/min',String(fmt(total/min)).padEnd(7),JSON.stringify(list.map(m=>m.measuredCrafts)),st.join(' | '));
}
const loop=Object.values(r.loopSamples||{})[0];
console.log('ring max',loop?.maxStock,'of',loop?.capacity);
console.log('ring last',JSON.stringify(Object.fromEntries((loop?.lastSignals||[]).filter(s=>s.signal.type!=='virtual').map(s=>[s.signal.name,s.count]))));
console.log('inputs',JSON.stringify(r.inputs.map(p=>[p.item,Math.round(p.acceptedDuringMeasurement/min),!!p.productiveRoute?.length])),'fluids',JSON.stringify(r.fluids.map(p=>[p.item,Math.round(p.acceptedDuringMeasurement/min),p.productiveConsumers?.length])));
console.log('consumption',rates(r.consumptionPerMinute||{}),'bulk max hands',JSON.stringify(r.bulkInserters.map(b=>b.observedMaxHand)));
