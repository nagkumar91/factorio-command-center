import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

export const ROUTES=new Set(['commands','crates','blueprints','coverage','production','files','setup']);
export const EVENTS=new Set(['page_view','blueprint_open','blueprint_copy','construction_crate','command_view','command_copy','crate_generate','crate_pack','production_plan','product_view','plan_export','loadout_export','source_download','search_used']);
const uuid=/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
const day=86400000;

export function createStore({dbPath,labels={blueprints:{},products:{},files:{}},now=Date.now}){
 let salt;
 if(dbPath===':memory:')salt=randomBytes(32).toString('hex');
 else{
  fs.mkdirSync(path.dirname(dbPath),{recursive:true,mode:0o700});
  const saltPath=dbPath+'.salt';
  try{salt=fs.readFileSync(saltPath,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;salt=randomBytes(32).toString('hex');fs.writeFileSync(saltPath,salt,{mode:0o600,flag:'wx'});}
 }
 const db=new DatabaseSync(dbPath);
 if(dbPath!==':memory:')fs.chmodSync(dbPath,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, ts INTEGER NOT NULL, visitor TEXT NOT NULL, session TEXT NOT NULL, event TEXT NOT NULL, route TEXT NOT NULL, target TEXT NOT NULL, origin TEXT NOT NULL, device TEXT NOT NULL, referrer TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
 CREATE INDEX IF NOT EXISTS events_type_ts ON events(event,ts);`);
 const insert=db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?,?,?,?,?)');
 const hash=value=>createHash('sha256').update(salt+value).digest('hex');
 let lastPrune=0;
 function prune(){if(now()-lastPrune>day){db.prepare('DELETE FROM events WHERE ts < ?').run(now()-90*day);lastPrune=now();}}
 function validate(payload,origin){
  if(!payload||payload.version!==1||typeof payload.visitor!=='string'||typeof payload.session!=='string'||!uuid.test(payload.visitor)||!uuid.test(payload.session)||!Array.isArray(payload.events)||!payload.events.length||payload.events.length>20)throw new Error('Invalid batch');
  if(!['desktop','tablet','mobile'].includes(payload.device))throw new Error('Invalid device');
  const referrer=payload.referrer||'';
  if(typeof referrer!=='string'||referrer.length>253||!/^$|^[a-z0-9.-]+$/i.test(referrer))throw new Error('Invalid referrer');
  return payload.events.map(e=>{
   if(!e||typeof e.id!=='string'||!uuid.test(e.id)||!EVENTS.has(e.event)||!ROUTES.has(e.route)||typeof(e.target??'')!=='string')throw new Error('Invalid event');
   const target=e.target||'';
   let allowed=[''];
   if(['blueprint_open','blueprint_copy','construction_crate'].includes(e.event))allowed=Object.keys(labels.blueprints);
   if(e.event==='product_view')allowed=Object.keys(labels.products);
   if(e.event==='production_plan')allowed=['raw','plates','supplies','products','solar','robots','circuits','custom'];
   if(e.event==='crate_pack')allowed=['blueprint','raw','targets','preset'];
   if(e.event==='source_download')allowed=Object.keys(labels.files);
   if(e.event==='search_used')allowed=['command-search','item-search','blueprint-search','coverage-search','file-search','production-item'];
   if(!allowed.includes(target))throw new Error('Invalid target');
   return [e.id,now(),hash(payload.visitor),hash(payload.session),e.event,e.route,target,origin,payload.device,referrer.toLowerCase()];
  });
 }
 function ingest(payload,origin){
  const rows=validate(payload,origin);prune();let stored=0;
  db.exec('BEGIN');try{for(const row of rows)stored+=Number(insert.run(...row).changes);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  return stored;
 }
 function report(days=7){
  prune();days=[7,30,90].includes(Number(days))?Number(days):7;
  const date=new Date(now()),start=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())-(days-1)*day;
  const summary=db.prepare(`SELECT COUNT(DISTINCT visitor) visitors, COUNT(DISTINCT session) sessions, COALESCE(SUM(event='page_view'),0) pageViews, COALESCE(SUM(event!='page_view'),0) actions FROM events WHERE ts>=?`).get(start);
  const recent=db.prepare('SELECT COUNT(DISTINCT visitor) count FROM events WHERE ts>=?').get(now()-5*60000).count;
  const daily=db.prepare(`SELECT date(ts/1000,'unixepoch') day, COUNT(DISTINCT visitor) visitors, COALESCE(SUM(event='page_view'),0) views, COALESCE(SUM(event!='page_view'),0) actions FROM events WHERE ts>=? GROUP BY day ORDER BY day`).all(start);
  const dailyMap=new Map(daily.map(r=>[r.day,r]));
  const timeline=Array.from({length:days},(_,i)=>{const key=new Date(start+i*day).toISOString().slice(0,10);return dailyMap.get(key)||{day:key,visitors:0,views:0,actions:0};});
  const pages=db.prepare(`SELECT route name, COUNT(*) count FROM events WHERE ts>=? AND event='page_view' GROUP BY route ORDER BY count DESC`).all(start);
  const actions=db.prepare(`SELECT event name, COUNT(*) count FROM events WHERE ts>=? AND event!='page_view' GROUP BY event ORDER BY count DESC`).all(start);
  const blueprints=db.prepare(`SELECT target id, SUM(event='blueprint_open') opens, SUM(event='blueprint_copy') copies, SUM(event='construction_crate') crates FROM events WHERE ts>=? AND event IN ('blueprint_open','blueprint_copy','construction_crate') GROUP BY target ORDER BY copies DESC,opens DESC LIMIT 20`).all(start).map(r=>({...r,name:labels.blueprints[r.id]||r.id}));
  const devices=db.prepare('SELECT device name, COUNT(DISTINCT session) count FROM events WHERE ts>=? GROUP BY device ORDER BY count DESC').all(start);
  const sources=db.prepare(`SELECT CASE WHEN referrer='' THEN 'Direct / unknown' ELSE referrer END name, COUNT(DISTINCT session) count FROM events WHERE ts>=? GROUP BY referrer ORDER BY count DESC LIMIT 15`).all(start);
  const sites=db.prepare('SELECT origin name, COUNT(DISTINCT session) count FROM events WHERE ts>=? GROUP BY origin ORDER BY count DESC').all(start);
  const activity=db.prepare('SELECT ts,event,route,target FROM events WHERE ts>=? ORDER BY ts DESC LIMIT 30').all(start).map(r=>({...r,target:labels.blueprints[r.target]||labels.products[r.target]||labels.files[r.target]||r.target}));
  const firstEvent=db.prepare('SELECT MIN(ts) first FROM events').get().first;
  return{days,generatedAt:now(),firstEvent,summary:{...summary,recent},timeline,pages,actions,blueprints,devices,sources,sites,activity};
 }
 return{ingest,report,close:()=>db.close()};
}
