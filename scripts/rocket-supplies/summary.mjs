// Compact diagnostics for a native or exploration report:
//   node scripts/rocket-supplies/summary.mjs [.cache/rocket-supplies/explore-report.json]
import fs from 'node:fs/promises';
const file=process.argv[2]||'.cache/rocket-supplies/explore-report.json';
const report=JSON.parse(await fs.readFile(file));
const r=report.builds[0],min=report.protocolMinutes.measureMinutes;
const fmt=v=>typeof v==='number'?Math.round(v*100)/100:v;
const obj=o=>JSON.stringify(Object.fromEntries(Object.entries(o||{}).map(([k,v])=>[k,fmt(v)])));
console.log('passed',report.passed,'short',!!report.short,'saturated',!!report.saturated,'protocol',JSON.stringify(report.protocolMinutes));
console.log('checks',JSON.stringify(r.checks));
console.log('steady  ',obj(r.outputsPerMinute));
if(r.recovery)console.log('recovery',obj(r.recovery.outputsPerMinute));
if(r.blocked){
 console.log('blocked chests',JSON.stringify(r.blocked.collectionPauseStock?.map(p=>p.item+':'+p.count+'/'+p.capacity+' max '+p.maxDuringBlocked)),'machines stopped',r.blocked.machinesStoppedInLastMinute);
 console.log('blocked acceptance',JSON.stringify(r.blocked.entranceAcceptance?.map(a=>[a.item,fmt(a.blocked),fmt(a.inStopWindow),fmt(a.inLastMinute)])));
 console.log('chest series',JSON.stringify(Object.fromEntries(Object.entries(r.blocked.chestSeries||{}).map(([k,v])=>[k,v.map(s=>s.count).join(' ')]))));
 console.log('machines at block end',JSON.stringify(r.blocked.machinesAtBlockEnd?.map(m=>[m.recipe,m.craftsInLastMinute,m.status])));
}
const by={};for(const m of r.machines)(by[m.recipe]??=[]).push(m);
for(const[recipe,list]of Object.entries(by)){
 const total=list.reduce((a,m)=>a+m.measuredCrafts,0);
 const st=list.map(m=>{const s=m.statusSamples||{};const n=Object.values(s).reduce((a,b)=>a+b,0)||1;return Object.entries(s).filter(([,v])=>v/n>=.05).map(([k,v])=>k.replace('item_ingredient_shortage','short').replace('fluid_ingredient_shortage','fluidshort').replace('full_output','full').replace('working','w')+':'+Math.round(100*v/n)).join(',');});
 console.log(recipe.padEnd(22),'crafts/min',String(fmt(total/min)).padEnd(6),JSON.stringify(list.map(m=>m.measuredCrafts)),st.join(' | '),list.some(m=>m.missing)?'missing '+list.map(m=>JSON.stringify(m.missing||{})).join(' '):'');
}
const loop=Object.values(r.loopSamples||{})[0];
console.log('ring max',loop?.maxStock,'of',loop?.capacity,'item max',JSON.stringify(r.ringItemMax));
console.log('ring last',JSON.stringify(Object.fromEntries((loop?.lastSignals||[]).map(s=>[s.signal.name,s.count]))));
console.log('inputs',JSON.stringify(r.inputs.map(p=>[p.item,fmt(p.measuredPerMinute),p.perMinute,!!p.productiveRoute?.length])),'fluids',JSON.stringify(r.fluids.map(p=>[p.item,fmt(p.measuredPerMinute),p.perMinute,p.productiveConsumers?.length])));
if(r.pacing)console.log('pacing',JSON.stringify(r.pacing));
const armStatus={};for(const a of r.arms||[]){const s=a.statusSamples||{};const n=Object.values(s).reduce((x,y)=>x+y,0)||1;armStatus[a.entity]=Object.entries(s).filter(([,v])=>v/n>=.2).map(([k,v])=>k+':'+Math.round(100*v/n)).join(',');}
if(process.env.ARMS)console.log('arms',JSON.stringify(armStatus));
