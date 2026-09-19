import fs from 'node:fs/promises';
import {buildTransportWorkshopRecords,publishTransportWorkshops,withTransportPublicationLock} from './transport-workshop-publication.mjs';
import '../site/lib/production.js';

const ids=process.argv.slice(2).flatMap(value=>value.split(',')).map(value=>value.trim()).filter(Boolean);
const [catalog,production]=await Promise.all([
 JSON.parse(await fs.readFile('site/data/catalog.json','utf8')),
 JSON.parse(await fs.readFile('site/data/production.json','utf8'))
]);

const result=await withTransportPublicationLock({},async()=>{
 const built=await buildTransportWorkshopRecords(catalog,production,{ids:ids.length?ids:undefined});
 return publishTransportWorkshops({
  records:built.records,
  assets:built.assets,
  validated:built.validated,
  sourceRoot:built.sourceRoot,
  siteRoot:'site',
  cacheRoot:'.cache/transport-workshops',
  lockHeld:true
 });
});

console.log(JSON.stringify({
 published:result.blueprints.map(({id,name,colour,revision,url,blueprintSha256})=>({id,name,colour,revision,url,blueprintSha256})),
 revision:result.index.revision
},null,2));
