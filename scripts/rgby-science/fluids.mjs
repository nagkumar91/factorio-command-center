import assert from 'node:assert/strict';
const dirs=[[0,-1],[1,0],[0,1],[-1,0]],key=(x,y)=>x+','+y,isPipe=e=>e&&(e.name==='pipe'||e.name==='pipe-to-ground');
// Label the already-qualified component pipe networks before adding manifolds.
export function labelFluids(l,ports){for(const p of ports.filter(p=>p.kind==='fluid')){
 const start=l.entities.find(e=>e.entity_number===p.entity),seen=new Set(),queue=[start];
 while(queue.length){const e=queue.shift();if(!e||seen.has(e.entity_number))continue;seen.add(e.entity_number);e.tags={...e.tags,rgby_fluid:p.item||p.items[0]};const x=Math.floor(e.position.x),y=Math.floor(e.position.y);
  const allowed=e.name==='pipe-to-ground'?[(e.direction||0)/4]:[0,1,2,3];
  for(const d of allowed){const[vx,vy]=dirs[d],n=l.at(x+vx,y+vy);if(isPipe(n)&&(n.name==='pipe'||((n.direction||0)/4)===(d+2)%4))queue.push(n);}
  if(e.name==='pipe-to-ground'){const d=(((e.direction||0)/4)+2)%4,[vx,vy]=dirs[d];for(let distance=1;distance<=10;distance++){const n=l.at(x+vx*distance,y+vy*distance);if(n?.name==='pipe-to-ground'&&n.direction===(d*4)){queue.push(n);break;}}}
 }
}}
export function routeFluid(l,item,start,target,{minX=-28,maxX=112,minY=-15,maxY=62,blocked=new Set()}={}){
 const joins=l.entities.filter(e=>e.name==='pipe'&&e.tags?.rgby_fluid===item&&e.tags?.rgby_manifold).sort((a,b)=>(Math.abs(a.position.x-target.x)+Math.abs(a.position.y-target.y))-(Math.abs(b.position.x-target.x)+Math.abs(b.position.y-target.y)));const origin=joins[0]?.position||start;const sx=Math.floor(origin.x),sy=Math.floor(origin.y),tx=Math.floor(target.x),ty=Math.floor(target.y),end=l.at(tx,ty),endDir=end?.name==='pipe-to-ground'?((end.direction||0)+8)%16:undefined;
 const free=(x,y)=>(x===tx&&y===ty||!blocked.has(key(x,y)))&&x>=minX&&x<=maxX&&y>=minY&&y<=maxY&&(!l.at(x,y)||(x===tx&&y===ty)||l.at(x,y).name==='pipe'&&l.at(x,y).tags?.rgby_fluid===item);
 const safe=(x,y)=>dirs.every(([vx,vy])=>{const n=l.at(x+vx,y+vy);return !isPipe(n)||n.tags?.rgby_fluid===item;});
 const tunnelSafe=(x,y,ex,ey,d)=>{const[vx,vy]=dirs[d/4];for(const e of l.entities){if(e.name!=='pipe-to-ground')continue;const px=Math.floor(e.position.x),py=Math.floor(e.position.y);if(vx?py!==y:px!==x)continue;const from=(px-x)*vx+(py-y)*vy,to=(ex-px)*vx+(ey-py)*vy;if(e.direction===d&&from>0&&from<=10||e.direction===(d+8)%16&&to>0&&to<=10)return false;}return true;};
 const heap=[],cost=new Map(),previous=new Map(),sk=n=>`${n.x},${n.y},${n.d},${n.landed?1:0}`;
 function push(n){let i=heap.length;heap.push(n);while(i){let p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;}
 function pop(){const n=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return n;}
 const initial={x:sx,y:sy,d:-1,landed:false,g:0};initial.key=sk(initial);initial.f=(Math.abs(tx-sx)+Math.abs(ty-sy))*.19;push(initial);cost.set(initial.key,0);let finish;
 while(heap.length){const n=pop();if(cost.get(n.key)!==n.g)continue;if(n.x===tx&&n.y===ty&&(endDir===undefined||n.d===endDir)){finish=n;break;}
  for(let d=0;d<16;d+=4){if(n.key===initial.key&&!joins.length&&d!==4)continue;if(n.landed&&d!==n.d)continue;const[vx,vy]=dirs[d/4];
   function offer(distance,tunnel){const x=n.x+vx*distance,y=n.y+vy*distance;if(!free(x,y)||!safe(x,y)||tunnel&&l.at(x,y))return;for(let a=n;a;a=previous.get(a.key)?.from)if(a.x===x&&a.y===y)return;if(x===tx&&y===ty&&(tunnel||endDir!==undefined&&d!==endDir))return;if(tunnel&&(n.key===initial.key||l.at(n.x,n.y)||n.d!==d||!tunnelSafe(n.x,n.y,x,y,d)))return;
    const g=n.g+(tunnel?1.9+distance*.03:1)+(n.d>=0&&n.d!==d?.05:0),o={x,y,d,landed:tunnel,g};o.key=sk(o);if((cost.get(o.key)??Infinity)<=g)return;cost.set(o.key,g);o.f=g+(Math.abs(tx-x)+Math.abs(ty-y))*.19;previous.set(o.key,{from:n,d,tunnel});push(o);
   }offer(1,false);if(!n.landed)for(let distance=2;distance<=10;distance++)offer(distance,true);
  }
 }
 assert(finish,`No ${item} pipe route ${sx},${sy} → ${tx},${ty}`);const segments=[];for(let n=finish;n.key!==initial.key;){const s=previous.get(n.key);segments.push({...s,to:n});n=s.from;}segments.reverse();const plan=new Map();
 for(const s of segments){if(s.tunnel){plan.set(key(s.from.x,s.from.y),{x:s.from.x,y:s.from.y,name:'pipe-to-ground',direction:(s.d+8)%16});plan.set(key(s.to.x,s.to.y),{x:s.to.x,y:s.to.y,name:'pipe-to-ground',direction:s.d});}else if(!plan.has(key(s.from.x,s.from.y)))plan.set(key(s.from.x,s.from.y),{x:s.from.x,y:s.from.y,name:'pipe'});}
 for(const p of plan.values()){if(l.at(p.x,p.y))continue;l.add(p.name,p.x,p.y,{...(p.direction!==undefined?{direction:p.direction}:{}),tags:{rgby_fluid:item,rgby_manifold:true}});}return[...plan.values()];
}
