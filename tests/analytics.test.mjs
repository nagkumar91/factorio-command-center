import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {createStore} from '../analytics/store.mjs';
import {createHandlers,loadLabels} from '../analytics/server.mjs';

const labels={blueprints:{mall:'Robot mall'},products:{roboport:'Roboport'},files:{'sources/mall.txt':'Robot mall source'}};
const origin='https://example.test';
const event=(name='page_view',target='')=>({id:randomUUID(),event:name,route:'coverage',target});
const batch=(events=[event()],extra={})=>({version:1,visitor:randomUUID(),session:randomUUID(),device:'desktop',referrer:'',events,...extra});

test('analytics counts browsers, sessions, actions and blueprint conversions without exposing identifiers',()=>{
 const store=createStore({dbPath:':memory:',labels});
 try{
  const first=batch([event(),event('blueprint_open','mall'),event('blueprint_copy','mall'),event('construction_crate','mall')]);
  assert.equal(store.ingest({...first,search:'private text',ip:'203.0.113.1'},origin),4);
  assert.equal(store.ingest(first,origin),0,'retried IDs are deduplicated');
  store.ingest(batch([event()],{visitor:first.visitor}),origin);
  store.ingest(batch([event('production_plan','robots')]),origin);
  const report=store.report(7);
  assert.deepEqual({...report.summary},{visitors:2,sessions:3,pageViews:2,actions:4,recent:2});
  assert.deepEqual({...report.blueprints[0]},{id:'mall',name:'Robot mall',opens:1,copies:1,crates:1});
  for(const secret of [first.visitor,first.session,'private text','203.0.113.1'])assert.ok(!JSON.stringify(report).includes(secret));
  assert.equal(report.timeline.length,7);
  assert.equal(report.timeline.reduce((n,d)=>n+d.views,0),2);
 }finally{store.close();}
});

test('analytics accepts only bounded known events and target IDs, atomically',()=>{
 const store=createStore({dbPath:':memory:',labels});
 try{
  for(const invalid of [batch([]),batch(Array.from({length:21},()=>event())),batch([event('unknown')]),batch([event('blueprint_copy','private blueprint string')]),batch([event('search_used','my search text')]),batch([event()],{visitor:'not an id'}),batch([event()],{referrer:'https://example.com/path?secret=1'}),batch([{...event(),route:'coverage?secret=1'}]),batch([event(),event('product_view','unknown')])])assert.throws(()=>store.ingest(invalid,origin));
  assert.equal(store.report().summary.actions,0);
  assert.equal(store.report().summary.pageViews,0);
  assert.equal(store.ingest(batch([event('search_used','coverage-search'),event('product_view','roboport')]),origin),2);
 }finally{store.close();}
});

test('analytics expires records at 90 days and includes zero-activity days',()=>{
 let time=Date.UTC(2026,8,18,12);
 const store=createStore({dbPath:':memory:',labels,now:()=>time});
 try{
  store.ingest(batch(),origin);time+=8*86400000;
  assert.equal(store.report(7).summary.visitors,0);
  assert.equal(store.report(30).summary.visitors,1);
  time+=83*86400000;
  assert.equal(store.report(90).summary.visitors,0);
  assert.equal(store.report(90).firstEvent,null);
  assert.equal(store.report('arbitrary').days,7);
 }finally{store.close();}
});

test('public collector enforces origins and limits; private reports stay on a separate listener',async()=>{
 const store=createStore({dbPath:':memory:',labels});
 const handlers=createHandlers({store,allowedOrigins:[origin],dashboard:'<!doctype html><title>Private analytics</title>'});
 const collector=http.createServer(handlers.collector),admin=http.createServer(handlers.admin);
 await Promise.all([new Promise(r=>collector.listen(0,'127.0.0.1',r)),new Promise(r=>admin.listen(0,'127.0.0.1',r))]);
 const url='http://127.0.0.1:'+collector.address().port,privateUrl='http://127.0.0.1:'+admin.address().port;
 const post=(body,from=origin)=>fetch(url+'/factorio-metrics/collect',{method:'POST',headers:{Origin:from,'Content-Type':'text/plain'},body});
 try{
  assert.equal((await fetch(url+'/api/report')).status,404);
  assert.equal((await fetch(url+'/')).status,404);
  assert.equal((await post(JSON.stringify(batch()),'https://untrusted.test')).status,403);
  assert.equal((await post('invalid json')).status,400);
  assert.equal((await post('x'.repeat(33000))).status,413);
  const accepted=await post(JSON.stringify(batch()));assert.equal(accepted.status,202);assert.equal(accepted.headers.get('Access-Control-Allow-Origin'),origin);
  assert.deepEqual(await accepted.json(),{accepted:1});
  assert.equal((await fetch(url+'/collect',{method:'OPTIONS',headers:{Origin:origin}})).status,204);
  assert.equal((await fetch(privateUrl+'/api/report')).status,200);
  const badHostStatus=await new Promise((resolve,reject)=>http.get(privateUrl+'/api/report',{headers:{Host:'untrusted.test'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject));
  assert.equal(badHostStatus,403);
  const dashboard=await fetch(privateUrl+'/');assert.ok(dashboard.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  let status;for(let i=0;i<120;i++)status=(await post(JSON.stringify(batch()))).status;
  assert.equal(status,429);
 }finally{collector.closeAllConnections();admin.closeAllConnections();await Promise.all([new Promise(r=>collector.close(r)),new Promise(r=>admin.close(r))]);store.close();}
});

test('collector recognizes the published blueprint, internal item and source catalogue',async()=>{
 const actual=await loadLabels(new URL('../site',import.meta.url).pathname);
 assert.equal(Object.keys(actual.blueprints).length,840);
 assert.ok(actual.products['rocket-part']);
 assert.ok(actual.files['sources/Autosaved/AllBlueprints.txt']);
});
