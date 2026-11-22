// The two arrangements of the oil-products supplier that were built and screened natively. Both share the refinery
// block and the light-cracker row; they differ in where lubricant, the heavy crackers, the heavy tank and the
// substations sit. 'east-wing' (43 x 15) is published; 'east-wing-four-substations' (44 x 15) is kept as the screened
// alternative. Coordinates here run from y = -5 (north edge) to y = 9; the generator shifts them to start at 0.
//
// Rows (published variant, y as here):
//  -5  outputs of the cracker row: gas chain of the light crackers, lubricant and light-oil outlets (north side)
//  -4..-2  chemical plants facing south (inputs on row -1): 6 light crackers, light tank, lubricant; east: 2 heavy
//          crackers and the heavy tank
//  -1  inputs of the cracker row: water chain (entrance at the west end) and vertical pipe-to-ground pairs
//   0  heavy-oil chain        1  gas chain        2  light-oil chain and the refinery outputs
//   3..7  7 oil refineries (every second one mirrored, so like outputs and inputs pair up)
//   8  crude chain (entrance at the west end) and refinery water inputs
//   9  water link under the refineries, and the iron belt hopping east in underground belts
//  east of the refineries, rows 3..9: acid and sulfur plants, gas export, acid and sulfur exits.
import {makeLayout,N,E,S,W} from './layout.mjs';
import {THRESHOLD} from './shared.mjs';

export const VARIANTS={'east-wing':{label:'East wing, three substations'},'east-wing-four-substations':{label:'East wing, four substations'}};
export const MAIN_VARIANT='east-wing';

export function build(variant){
 const four=variant==='east-wing-four-substations';if(!VARIANTS[variant])throw Error('unknown variant '+variant);
 const L=makeLayout(),P=(x,y)=>L.pipe(x,y),G=(x,y,d)=>L.ptg(x,y,d);
 const chem=(recipe,x,y,dir,mirror)=>L.place('chemical-plant',x,y,{recipe,direction:dir,...(mirror?{mirror:true}:{})});
 const cond=fluid=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'fluid',name:fluid},comparator:'>',constant:THRESHOLD[fluid]}});
 const ports={},roles={};
 const dx=four?1:0; // the four-substation variant is one column wider east of the refineries
 // ---- refineries and the manifold ----
 const refineries=[];for(let i=0;i<7;i++)refineries.push(L.place('oil-refinery',5*i,3,{recipe:'advanced-oil-processing',...(i%2?{mirror:true}:{})}));
 for(const x of [9,10,19,20,29,30]){P(x,2);P(x,1);}          // heavy outputs rise to row 1 ...
 for(const x of [11,21,31]){P(x,1);P(x,0);}                  // ... and join row 0 where row -1 carries no water
 P(0,2);P(0,1);P(1,1);P(1,0);                                // heavy output 0 steps round the water entrance
 for(const x of [2,7,12,17,22,27,32])P(x,2);                 // light outputs
 for(const x of [4,5,14,15,24,25,34]){P(x,2);P(x,1);}       // gas outputs rise to row 1
 for(const [a,b] of [[3,6],[8,11],[13,16],[18,21],[23,26],[28,31]]){G(a,2,W);G(b,2,E);}
 for(const [a,b] of [[6,13],[16,23],[26,33]]){G(a,1,W);G(b,1,E);}
 P(3,1);
 // heavy chain, row 0
 G(2,0,W);G(10,0,E);P(12,0);P(13,0);G(14,0,W);G(20,0,E);P(22,0);P(23,0);
 G(24,0,W);G(30,0,E);
 P(32,0);G(33,0,W);G(35+dx,0,E);P(36+dx,0);P(37+dx,0);G(38+dx,0,W);G(41+dx,0,E);P(42+dx,0);
 // gas chain east of the refineries, row 1, down to the sulfur plant and out at the gas export
 if(four){P(35,1);P(36,1);G(37,1,W);G(38,1,E);P(39,1);P(40,1);P(41,1);P(42,1);P(42,2);ports.gas=P(43,2);for(const y of [2,3,4])P(39,y);}
 else{P(35,1);G(36,1,W);G(38,1,E);P(39,1);P(40,1);P(41,1);P(41,2);ports.gas=P(42,2);for(const y of [3,4])P(41,y);}
 // rows 8 and 9: crude chain, refinery water inputs, water link; water tunnel at column 34 (row 9 <-> row -1)
 ports.crude=G(0,8,W);G(2,8,E);for(const x of [3,4,5,6,13,14,15,16,23,24,25,26,33])P(x,8);
 for(const [a,b] of [[7,12],[17,22],[27,32]]){G(a,8,W);G(b,8,E);}
 for(const x of [1,8,9,10,11,18,19,20,21,28,29,30,31])P(x,8);
 P(1,9);G(2,9,W);G(8,9,E);P(9,9);G(10,9,W);G(18,9,E);P(19,9);G(20,9,W);G(28,9,E);P(29,9);G(30,9,W);G(33,9,E);P(34,9);
 G(34,8,S);G(34,0,N);
 // ---- the cracker row (chemical plants face south: inputs on row -1, outputs on row -5) ----
 roles.lightCrackers=[[0,true],[7,false],[10,true],[17,false],[20,true],[27,false]].map(([s,m])=>chem('light-oil-cracking',s,-4,S,m));
 for(const x of [2,7,12,17,22,27]){G(x,-1,N);G(x,1,S);}     // light oil to each cracker: row 2 -> row -1 underground
 ports.water=P(0,-1);G(1,-1,W);G(8,-1,E);P(9,-1);P(10,-1);G(11,-1,W);G(18,-1,E);P(19,-1);P(20,-1);G(21,-1,W);G(28,-1,E);P(29,-1);
 G(30,-1,W);G(33,-1,E);P(34,-1);
 // light tank (30..32): south corner -> light output 32; north corner is the light-oil outlet (north side)
 roles.lightTank=L.place('storage-tank',30,-4,{});G(32,-1,N);G(32,1,S);ports.light=P(30,-5);
 // light-cracker gas: row -5 west to the pump column at x = 3 (flowing south), then underground into gas (3,1)
 if(four){for(let x=2;x<=21;x++)P(x,-5);G(22,-5,W);G(26,-5,E);P(27,-5);}
 else{for(let x=2;x<=11;x++)P(x,-5);G(12,-5,W);G(16,-5,E);for(let x=17;x<=27;x++)P(x,-5);}
 roles.gasPump=L.place('pump',3,-4,{direction:S,control_behavior:cond('light-oil')});G(3,-2,N);G(3,0,S);
 // lubricant: heavy at its west input; outlet on its north side
 const ux=four?23:13;roles.lubricant=chem('lubricant',ux,-4,S,false);P(ux,-1);ports.lubricant=P(ux,-5);
 // heavy crackers east of the light tank, water from the water tunnel exit (34,-1)
 roles.heavyCrackers=[chem('heavy-oil-cracking',34+dx,-4,S,true),chem('heavy-oil-cracking',37+dx,-4,S,false)];
 P(36+dx,-1);P(37+dx,-1);
 if(four){P(35,-1);G(36,-1,W);G(39,-1,E);P(40,-1);P(41,-1);}else{G(35,-1,W);G(38,-1,E);P(39,-1);}
 // heavy-cracker light oil: row -5 -> pump (31..32, flowing west) -> light tank north corner (30,-5)
 for(let x=33;x<=39+dx;x++)P(x,-5);
 roles.lightPump=L.place('pump',31,-5,{direction:W,control_behavior:cond('heavy-oil')});
 roles.heavyTank=L.place('storage-tank',40+dx,-4,{});P(42+dx,-1);
 // ---- acid and sulfur, east of the refineries (rows 3..9) ----
 roles.acid=chem('sulfuric-acid',35,5,N,false);roles.sulfur=chem('sulfur',39,5,N,four);
 if(four){G(35,0,N);G(35,4,S);G(41,0,N);G(41,4,S);}                 // water underground from row -1
 else{G(39,0,N);G(39,3,S);P(39,4);P(38,4);P(37,4);}                  // water underground from row -1, then row 4
 P(37,8);G(38,8,W);ports.acid=G(42+dx,8,E);
 const arm=(x,y,d)=>L.place('fast-inserter',x,y,{direction:d,override_stack_size:1});
 roles.sulfurToAcid=arm(38,6,E);roles.ironArm=arm(36,8,S);roles.sulfurArm=arm(40,8,N);
 const B=(x,y,d)=>L.place('fast-transport-belt',x,y,{direction:d}),U=(x,y,d,type)=>L.place('fast-underground-belt',x,y,{direction:d,type});
 ports.iron=U(0,9,E,'input');U(3,9,E,'output');for(const x of [4,5,6])B(x,9,E);U(7,9,E,'input');U(11,9,E,'output');
 for(let x=12;x<=16;x++)B(x,9,E);U(17,9,E,'input');U(21,9,E,'output');for(let x=22;x<=26;x++)B(x,9,E);U(27,9,E,'input');U(31,9,E,'output');
 U(32,9,E,'input');U(35,9,E,'output');B(36,9,E);
 for(let x=40;x<=42+dx;x++){const b=B(x,9,E);if(x===42+dx)ports.sulfur=b;}
 // ---- substations (power) and the red circuit network (tanks, pumps, substations as relays) ----
 const subs=four?[L.place('substation',5,-4),L.place('substation',15,-4),L.place('substation',33,-4),L.place('substation',37,3)]
  :[L.place('substation',5,-4),L.place('substation',23,-4),L.place('substation',35,3)];
 for(let i=0;i+1<subs.length;i++)L.wires.push([subs[i].entity_number,5,subs[i+1].entity_number,5]);
 const red=(a,b)=>L.wires.push([a.entity_number,1,b.entity_number,1]);
 if(four){red(roles.gasPump,subs[0]);red(subs[0],subs[1]);red(subs[1],subs[2]);red(subs[2],roles.lightTank);red(subs[2],roles.heavyTank);red(subs[2],roles.lightPump);}
 else{red(roles.gasPump,subs[0]);red(subs[0],subs[1]);red(subs[1],roles.lightTank);red(subs[1],roles.lightPump);red(subs[1],subs[2]);red(subs[2],roles.heavyTank);}
 roles.substations=subs;
 // ---- display panels beside the ports ----
 const panelAt={water:[0,0],crude:[0,-5],iron:[1,-5],gas:[42+dx,3],acid:[42+dx,7],sulfur:[42+dx,6],light:[29,-5],lubricant:[four?24:14,-5]};
 return {L,ports,roles,refineries,panelAt,subs};
}
