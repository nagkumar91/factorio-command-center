import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL,tiles,vectors,solve,evolve,validateSolution} from './wfc.mjs';
import {shortestPath} from './corridors.mjs';
function rectangle(width,height,startY=0,endY=0){
 const cells=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width)}));
 const neighbors=cells.map(p=>vectors.map(([dx,dy])=>{const x=p.x+dx,y=p.y+dy;return x<0||x>=width||y<0||y>=height?-1:y*width+x;}));
 const start={index:startY*width,side:3},goal={index:endY*width+width-1,side:1};
 const domains=cells.map((_,i)=>{
  let domain=ALL;for(let d=0;d<4;d++)if(neighbors[i][d]<0){const required=i===start.index&&d===3?-1:i===goal.index&&d===1?1:0;domain&=tiles.reduce((m,t,n)=>m|(t.edges[d]===required?1<<n:0),0);}return domain;
 });
 return {cells,neighbors,domains,start,goal};
}
function route(model,coordinates){
 const choice=Array(model.cells.length).fill(0);let previous={x:coordinates[0][0]-1,y:coordinates[0][1]};
 for(let i=0;i<coordinates.length;i++){
  const [x,y]=coordinates[i],next=coordinates[i+1]||[x+1,y],input=vectors.findIndex(([dx,dy])=>x+dx===previous.x&&y+dy===previous.y),output=vectors.findIndex(([dx,dy])=>x+dx===next[0]&&y+dy===next[1]);
  choice[model.cells.findIndex(p=>p.x===x&&p.y===y)]=tiles.findIndex(t=>t.input===input&&t.output===output);previous={x,y};
 }return choice;
}
test('forced corridor preserves flow and both endpoint directions',()=>{
 const model=rectangle(4,1),result=solve(model,Array(4*tiles.length).fill(0));
 assert.ok(result.choice);assert.equal(result.choice.filter(Boolean).length,4);assert.ok(validateSolution(model,result.choice));
 assert.ok(result.choice.every(id=>tiles[id].input===3&&tiles[id].output===1));
});
test('an impossible corridor stops at a contradiction',()=>{
 const model=rectangle(4,1);model.domains[2]=1;
 const result=solve(model,Array(4*tiles.length).fill(0),{maxBranches:20});
 assert.equal(result.choice,null);assert.ok(result.contradictions>0);assert.ok(result.branches<=20);
});
test('global verification rejects disconnected cycles',()=>{
 const model=rectangle(4,4),choice=route(model,[[0,0],[1,0],[2,0],[3,0]]);
 for(const [x,y,input,output] of [[1,2,2,1],[2,2,3,2],[2,3,0,3],[1,3,1,0]])choice[y*4+x]=tiles.findIndex(t=>t.input===input&&t.output===output);
 assert.equal(validateSolution(model,choice),false);
});
test('GA-guided WFC shortens a detour and records its heuristic control',()=>{
 const model=rectangle(4,3,1,1);model.baseline=route(model,[[0,1],[0,0],[1,0],[2,0],[3,0],[3,1]]);model.heuristic=shortestPath(model);
 assert.ok(validateSolution(model,model.baseline));assert.equal(model.baseline.filter(Boolean).length,6);
 const result=evolve(model,{seed:123,population:8,generations:4,maxBranches:200});
 assert.equal(result.archive[0].score,4);assert.ok(result.archive.every(r=>validateSolution(model,r.choice)));assert.equal(result.control.length,8);
 assert.equal(result.logs.length,4);assert.ok(result.evaluations>8);
});
