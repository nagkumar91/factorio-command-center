import fs from 'node:fs/promises';
import {decodeBlueprint,encodeBlueprint} from './blueprints.mjs';
import {compactStarterLayout,starterPowerNote,starterConnectionNote} from './compact-starter-layout.mjs';
const root='blueprint-sources/early-game';
const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW||'.cache/factorio-vanilla/script-output/data-raw-dump.json'));
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json'));
for(const info of manifest){
 const object=decodeBlueprint(await fs.readFile(root+'/'+info.file,'utf8'));
 const previous=info.compaction,result=compactStarterLayout(object.blueprint,info.ports,raw);
 info.compaction={...result,before:previous?.before||result.before,polesBefore:previous?.polesBefore||result.polesBefore,cuts:{columns:(previous?.cuts.columns||0)+result.cuts.columns,rows:(previous?.cuts.rows||0)+result.cuts.rows}};
 info.powerNetwork={connection:'big-electric-pole',distribution:'medium-electric-pole',research:'electric-energy-distribution-1'};
 info.setupNotes=info.setupNotes.map(n=>n.startsWith('Connect external electricity')?starterPowerNote:n.startsWith('The raw entrances use')||n.startsWith('Follow the A–G input displays')?starterConnectionNote:n);
 await fs.writeFile(root+'/'+info.file,encodeBlueprint(object)+'\n');
}
await fs.writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
// This shared updater also resolves construction research and rebuilds the
// descriptions and research-stage grouping from the saved entities.
await import('./upgrade-early-game-machines.mjs');
console.log('Compacted all '+manifest.length+' modules with big/medium poles. Run native tests and indexing next.');
