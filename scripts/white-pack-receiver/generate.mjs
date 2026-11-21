// White-pack receiver: one cargo landing pad that already requests space science packs, one fast inserter,
// one passive provider chest (10 stacks = 2,000 packs), one substation. Built on Nauvis under a platform
// holding packs, the platform drops a cargo pod every 30 s with what the pad lacks; nothing to click.
// Crafts nothing. Qualified by the white-platform end-to-end run (scripts/white-platform/validate.mjs).
//
// Pure Node and reproducible. Usage: node scripts/white-pack-receiver/generate.mjs [--out dir]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerFiveLayout} from '../five-science/power.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const id='white-pack-receiver',out=flag('out',process.env.WR_OUT||'blueprint-sources/'+id);
await fs.mkdir('.cache/'+id,{recursive:true});
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');
const boundsRaw={...raw,container:{...raw.container,...raw['logistic-container'],...raw['cargo-landing-pad']}};

const item='space-science-pack',request=1000,bar=10;
const stack=raw.tool?.[item]?.stack_size??raw.item?.[item]?.stack_size;assert.equal(stack,200,'pack stack size');
const cap=bar*stack;assert.equal(cap,2000);
// Same protocol as the platform: one end-to-end run qualifies both.
const protocol={buildLimitMinutes:10,warmupMinutes:60,measureMinutes:120,blockedMinutes:105,holdMinutes:15,recoveryMinutes:60,recoveryMeasuredMinutes:45,rocketDeliveryLimitMinutes:60,firstPodLimitMinutes:5};

let next=1;const entities=[],wires=[],ports=[];
const add=(name,x,y,extra={})=>{const e={entity_number:next++,name,position:{x,y},...extra};entities.push(e);return e;};
// Pad on tiles x -4..3, y -4..3; arm on tile (4,-1) picking from the pad (west); chest on tile (5,-1).
const pad=add('cargo-landing-pad',0,0,{request_filters:{sections:[{index:1,filters:[{index:1,name:item,quality:'normal',comparator:'=',count:request}]}],request_from_buffers:true}});
const armEntity=add('fast-inserter',4.5,-0.5,{direction:12,override_stack_size:1});
const chest=add('passive-provider-chest',5.5,-0.5,{bar});
const output={kind:'output',label:item,items:[item],item,entity:chest.entity_number,x:chest.position.x,y:chest.position.y,position:{...chest.position},externalSide:'east',cap,arm:armEntity.entity_number};
ports.push(output);
const before=starterBounds(entities,boundsRaw);
// The power port is placed on the substation hole south of the arm (tiles 4..5, 0..1), inside the rectangle.
const power={kind:'power',label:'External electricity',items:[],x:5,y:1};ports.push(power);
const layout={entities,wires,next,place:e=>entities.push(e)};
const result=powerFiveLayout(layout,ports,raw);
next=layout.next;
assert.equal(result.substations,1);assert.equal(result.mediumPoles,0);
const footprint=starterBounds(entities,boundsRaw);
assert.deepEqual(footprint,{left:-4,top:-4,right:6,bottom:4,width:10,height:8},'pad, arm, chest and substation in 10 x 8');
assert.equal(before.width*before.height<=footprint.width*footprint.height,true);
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};

const description=`Factorio 2.1.24 Space Age. One cargo landing pad that requests ${request} space science packs, one fast inserter and one passive provider chest limited to ${bar} stacks (${cap} packs). Build it on Nauvis under the white-pack platform: the platform drops a cargo pod every 30 seconds with what the pad lacks, so packs arrive with no click. A force may have only one cargo landing pad per planet; if you already have one, add a request for space science packs to it and build only the inserter, chest and substation next to it. Supply electricity at the substation.`;
const bp={item:'blueprint',label:'White-pack receiver · landing pad to chest',description,icons:[{index:1,signal:{type:'item',name:item}}],entities,wires,version:562954249961473};
const code=encodeBlueprint({blueprint:bp});

let status='native-validation-pending',measured;
try{
 const report=JSON.parse(await fs.readFile(out+'/native-report.json','utf8'));
 const r=report.builds?.find(b=>b.id===id&&b.blueprintSha256===sha(code));
 if(r&&!report.short){status=r.passed&&report.passed?'qualified':'not-qualified';measured={steadyPerMinute:r.steady?.collectedPerMinute,recoveryPerMinute:r.recovery?.collectedPerMinute,firstPodSeconds:r.firstPodSecondsAfterBuild,blockedChest:r.blocked?.chest,blockedPad:r.blocked?.pad,platform:report.platform,reportCreatedAt:report.createdAt};}
}catch{}
const construction=Object.fromEntries([...new Set(entities.map(e=>e.name))].sort().map(n=>[n,entities.filter(e=>e.name===n).length]));
const manifest={
 id,name:bp.label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),class:'receiver',status,...(measured?{measured}:{}),
 products:[],targets:{},deliveredItems:[item],deliveryTarget:{[item]:60},outputCaps:{[item]:cap},
 recipeAudit:{externalPerMinute:{},craftsPerMinute:{},recipeIngredients:{}},
 inputs:[],fluids:[],outputs:ports.filter(p=>p.kind==='output'),ports,
 machineCounts:{},footprint,
 areaGoal:{goalTiles:80,stretchTiles:null,fallbackTiles:96,achievedTiles:footprint.width*footprint.height},
 loopControl:[],
 stockControl:{mode:'bar',chest:chest.entity_number,arm:armEntity.entity_number,bar,cap,pad:pad.entity_number,padRequest:request},
 protocol,construction,
 billOfMaterials:{items:construction},
 supplierLinks:[],
 platform:'white-platform',
 setupNotes:[
  description,
  'One cargo landing pad per planet: in a save that already has one, the blueprint pad cannot be built. Add a request for space science packs (1,000) to the existing pad and build only the inserter, chest and substation.',
  `The chest stops at ${cap} packs (${bar} stacks), the pad keeps up to ${request} and the platform hub up to its own cap; everything resumes by itself when robots take packs from the chest.`,
 ],
};
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/'+id+'.txt',code+'\n');
await fs.writeFile(out+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,out,status,footprint,construction,blueprintSha256:manifest.blueprintSha256}));
