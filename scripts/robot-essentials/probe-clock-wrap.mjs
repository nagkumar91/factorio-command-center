// Native probe for the two mechanics the two-speed token clock relies on after very long play:
// a signal that passes 2^31-1 wraps to negative, and the remainder of a negative value is
// negative or zero (so the latch's two-sided window still sees one start per period).
//   node scripts/robot-essentials/probe-clock-wrap.mjs
// Runs headless with a private config and mod folder under .cache/robot-essentials/, like validate.mjs.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run=promisify(execFile);
const root=path.resolve('.cache/robot-essentials/probe-clock-wrap');
const app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),mod=root+'/mods/robot_essentials_probe';
await fs.rm(root,{recursive:true,force:true});
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','robot_essentials_probe'].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:'robot_essentials_probe',version:'1.0.0',title:'Private clock wrap probe',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.writeFile(mod+'/data.lua','-- No prototypes added.\n');
await fs.writeFile(mod+'/control.lua',`
local T={type='virtual',name='signal-T'}
local A={type='virtual',name='signal-A'}
local cases={{value=2147483640,op='+',constant=9},{value=-20,op='%',constant=7},{value=-21,op='%',constant=7},{value=-2147483648,op='%',constant=5877},{value=20,op='%',constant=7}}
script.on_init(function()
 local s=game.surfaces[1];storage.out={}
 for i,c in ipairs(cases)do
  local x=i*4
  local source=s.create_entity{name='constant-combinator',position={x,0},force='player'}
  source.get_control_behavior().sections[1].set_slot(1,{value={type='virtual',name='signal-T',quality='normal'},min=c.value})
  local a=s.create_entity{name='arithmetic-combinator',position={x,3},force='player'}
  a.get_control_behavior().parameters={first_signal=T,operation=c.op,second_constant=c.constant,output_signal=A}
  source.get_wire_connector(defines.wire_connector_id.circuit_red,true).connect_to(a.get_wire_connector(defines.wire_connector_id.combinator_input_red,true))
  local pole=s.create_entity{name='substation',position={x,7},force='player'}
  local power=s.create_entity{name='electric-energy-interface',position={x,10},force='player'}
  storage.out[i]=a
 end
end)
script.on_event(defines.events.on_tick,function()
 if game.tick~=30 then return end
 local result={}
 for i,c in ipairs(cases)do
  local value=0
  for _,sig in ipairs(storage.out[i].get_control_behavior().signals_last_tick or {})do if sig.signal.name=='signal-A' then value=sig.count end end
  result[i]={input=c.value,operation=c.op,constant=c.constant,output=value}
 end
 helpers.write_file('probe.json',helpers.table_to_json(result),false)
end)
`);
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:64,height:64,default_enable_all_autoplace_controls:false}));
const game=args=>run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:600000,maxBuffer:8e6});
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json']);
await game(['--benchmark',root+'/test.zip','--benchmark-ticks','31','--benchmark-runs','1']);
const result=JSON.parse(await fs.readFile(root+'/script-output/probe.json'));
console.log(JSON.stringify(result));
const want=[-2147483647,-6,0,-(2147483648%5877),6];
const ok=result.every((r,i)=>r.output===want[i]);
console.log(ok?'Clock wrap mechanics confirmed: overflow wraps to negative and the remainder keeps the sign of the dividend.':'UNEXPECTED: wanted '+JSON.stringify(want));
process.exitCode=ok?0:1;
