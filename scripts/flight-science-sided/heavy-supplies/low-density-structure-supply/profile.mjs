// Locates the family's flight-save game profile: mods/ plus script-output/data-raw-dump.json.
// The family's own validator uses <project>/.cache/flight-21; FLIGHT_PROFILE overrides it, and a private
// copy under .cache/heavy-supplies/flight-21 is accepted as well.
import fs from 'node:fs';
import path from 'node:path';

export function profileCandidates(root){
 return [process.env.FLIGHT_PROFILE,path.join(root,'.cache/flight-21'),path.join(root,'.cache/heavy-supplies/flight-21')].filter(Boolean);
}
const readable=p=>{try{fs.closeSync(fs.openSync(p,'r'));return true;}catch{return false;}};
export function findProfile(root){
 for(const dir of profileCandidates(root)){const raw=path.join(dir,'script-output/data-raw-dump.json');if(readable(raw))return {dir,raw,mods:path.join(dir,'mods')};}
 return null;
}
export async function resolveProfile(root){
 const found=findProfile(root);
 if(!found)throw Error('Flight-save prototype dump not found; looked in '+profileCandidates(root).join(', '));
 return found;
}
