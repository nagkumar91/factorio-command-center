import {buildTransportWorkshopRecords,publishTransportWorkshops,withTransportPublicationLock} from './transport-workshop-publication.mjs';
import '../site/lib/production.js';

/**
 * Index transport workshops for the atlas and publish the same verified
 * records to the per-workshop publication index as one locked operation.
 * The returned records remain ordinary atlas records; publication metadata is
 * kept in the separate site/data/transport-workshops index.
 */
export async function indexTransportWorkshops(catalog,production){
 const built=await withTransportPublicationLock({},async()=>{
  const next=await buildTransportWorkshopRecords(catalog,production);
  const publication=await publishTransportWorkshops({
   records:next.records,
   assets:next.assets,
   validated:next.validated,
   sourceRoot:next.sourceRoot,
   siteRoot:'site',
   cacheRoot:'.cache/transport-workshops',
   lockHeld:true
  });
  const revisions=new Map(publication.index.blueprints.map(entry=>[entry.id,entry.revision]));
  return {records:publication.records.map(record=>({...record,publicationRevision:revisions.get(record.id)}))};
 });
 return {blueprints:built.records,sources:[{id:'transport-workshops',author:'Factorio Command Center · original transport workshops',url:'sources/transport-workshops/README.md'}]};
}
