import test from 'node:test';import assert from'node:assert/strict';import{FactoryLayout}from'../scripts/rgby-science/layout.mjs';import{routeFluid}from'../scripts/rgby-science/fluids.mjs';
const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
test('belt routing reaches its consumer without overwriting a turn to align a tunnel',()=>{
 const l=new FactoryLayout({}),s=l.belt(0,2,4),t=l.belt(5,0,4);for(const[x,y]of[[0,1],[2,0],[2,1],[2,2]])l.add('pipe',x,y);
 l.route(s.position,t.position,{minX:-3,maxX:8,minY:-3,maxY:5,startDirection:4,endDirection:4});let e=s,seen=new Set();
 while(e!==t){assert(!seen.has(e.entity_number),'unexpected transport loop');seen.add(e.entity_number);const[dx,dy]=dirs[e.direction/4],x=Math.floor(e.position.x),y=Math.floor(e.position.y);if(e.name==='fast-underground-belt'&&e.type==='input'){let partner;for(let k=1;k<=7;k++){const n=l.at(x+dx*k,y+dy*k);if(n?.name==='fast-underground-belt'&&n.type==='output'&&n.direction===e.direction){partner=n;break;}}assert(partner,'orphan tunnel');e=partner;}else{e=l.at(x+dx,y+dy);assert(e&&e.name.includes('belt'),'saved path is discontinuous');}}
});
test('fluid tunnel preserves a real output before an existing target pipe',()=>{
 const l=new FactoryLayout({}),s=l.add('pipe',0,0,{tags:{rgby_fluid:'lubricant'}}),join=l.add('pipe',10,0,{tags:{rgby_fluid:'lubricant'}}),target=l.add('pipe',11,0,{tags:{rgby_fluid:'lubricant'}});
 routeFluid(l,'lubricant',s.position,target.position,{minX:0,maxX:12,minY:0,maxY:0});const q=[s],seen=new Set();while(q.length){const e=q.shift();if(seen.has(e.entity_number))continue;seen.add(e.entity_number);const x=Math.floor(e.position.x),y=Math.floor(e.position.y);for(const d of e.name==='pipe-to-ground'?[e.direction/4]:[0,1,2,3]){const[dx,dy]=dirs[d],n=l.at(x+dx,y+dy);if(n&&(n.name==='pipe'||n.name==='pipe-to-ground'&&n.direction/4===(d+2)%4))q.push(n);}if(e.name==='pipe-to-ground'){const d=(e.direction/4+2)%4,[dx,dy]=dirs[d];for(let k=1;k<=10;k++){const n=l.at(x+dx*k,y+dy*k);if(n?.name==='pipe-to-ground'&&n.direction/4===d){q.push(n);break;}}}}
 assert(seen.has(join.entity_number)&&seen.has(target.entity_number),'target must belong to the physical supply network');assert.equal(l.at(10,0),join,'existing pipe retained');
});
