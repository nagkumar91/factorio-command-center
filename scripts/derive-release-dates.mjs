// One-off tool: derive blueprint-sources/release-dates.json from this repository's git history.
//
// RULE. A designed blueprint's release date is the earliest author date (UTC, to the minute) of any commit
// that added or changed a .txt file under factorio-command-center/ whose trimmed text hashes to the
// blueprint's blueprintSha256. The key is the string's hash, not the record id, so a re-released string
// (same id, new string) is a new release with its own date, and an unchanged string keeps its date.
//
// Run from the project folder after `npm run build` (it reads site/data/atlas.json), only when the file needs
// regenerating. Ordinary new blueprints just get one line added by hand, see tests/release-dates.test.mjs.
// Existing dates are kept: only hashes that have no date yet are added, so the file never drifts.
import fs from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const FILE='blueprint-sources/release-dates.json';
const atlas=JSON.parse(await fs.readFile('site/data/atlas.json','utf8'));
const wanted=new Map(atlas.blueprints.filter(b=>b.designedCollection&&b.blueprintSha256).map(b=>[b.blueprintSha256,b.name]));
const existing=await fs.readFile(FILE,'utf8').then(JSON.parse,()=>({}));
const need=new Set([...wanted.keys()].filter(sha=>!existing[sha]));

// Every added or modified .txt blob with the author date of the commit that introduced it.
const log=execFileSync('git',['log','--no-renames','--diff-filter=AM','--raw','-r','--no-abbrev','--format=C%x09%aI','--','.'],{encoding:'utf8',maxBuffer:1<<28});
const blobDate=new Map();let date;
for(const line of log.split('\n')){
 if(line.startsWith('C\t')){date=new Date(line.split('\t')[1]).toISOString().slice(0,16)+'Z';continue;}
 const m=line.match(/^:\d+ \d+ [0-9a-f]+ ([0-9a-f]+) [AM]\t(.+\.txt)$/);if(!m)continue;
 const old=blobDate.get(m[1]);if(!old||date<old)blobDate.set(m[1],date);
}
// Hash each distinct blob once, in a single cat-file stream.
const ids=[...blobDate.keys()];
const out=spawnSync('git',['cat-file','--batch'],{input:ids.join('\n')+'\n',maxBuffer:1<<30});
const buf=out.stdout,found=new Map();let at=0;
for(const id of ids){
 const nl=buf.indexOf(10,at),[,type,size]=buf.toString('utf8',at,nl).split(' ');
 if(type!=='blob'){at=nl+1;continue;}
 const body=buf.subarray(nl+1,nl+1+Number(size));at=nl+1+Number(size)+1;
 const sha=createHash('sha256').update(body.toString('utf8').trim()).digest('hex');
 if(need.has(sha)){const d=blobDate.get(id),old=found.get(sha);if(!old||d<old)found.set(sha,d);}
}
const missing=[...need].filter(sha=>!found.has(sha));
const merged={...existing,...Object.fromEntries(found)};
const sorted=Object.fromEntries(Object.entries(merged).sort(([a,x],[b,y])=>x.localeCompare(y)||a.localeCompare(b)));
await fs.writeFile(FILE,'{\n'+Object.entries(sorted).map(([k,v])=>` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')+'\n}\n');
console.log(JSON.stringify({designed:wanted.size,alreadyDated:wanted.size-need.size,derived:found.size,missing:missing.map(sha=>({sha,name:wanted.get(sha)}))},null,1));
