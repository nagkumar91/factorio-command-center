// Bounded WFC for directed, single-material belt corridors. Tile ports are
// explicit: -1 receives, +1 sends, and 0 has no connection on that edge.
export const vectors=[[0,-1],[1,0],[0,1],[-1,0]];
export const tiles=[{input:-1,output:-1,edges:[0,0,0,0]}];
for(let input=0;input<4;input++)for(let output=0;output<4;output++)if(input!==output){
 const edges=[0,0,0,0];edges[input]=-1;edges[output]=1;
 tiles.push({input,output,edges});
}
export const ALL=(1<<tiles.length)-1;
const popcounts=new Uint8Array(ALL+1);
for(let i=1;i<=ALL;i++)popcounts[i]=popcounts[i>>1]+(i&1);
const support=vectors.map((_,d)=>{
 const single=tiles.map(a=>tiles.reduce((m,b,i)=>m|(a.edges[d]===-b.edges[(d+2)%4]?1<<i:0),0));
 const union=new Uint16Array(ALL+1);
 for(let mask=1;mask<=ALL;mask++){const bit=mask&-mask;union[mask]=union[mask^bit]|single[31-Math.clz32(bit)];}
 return union;
});
export function random(seed){let state=seed>>>0;return()=>{state=(state+0x6d2b79f5)>>>0;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function validateSolution(model,choice){
 if(choice.length!==model.cells.length||choice.some((t,i)=>t<0||t>=tiles.length||!(model.domains[i]&(1<<t))))return false;
 const used=new Set(),start=model.start.index,goal=model.goal.index;
 let at=start,entry=model.start.side;
 for(let step=0;step<=choice.length;step++){
  if(used.has(at))return false;used.add(at);
  const tile=tiles[choice[at]];if(!tile||tile.input!==entry)return false;
  const next=model.neighbors[at][tile.output];
  if(next<0){
   if(at!==goal||tile.output!==model.goal.side)return false;
   return used.size===choice.filter(t=>t!==0).length;
  }
  at=next;entry=(tile.output+2)%4;
 }
 return false;
}
export function solve(model,priorities,{maxBranches=1200}={}){
 let branches=0,contradictions=0,completed=0;
 function propagate(domains,queue){
  for(let cursor=0;cursor<queue.length;cursor++){
   const at=queue[cursor],domain=domains[at];if(!domain)return false;
   for(let d=0;d<4;d++){
    const next=model.neighbors[at][d];if(next<0)continue;
    const allowed=domains[next]&support[d][domain];
    if(allowed!==domains[next]){if(!allowed)return false;domains[next]=allowed;queue.push(next);}
   }
  }
  return true;
 }
 function visit(domains,queue){
  if(branches>=maxBranches)return null;
  if(!propagate(domains,queue)){contradictions++;return null;}
  let cell=-1,entropy=Infinity,tie=Infinity;
  for(let i=0;i<domains.length;i++){
   const count=popcounts[domains[i]],rank=priorities[i*tiles.length+0];
   if(count>1&&(count<entropy||count===entropy&&rank<tie)){cell=i;entropy=count;tie=rank;}
  }
  if(cell<0){
   completed++;const choice=Array.from(domains,m=>31-Math.clz32(m));
   return validateSolution(model,choice)?choice:null;
  }
  const choices=[];for(let t=0;t<tiles.length;t++)if(domains[cell]&(1<<t))choices.push(t);
  choices.sort((a,b)=>priorities[cell*tiles.length+a]-priorities[cell*tiles.length+b]||a-b);
  for(const tile of choices){
   if(++branches>maxBranches)break;
   const child=domains.slice();child[cell]=1<<tile;
   const result=visit(child,[cell]);if(result)return result;
  }
  return null;
 }
 const choice=visit(Uint16Array.from(model.domains),model.domains.map((_,i)=>i));
 return {choice,branches,contradictions,completed,budgetExceeded:branches>=maxBranches};
}

function seedGenome(model,preferred,rng){
 const genes=Array.from({length:model.cells.length*tiles.length},()=>rng());
 for(let i=0;i<model.cells.length;i++)genes[i*tiles.length+(preferred?.[i]??0)]-=1;
 return genes;
}
export function evolve(model,{seed=12345,population=16,generations=12,maxBranches=800,onGeneration=()=>{}}={}){
 const rng=random(seed),cache=new Map(),archive=new Map(),logs=[];
 let nextId=0,totalBranches=0;
 const make=(genes,parents=[],kind='fresh')=>({id:nextId++,genes,parents,kind});
 function evaluate(individual){
  const key=individual.genes.join(',');let result=cache.get(key);
  if(!result){result=solve(model,individual.genes,{maxBranches});cache.set(key,result);totalBranches+=result.branches;}
  const score=result.choice?result.choice.filter(Boolean).length:Infinity;
  const value={...individual,score,result};
  if(result.choice){const layout=result.choice.join(',');if(!archive.has(layout))archive.set(layout,{choice:result.choice,score,id:individual.id,parents:individual.parents,kind:individual.kind});}
  return value;
 }
 let members=Array.from({length:population},(_,i)=>make(seedGenome(model,i===0?model.baseline:i===1?model.heuristic:i%2?model.baseline:null,rng),[],i===0?'baseline-seed':i===1?'shortest-path-seed':'fresh'));
 const tournament=ranked=>Array.from({length:3},()=>ranked[Math.floor(rng()*ranked.length)]).sort((a,b)=>a.score-b.score||a.id-b.id)[0];
 for(let generation=0;generation<generations;generation++){
  const ranked=members.map(evaluate).sort((a,b)=>a.score-b.score||a.id-b.id);
  const log={generation,valid:ranked.filter(i=>Number.isFinite(i.score)).length,best:Number.isFinite(ranked[0].score)?ranked[0].score:null,uniqueLayouts:archive.size,evaluations:cache.size,totalBranches};logs.push(log);onGeneration(log);
  const next=ranked.slice(0,2).map(i=>make(i.genes,[i.id],'elite'));
  while(next.length<population-2){
   const a=tournament(ranked),b=tournament(ranked),genes=a.genes.slice();
   for(let cell=0;cell<model.cells.length;cell++){
    if(rng()<.5)for(let t=0;t<tiles.length;t++)genes[cell*tiles.length+t]=b.genes[cell*tiles.length+t];
    if(rng()<.08){const first=Math.floor(rng()*tiles.length),second=Math.floor(rng()*tiles.length),offset=cell*tiles.length;[genes[offset+first],genes[offset+second]]=[genes[offset+second],genes[offset+first]];}
   }
   next.push(make(genes,[a.id,b.id],'crossover-mutation'));
  }
  while(next.length<population)next.push(make(seedGenome(model,rng()<.5?model.heuristic:null,rng)));
  members=next;
 }
 // A separately recorded WFC-only control uses fresh genomes without selection.
 const control=[];
 for(let i=0;i<population;i++){
  const result=solve(model,seedGenome(model,i===0?model.baseline:i===1?model.heuristic:null,rng),{maxBranches});
  control.push({valid:!!result.choice,score:result.choice?.filter(Boolean).length??null,branches:result.branches});
 }
 return {seed,population,generations,maxBranches,evaluations:cache.size,totalBranches,logs,control,archive:[...archive.values()].sort((a,b)=>a.score-b.score)};
}
