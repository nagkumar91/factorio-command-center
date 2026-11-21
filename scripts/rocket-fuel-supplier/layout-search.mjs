// Layout search for the rocket-fuel supplier (design review of 11-21): is there a W x H rectangle that holds the
// whole supplier with a substation and an exit tile fed on both lanes from behind?
// Pure Node, no prototype dump, no game. Usage (from factorio-command-center/):
//   node scripts/rocket-fuel-supplier/layout-search.mjs 7x7 [--max-belts 8] [--show 12] [--long-arms]
//        [--outer-curve-drops] [--direct-exit-drop] [--three-pipe-pairs] [--underground-belts] [--idle-belts 2]
// Every rectangle of 53 tiles or fewer (a 5% gain on 7 x 8 = 56):
//   for h in 3 4 5 6 7; do for w in $(seq 3 17); do [ $((w*h)) -le 53 ] && node scripts/rocket-fuel-supplier/layout-search.mjs ${w}x${h} --long-arms --outer-curve-drops --three-pipe-pairs --show 0; done; done
// (and the same with w and h swapped; add --underground-belts for the second sweep). Result on 11-21, all 65
// rectangles: without underground belts nothing; with them one layout, in 7 x 7 only, which is the published
// string (and, with the unmeasured --outer-curve-drops, its mirror image with the plant in the south-west).
// With --direct-exit-drop and no underground belt there is one more 7 x 7 family, which natively holds 7 on the
// exit tile, not 8 (blueprint-sources/rocket-fuel-supplier/history/seven-square-substation-exit-holds-seven).
//
// Model: one chemical plant and two assembling machines (3 x 3 each, any position and facing), one hand-off arm
// from the plant to each machine, one output arm per machine, belts to an exit at the bottom-right tile (east
// facing, straight, fed from behind by a belt, nothing side-loading it, one machine on each lane; the route may
// have up to two idle belt tiles that only shape a curve or a side-load), one 2 x 2
// substation, one panel within 4 tiles of the entrance, and a pipe network (pipes plus up to two pipe-to-ground
// pairs, which may pass under anything) from an entrance pipe on the west edge to one input of the plant and
// the input of each machine. Splitters are not modelled; underground belts only with --underground-belts.
// Lane rules, all measured natively (scripts/concrete-supplier/probes/lanes.lua): an arm dropping on a straight
// belt from a side fills the far lane; from behind, the right lane; from behind onto a curve, the inner lane;
// a belt side-loading a straight belt fills the near lane; curves keep lanes. Anything else is rejected.
// Options that widen the model:
//   --long-arms          hand-off and output arms may be long-handed (pick and drop two tiles away)
//   --outer-curve-drops  an arm may drop on a curve from its outer side (assumed far lane; not measured)
//   --direct-exit-drop   an output arm may drop on the exit tile itself (measured: that lane then holds 3, not 4)
//   --three-pipe-pairs   up to three pipe-to-ground pairs
//   --underground-belts  a belt route may go underground (entered from behind, lanes kept, nothing dropped or
//                        side-loaded on the two ends)
const argv=process.argv.slice(2),has=n=>argv.includes('--'+n),opt=(n,d)=>{const i=argv.indexOf('--'+n);return i>=0?Number(argv[i+1]):d;};
const [W,H]=(argv.find(a=>/^\d+x\d+$/.test(a))||'7x7').split('x').map(Number);
const MAXBELT=opt('max-belts',W>=11||H>=11?11:8),LIMIT=200000,SHOW=opt('show',12);
const IDLE=opt('idle-belts',2);
const LONG=has('long-arms'),OUTER=has('outer-curve-drops'),DIRECT=has('direct-exit-drop'),THREE=has('three-pipe-pairs');
const UNDER=has('underground-belts'),UGMAX=7;// fast-underground-belt max_distance in the 2.1.24 dump: up to 6 tiles between the two ends
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];// N E S W
const k=(x,y)=>y*W+x,inG=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
const EX=W-1,EY=H-1,E=k(EX,EY);
const cells3=(x,y)=>{const r=[];for(let i=0;i<3;i++)for(let j=0;j<3;j++)r.push(k(x+i,y+j));return r;};
const positions=[];for(let x=0;x<=W-3;x++)for(let y=0;y<=H-3;y++)positions.push([x,y]);
// arm tiles between machine a (pick) and machine b (drop): tile t with t-d in a and t+d in b
function handOffs(a,b){const A=new Set(cells3(...a)),B=new Set(cells3(...b)),r=[];
 for(let x=0;x<W;x++)for(let y=0;y<H;y++){if(A.has(k(x,y))||B.has(k(x,y)))continue;for(let d=0;d<4;d++){const [dx,dy]=DIRS[d];if(inG(x-dx,y-dy)&&inG(x+dx,y+dy)&&A.has(k(x-dx,y-dy))&&B.has(k(x+dx,y+dy)))r.push({t:k(x,y),x,y,d});
  if(LONG&&inG(x-2*dx,y-2*dy)&&inG(x+2*dx,y+2*dy)&&A.has(k(x-2*dx,y-2*dy))&&B.has(k(x+2*dx,y+2*dy)))r.push({t:k(x,y),x,y,d,long:true});}}return r;}
// output arms: arm tile adjacent to machine, dropping one tile beyond; d = drop direction
function outArms(a){const A=new Set(cells3(...a)),r=[];
 for(let x=0;x<W;x++)for(let y=0;y<H;y++){if(A.has(k(x,y)))continue;for(let d=0;d<4;d++){const [dx,dy]=DIRS[d];if(inG(x-dx,y-dy)&&inG(x+dx,y+dy)&&A.has(k(x-dx,y-dy))&&!A.has(k(x+dx,y+dy)))r.push({t:k(x,y),x,y,d,drop:k(x+dx,y+dy),dx:x+dx,dy:y+dy});
  if(LONG&&inG(x-2*dx,y-2*dy)&&inG(x+2*dx,y+2*dy)&&A.has(k(x-2*dx,y-2*dy))&&!A.has(k(x+2*dx,y+2*dy)))r.push({t:k(x,y),x,y,d,drop:k(x+2*dx,y+2*dy),dx:x+2*dx,dy:y+2*dy,long:true});}}return r;}
// fluid connection tiles: plant (two corners on the faced side, any of 4 directions), machine (centre of faced side)
function plantInputs([x,y]){const cx=x+1,cy=y+1,r=[];for(const [px,py,d] of [[cx-1,cy-2,0],[cx+1,cy-2,0],[cx+2,cy-1,1],[cx+2,cy+1,1],[cx+1,cy+2,2],[cx-1,cy+2,2],[cx-2,cy+1,3],[cx-2,cy-1,3]])if(inG(px,py))r.push({t:k(px,py),x:px,y:py,face:d,into:(d+2)%4});return r;}
function machineInputs([x,y]){const cx=x+1,cy=y+1,r=[];for(const [px,py,d] of [[cx,cy-2,0],[cx+2,cy,1],[cx,cy+2,2],[cx-2,cy,3]])if(inG(px,py))r.push({t:k(px,py),x:px,y:py,face:d,into:(d+2)%4});return r;}

// ---- belt lane simulation ----
// belts: Map tile -> dir. drops: [{tile, d (drop direction), who}]. Returns lanes on E or null when unproven/invalid.
function lanesAtExit(belts,drops,ug=new Map()){
 const info=new Map();
 // where a belt tile sends its items: an underground entrance to its exit, anything else one tile ahead
 const nextOf=(t,d)=>{if(ug.get(t)?.type==='in')return ug.get(t).mate;const x=t%W,y=(t-x)/W,nx=x+DIRS[d][0],ny=y+DIRS[d][1];return inG(nx,ny)?k(nx,ny):null;};
 for(const [t,d] of belts){const x=t%W,y=(t-x)/W;const feeders=[];for(let s=0;s<4;s++){const [sx,sy]=DIRS[s];const nx=x+sx,ny=y+sy;if(!inG(nx,ny))continue;const nt=k(nx,ny);if(!belts.has(nt))continue;if(nextOf(nt,belts.get(nt))!==t)continue;if(s===d)return null;/* head-on */feeders.push(s);}
  const back=(d+2)%4,left=(d+3)%4,right=(d+1)%4;
  const u=ug.get(t);
  // Underground pieces: the entrance takes belts from behind only, the exit takes nothing above ground; no arm
  // drops on either (side-loading and arm drops on underground pieces are not measured, so they are rejected).
  if(u){if(u.type==='in'?!(feeders.length===1&&feeders[0]===back):feeders.length!==0)return null;}
  let kind='straight',curveFrom=null;
  if(!u&&!feeders.includes(back)&&feeders.length===1){kind='curve';curveFrom=feeders[0];}
  info.set(t,{x,y,d,feeders,back,left,right,kind,curveFrom,L:new Set(),R:new Set(),u});}
 for(const dr of drops){const i=info.get(dr.tile);if(!i||i.u)return null;
  const armSide=(dr.d+2)%4;// side of the tile the arm stands on
  if(i.feeders.includes(armSide))return null;
  if(i.kind==='straight'){
   if(dr.d===i.d)i.R.add(dr.who);else if(armSide===i.d)return null;/* arm in front, dropping against the flow */
   else if(armSide===i.left)i.R.add(dr.who);else i.L.add(dr.who);
  }else{
   if(dr.d===i.d){if(i.curveFrom===i.left)i.L.add(dr.who);else i.R.add(dr.who);}else if(OUTER){i.flag='outer';if(armSide===i.left)i.R.add(dr.who);else i.L.add(dr.who);}else return null;
  }}
 for(let it=0;it<30;it++){let changed=false;
  for(const [t,i] of info){const nt=nextOf(t,i.d);if(nt==null)continue;const n=info.get(nt);if(!n)continue;
   const put=(set,items)=>{for(const w of items)if(!set.has(w)){set.add(w);changed=true;}};
   if(i.u?.type==='in'){put(n.L,i.L);put(n.R,i.R);continue;}// through the tunnel: lanes kept
   const from=(i.d+2)%4;// side of n that i is on
   if(from===n.back||(n.kind==='curve'&&n.curveFrom===from)){put(n.L,i.L);put(n.R,i.R);}
   else if(from===n.left){put(n.L,i.L);put(n.L,i.R);}else if(from===n.right){put(n.R,i.L);put(n.R,i.R);}
  }
  if(!changed)break;}
 const e=info.get(E);if(!e||e.u||e.d!==1||e.kind!=='straight'||e.feeders.length!==1||e.feeders[0]!==e.back)return null;
 if(ug.has(k(EX-1,EY)))return null;// the tile behind the exit stays a plain belt
 // every belt must lead somewhere (no belt pointing off the rectangle or into a non-belt), except E
 for(const [t,i] of info){if(t===E)continue;const nt=nextOf(t,i.d);if(nt==null||!belts.has(nt))return null;}
 return {L:[...e.L],R:[...e.R]};
}

// ---- search ----
let found=0,best=Infinity;const solutions=[];const stats={machines:0,withArms:0,withSub:0,withBelts:0,withFluid:0};
function* paths(from,goalSet,blocked,maxLen,mustEndEast){
 // Simple paths of belt tiles from `from` until a tile in goalSet is reached (goal tile not included). With
 // --underground-belts a tile entered from behind may become an underground entrance; its exit lands up to
 // UGMAX tiles ahead in the same direction (passing under anything) and sends its items straight on.
 function* rec(tiles,dirs,ug,seen,forced){const t=tiles[tiles.length-1],x=t%W,y=(t-x)/W;
  for(let d=0;d<4;d++){if(forced!=null&&d!==forced)continue;
   const nx=x+DIRS[d][0],ny=y+DIRS[d][1];
   if(inG(nx,ny)){const nt=k(nx,ny);
    if(goalSet.has(nt)){if(!(mustEndEast&&nt===E&&d!==1))yield {tiles:tiles.slice(),dirs:[...dirs,d],ug:new Map(ug),end:nt};}
    else if(!blocked.has(nt)&&!seen.has(nt)&&tiles.length<maxLen){seen.add(nt);yield* rec([...tiles,nt],[...dirs,d],ug,seen,null);seen.delete(nt);}}
   if(UNDER&&forced==null&&tiles.length>=2&&dirs[dirs.length-1]===d&&tiles.length<maxLen){
    for(let g=1;g<UGMAX;g++){const lx=x+DIRS[d][0]*(g+1),ly=y+DIRS[d][1]*(g+1);if(!inG(lx,ly))break;const lt=k(lx,ly);
     if(goalSet.has(lt)||blocked.has(lt)||seen.has(lt))continue;
     const ug2=new Map(ug);ug2.set(t,{type:'in',mate:lt});ug2.set(lt,{type:'out',mate:t});
     seen.add(lt);yield* rec([...tiles,lt],[...dirs,d],ug2,seen,d);seen.delete(lt);}}
  }
 }
 yield* rec([from],[],new Map(),new Set([from]),null);
}
function fluidSolve(free,occ,need){
 // need: {plant:[inputs], a:[inputs], b:[inputs]}; free: array of free tiles. Returns the smallest network or null.
 const freeSet=new Set(free);let bestNet=null;
 const entrances=free.filter(t=>t%W===0);
 if(!entrances.length)return null;
 // candidate pipe-to-ground pairs: both ends free, same row/col, at least one tile between, at most 9 between
 const pairs=[];
 for(const a of free)for(const b of free){if(a>=b)continue;const ax=a%W,ay=(a-ax)/W,bx=b%W,by=(b-bx)/W;
  if(ay===by&&bx-ax>=2&&bx-ax<=10)pairs.push({a,b,aOpen:3,bOpen:1});
  if(ax===bx&&by-ay>=2&&by-ay<=10)pairs.push({a,b,aOpen:0,bOpen:2});}
 const pairSets=[[]];for(const p of pairs)pairSets.push([p]);
 for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++){const p=pairs[i],q=pairs[j];if(new Set([p.a,p.b,q.a,q.b]).size===4){pairSets.push([p,q]);if(THREE)for(let l=j+1;l<pairs.length;l++){const u=pairs[l];if(new Set([p.a,p.b,q.a,q.b,u.a,u.b]).size===6)pairSets.push([p,q,u]);}}}
 for(const ps of pairSets){
  const ptg=new Map();for(const p of ps){ptg.set(p.a,{open:p.aOpen,mate:p.b});ptg.set(p.b,{open:p.bOpen,mate:p.a});}
  const rest=free.filter(t=>!ptg.has(t));
  const n=rest.length;if(n>16)throw Error('too many free tiles '+n);
  for(let mask=1;mask<(1<<n);mask++){
   const cnt=popcount(mask)+ptg.size;if(bestNet&&cnt>=bestNet.count)continue;
   const pipes=new Set();for(let i=0;i<n;i++)if(mask>>i&1)pipes.add(rest[i]);
   const ent=entrances.filter(t=>pipes.has(t));if(!ent.length)continue;
   // union-find over pipes + ptg
   const nodes=[...pipes,...ptg.keys()];const parent=new Map(nodes.map(t=>[t,t]));
   const find=t=>{while(parent.get(t)!==t){parent.set(t,parent.get(parent.get(t)));t=parent.get(t);}return t;};
   const uni=(a,b)=>parent.set(find(a),find(b));
   const opens=(t,d)=>pipes.has(t)||(ptg.has(t)&&ptg.get(t).open===d);
   for(const t of nodes){const x=t%W,y=(t-x)/W;
    if(ptg.has(t))uni(t,ptg.get(t).mate);
    for(let d=0;d<4;d++){if(!opens(t,d))continue;const nx=x+DIRS[d][0],ny=y+DIRS[d][1];if(!inG(nx,ny))continue;const nt=k(nx,ny);if(parent.has(nt)&&opens(nt,(d+2)%4))uni(t,nt);}}
   // a pipe-to-ground whose open side touches nothing useful is a waste but not invalid
   const comp=find(ent[0]);
   const reach=inputs=>inputs.find(i=>parent.has(i.t)&&find(i.t)===comp&&opens(i.t,i.into));
   const p=reach(need.plant),a=reach(need.a),b=reach(need.b);
   if(!p||!a||!b)continue;
   // all nodes in one component (no stray pipes)
   if(nodes.some(t=>find(t)!==comp))continue;
   bestNet={count:cnt,pipes:[...pipes],ptg:[...ptg].map(([t,v])=>({t,open:v.open,mate:v.mate})),entrance:ent[0],plant:p,a,b};
  }
 }
 return bestNet;
}
function popcount(n){let c=0;while(n){n&=n-1;c++;}return c;}
const show=sol=>{const g=Array.from({length:H},()=>Array(W).fill('.'));
 const put=(t,c)=>{g[(t-t%W)/W][t%W]=c;};
 for(const t of cells3(...sol.plant))put(t,'C');for(const t of cells3(...sol.a))put(t,'A');for(const t of cells3(...sol.b))put(t,'B');
 for(const h of sol.hand)put(h.t,'^>v<'[h.d]);for(const o of sol.out)put(o.t,(o.long?'NESW':'nesw')[o.d]);
 for(const [t,d] of sol.belts)put(t,'↑→↓←'[d]);for(const [t,u] of sol.ug||[])put(t,u.type==='in'?'∩':'∪');put(E,'E');
 for(const t of sol.sub)put(t,'S');for(const t of sol.fluid.pipes)put(t,'=');for(const p of sol.fluid.ptg)put(p.t,'U');put(sol.fluid.entrance,'#');
 if(sol.panel!=null)put(sol.panel,'p');
 return g.map(r=>r.join('')).join('\n');};

for(const plant of positions){const P=new Set(cells3(...plant));if(P.has(E))continue;
 for(let ai=0;ai<positions.length;ai++){const a=positions[ai];const A=cells3(...a);if(A.some(t=>P.has(t)||t===E))continue;const hA=handOffs(plant,a);if(!hA.length)continue;
  for(let bi=ai+1;bi<positions.length;bi++){const b=positions[bi];const B=cells3(...b);const As=new Set(A);if(B.some(t=>P.has(t)||As.has(t)||t===E))continue;const hB=handOffs(plant,b);if(!hB.length)continue;
   stats.machines++;
   const base=new Set([...P,...A,...B]);
   const oA=outArms(a).filter(o=>!base.has(o.t)&&!base.has(o.drop)),oB=outArms(b).filter(o=>!base.has(o.t)&&!base.has(o.drop));
   if(!oA.length||!oB.length)continue;
   const pin=plantInputs(plant),ain=machineInputs(a),bin=machineInputs(b);
   for(const h1 of hA)for(const h2 of hB){if(h1.t===h2.t||h1.t===E||h2.t===E)continue;
    const occ1=new Set([...base,h1.t,h2.t]);
    for(const o1 of oA){if(occ1.has(o1.t)||occ1.has(o1.drop)||o1.t===E||(o1.drop===E&&!DIRECT))continue;
     for(const o2 of oB){if(occ1.has(o2.t)||occ1.has(o2.drop)||o2.t===E||(o2.drop===E&&!DIRECT)||o2.t===o1.t||o2.t===o1.drop||o2.drop===o1.t)continue;
      stats.withArms++;
      const occ2=new Set([...occ1,o1.t,o2.t]);
      // substation
      for(let sx=0;sx<W-1;sx++)for(let sy=0;sy<H-1;sy++){const sub=[k(sx,sy),k(sx+1,sy),k(sx,sy+1),k(sx+1,sy+1)];if(sub.some(t=>occ2.has(t)||t===E||t===o1.drop||t===o2.drop))continue;
       stats.withSub++;
       const occ3=new Set([...occ2,...sub]);
       // belts: path from o1.drop to E, then o2.drop to any tile of that path (or already on it)
       const seenBelt=new Set();
       for(const pa of (o1.drop===E?(o2.drop===E?[]:[...paths(o2.drop,new Set([E]),occ3,MAXBELT-1,true)]):paths(o1.drop,new Set([E]),occ3,MAXBELT-1,true))){
        const beltsA=new Map();pa.tiles.forEach((t,i)=>beltsA.set(t,pa.dirs[i]));beltsA.set(E,1);
        if(beltsA.size>MAXBELT)continue;
        const joinTargets=new Set([...beltsA.keys()].filter(t=>t!==E));
        const variants=[];
        if(beltsA.has(o2.drop)){variants.push({belts:beltsA,ug:pa.ug});}
        else{const blocked=new Set([...occ3]);for(const pb of paths(o2.drop,joinTargets,blocked,MAXBELT-beltsA.size,false)){const m=new Map(beltsA);let ok=true;pb.tiles.forEach((t,i)=>{if(m.has(t))ok=false;m.set(t,pb.dirs[i]);});if(ok&&m.size<=MAXBELT)variants.push({belts:m,ug:new Map([...pa.ug,...pb.ug])});}}
        // Idle belts: up to two extra belt tiles that carry nothing and only point into a belt of the route. One
        // turns a straight start tile into a curve (an arm behind it then fills the inner lane) or gives a tile a
        // feeder from behind (a belt joining from the side then side-loads instead of curving).
        const withIdle=[];
        for(const {belts:base,ug} of variants){withIdle.push({belts:base,ug});if(IDLE<1)continue;
         const cand=[];
         for(const [u,du] of base){if(u===E||ug.has(u))continue;const ux=u%W,uy=(u-ux)/W;
          for(let side=0;side<4;side++){if(side===du)continue;const tx=ux+DIRS[side][0],ty=uy+DIRS[side][1];if(!inG(tx,ty))continue;const t=k(tx,ty);if(base.has(t)||occ3.has(t)||t===E)continue;cand.push([t,(side+2)%4]);}}
         for(let i=0;i<cand.length;i++){if(base.size+1>MAXBELT)break;const one=new Map(base);one.set(cand[i][0],cand[i][1]);withIdle.push({belts:one,ug});
          if(IDLE>1&&base.size+2<=MAXBELT)for(let j=i+1;j<cand.length;j++){if(cand[j][0]===cand[i][0])continue;const two=new Map(one);two.set(cand[j][0],cand[j][1]);withIdle.push({belts:two,ug});}}
        }
        for(const {belts,ug} of withIdle){
         const sig=[...belts].sort((x,y)=>x[0]-y[0]).map(x=>x.join(':')+(ug.has(x[0])?ug.get(x[0]).type:'')).join(',');if(seenBelt.has(sig))continue;seenBelt.add(sig);
         if([...belts.keys()].some(t=>occ3.has(t)))continue;
         const lanes=lanesAtExit(belts,[{tile:o1.drop,d:o1.d,who:'a'},{tile:o2.drop,d:o2.d,who:'b'}],ug);
         if(!lanes||!lanes.L.length||!lanes.R.length)continue;
         stats.withBelts++;
         const occ4=new Set([...occ3,...belts.keys()]);
         const free=[];for(let t=0;t<W*H;t++)if(!occ4.has(t))free.push(t);
         if(free.length>16){stats.skippedLarge=(stats.skippedLarge||0)+1;continue;}// too many free tiles for the pipe search; counted in stats.skippedLarge
         const net=fluidSolve(free,occ4,{plant:pin,a:ain,b:bin});
         if(!net)continue;
         stats.withFluid++;
         const used=new Set([...net.pipes,...net.ptg.map(p=>p.t)]);
         const ex=net.entrance%W,ey=(net.entrance-ex)/W;
         const panel=free.find(t=>!used.has(t)&&Math.hypot(t%W-ex,(t-t%W)/W-ey)<=4);
         if(panel==null)continue;
         found++;
         const sol={plant,a,b,hand:[h1,h2],out:[o1,o2],sub,belts:[...belts],ug:[...ug],fluid:net,panel,lanes,beltCount:belts.size,fluidCount:net.count};
         solutions.push(sol);
         if(found>=LIMIT)break;
        }
       }
      }
     }
    }
   }
  }
 }
}
solutions.sort((x,y)=>(x.beltCount+x.fluidCount)-(y.beltCount+y.fluidCount));
console.log(JSON.stringify({rectangle:W+' x '+H,tiles:W*H,options:{LONG,OUTER,DIRECT,THREE,UNDER,MAXBELT,IDLE},stats,found}));
// Legend: C plant, A and B machines, ^ > v < hand-off arms (drop direction), n e s w output arms (N E S W when
// long-handed), arrows belts, ∩ ∪ underground belt entrance and exit, E exit, S substation, # entrance pipe,
// = pipe, U pipe-to-ground, p panel.
for(const s of solutions.slice(0,SHOW)){console.log(`belts ${s.beltCount} pipes ${s.fluidCount} exit lanes ${JSON.stringify(s.lanes)}${s.out.some(o=>o.drop===E)?' (one arm drops on the exit tile)':''}`);console.log(show(s));console.log();}
