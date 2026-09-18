import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createStore} from './store.mjs';

export async function loadLabels(siteDir){
 const read=async name=>JSON.parse(await fs.readFile(path.join(siteDir,'data',name+'.json'),'utf8'));
 const [library,community,atlas,catalog]=await Promise.all(['library','community','atlas','catalog'].map(read));
 const blueprints=[...library.blueprints,...community.blueprints,...atlas.blueprints];
 return{blueprints:Object.fromEntries(blueprints.map(b=>[b.id,b.name])),products:Object.fromEntries([...catalog.items,...catalog.fluids,...atlas.coverage.items.filter(i=>i.internal)].map(i=>[i.id,i.name])),files:Object.fromEntries([...library.files.map(f=>[f.url,f.name]),...blueprints.flatMap(b=>(b.sources||[]).filter(s=>s.startsWith('sources/')).map(s=>[s,b.name])),...atlas.sources.map(s=>['sources/collections/'+s.id+'.txt',s.id]),['sources/Autosaved/AllBlueprints.txt','Autosaved complete book']])};
}
export function createHandlers({store,allowedOrigins,dashboard,adminHosts=['127.0.0.1','localhost','[::1]'],now=Date.now}){
 const origins=new Set(allowedOrigins),limits=new Map();
 const send=(res,status,data,headers={})=>{res.writeHead(status,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(data);};
 const json=(res,status,data,headers={})=>send(res,status,JSON.stringify(data),{'Content-Type':'application/json; charset=utf-8',...headers});
 async function collector(req,res){
  const route=new URL(req.url,'http://localhost').pathname;
  if(route==='/healthz'&&req.method==='GET'){json(res,200,{ok:true});return;}
  if(!['/collect','/factorio-metrics/collect'].includes(route)){json(res,404,{error:'Not found'});return;}
  const origin=req.headers.origin;
  if(!origins.has(origin)){json(res,403,{error:'Origin not allowed'});return;}
  const cors={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if(req.method==='OPTIONS'){send(res,204,null,cors);return;}
  if(req.method!=='POST'){json(res,405,{error:'POST required'},cors);return;}
  if(!/^(application\/json|text\/plain)(;|$)/i.test(req.headers['content-type']||'')){json(res,415,{error:'Unsupported content type'},cors);return;}
  // Addresses are used transiently for rate limiting and never written to the database.
  const key=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim();
  for(const [k,v] of limits)if(v.until<now())limits.delete(k);
  let rate=limits.get(key);if(!rate){if(limits.size>=10000){json(res,429,{error:'Try later'},cors);return;}rate={count:0,until:now()+60000};limits.set(key,rate);}
  if(++rate.count>120){json(res,429,{error:'Rate limit'},cors);return;}
  try{
   if(Number(req.headers['content-length'])>32768){json(res,413,{error:'Batch too large'},cors);req.resume();return;}
   let body='';for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>32768){json(res,413,{error:'Batch too large'},cors);req.resume();return;}}
   const stored=store.ingest(JSON.parse(body),origin);json(res,202,{accepted:stored},cors);
  }catch{json(res,400,{error:'Invalid analytics batch'},cors);}
 }
 async function admin(req,res){
  // Reject arbitrary Host headers so a website cannot use DNS rebinding to read reports.
  let hostname;try{hostname=new URL('http://'+req.headers.host).hostname;}catch{}
  if(!adminHosts.includes(hostname)){json(res,403,{error:'Host not allowed'});return;}
  const url=new URL(req.url,'http://localhost');
  if(req.method!=='GET'){json(res,405,{error:'GET required'});return;}
  if(url.pathname==='/api/report'){json(res,200,store.report(url.searchParams.get('days')));return;}
  if(url.pathname==='/'||url.pathname==='/index.html'){send(res,200,dashboard,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});return;}
  json(res,404,{error:'Not found'});
 }
 return{collector,admin};
}
async function main(){
 const siteDir=process.env.SITE_DIR||fileURLToPath(new URL('../site',import.meta.url));
 const dbPath=process.env.ANALYTICS_DB||path.join(os.homedir(),'.local/share/factorio-command-center/analytics.sqlite');
 const store=createStore({dbPath,labels:await loadLabels(siteDir)});
 const dashboard=await fs.readFile(new URL('./dashboard.html',import.meta.url),'utf8');
 const allowedOrigins=(process.env.ANALYTICS_ORIGINS||'https://nagkumar91.github.io,http://192.168.155.109:18090,http://100.71.219.83:18090,http://openclaw-pi5.tailacf455.ts.net:18090').split(',');
 const adminHost=process.env.ANALYTICS_ADMIN_HOST||'127.0.0.1';
 if(['0.0.0.0','::'].includes(adminHost))throw new Error('Bind the analytics dashboard to loopback or a Tailscale address.');
 const adminHosts=[adminHost,...(process.env.ANALYTICS_ADMIN_NAMES||'localhost').split(',')];
 const handlers=createHandlers({store,allowedOrigins,dashboard,adminHosts});
 const collector=http.createServer(handlers.collector),admin=http.createServer(handlers.admin);
 collector.listen(Number(process.env.ANALYTICS_COLLECTOR_PORT||18092),'127.0.0.1');
 admin.listen(Number(process.env.ANALYTICS_ADMIN_PORT||18091),adminHost);
 for(const server of [collector,admin]){server.requestTimeout=10000;server.headersTimeout=10000;server.on('error',error=>{console.error(error.code);process.exit(1);});}
 console.log('Analytics collector and private dashboard started.');
 process.on('SIGTERM',()=>{collector.close();admin.close(()=>{store.close();process.exit(0);});});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
