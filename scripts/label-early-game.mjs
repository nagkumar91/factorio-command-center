import fs from 'node:fs/promises';
import {decodeBlueprint,encodeBlueprint} from './blueprints.mjs';
import {addInputDisplays} from './starter-input-displays.mjs';
const root='blueprint-sources/early-game';
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json'));
let count=0;
for(const info of manifest){
 const object=decodeBlueprint(await fs.readFile(root+'/'+info.file,'utf8'));
 addInputDisplays(object.blueprint,info);
 count+=info.ports.filter(p=>p.displayEntity).length;
 await fs.writeFile(root+'/'+info.file,encodeBlueprint(object)+'\n');
}
await fs.writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Added '+count+' input displays to '+manifest.length+' modules. Run native verification and index:atlas before publishing.');
