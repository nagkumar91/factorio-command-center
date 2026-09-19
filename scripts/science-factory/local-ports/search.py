from pathlib import Path
import json,random,time,os
here=Path(__file__).resolve().parent
base=here.parents[2]/'.cache/science-factory/local-port-search'/os.environ.get('SEARCH_NAME','dense-plan')
base.mkdir(parents=True,exist_ok=True)
seed=int(os.environ.get('SEARCH_SEED','5030'));rng=random.Random(seed)
s=json.loads((here/os.environ.get('SEARCH_INPUT','search-input.json')).read_text());bs=s['blocks'];n=len(bs)
mats=list(s['busRows']);mi={m:i for i,m in enumerate(mats)}
prod={m:[i for i,b in enumerate(bs) if b['outputPort']['material']==m] for m in mats}
pred=[{p for inp in b['inputPorts'] for p in prod[inp['material']] if p!=i} for i,b in enumerate(bs)]
front={i for i,b in enumerate(bs) if b['outputPort']['material'] in {'iron-plate','copper-plate','stone-brick'}}

offsets=[[(mi[p['material']],p['localGrid']['x'] if os.environ.get('DENSE_BLOCKS','1') else (3 if p['side']=='east' else -4 if p['lane']==0 else -2)) for p in b['inputPorts']]+[(mi[b['outputPort']['material']],b['outputPort']['localGrid']['x']+1)] for b in bs]
counts={'iron-plate':[8,8,7],'copper-plate':[8,1],'steel-plate':[6],'stone-brick':[5],'copper-cable':[4],'iron-gear-wheel':[2],'electronic-circuit':[2],'pipe':[1],'firearm-magazine':[1],'piercing-rounds-magazine':[2],'grenade':[4],'stone-wall':[1],'inserter':[1],'transport-belt':[1],'engine-unit':[7],'advanced-circuit':[7],'automation-science-pack':[4],'logistic-science-pack':[4],'military-science-pack':[4],'chemical-science-pack':[9]}
heights=[(3 if os.environ.get('DENSE_BLOCKS','1') or len(b['inputPorts'])<=2 else 5)*counts[b['outputPort']['material']][int(b['id'].rsplit('-',1)[1])]+5 for b in bs]

def evaluate(keys,sides):
 order=[];done=set();xs={};ends=[54,-8];used={10,54,56};h=[36,0]
 while len(done)<n:
  i=min((i for i in range(n) if i not in done and pred[i]<=done),key=lambda i:keys[i]);side=sides[i]
  x=max(70 if side==0 else 8,ends[side]+int(os.environ.get("BLOCK_GAP","11")),max([xs[p]+16 for p in pred[i]] or [0]))
  if any(inp['material'] in {'plastic-bar','sulfur'} for inp in bs[i]['inputPorts']):x=max(x,70)
  while any(x+o in used or x+o-1 in used or x+o+1 in used for m,o in offsets[i]):x+=1
  xs[i]=x;ends[side]=x;h[side]=max(h[side],heights[i]);done.add(i);order.append(i);used.update(x+o for m,o in offsets[i])
 end=max(xs.values())+12;lo=[10000]*len(mats);hi=[-10000]*len(mats)
 for i,x in xs.items():
  for m,o in offsets[i]:lo[m]=min(lo[m],x+o-2);hi[m]=max(hi[m],x+o+3)
 lo[mi['coal']]=0
 for m in ['automation-science-pack','logistic-science-pack','military-science-pack','chemical-science-pack']:hi[mi[m]]=lo[mi[m]]
 for m,x in [('plastic-bar',54),('sulfur',56)]:lo[mi[m]]=x-2
 colors=[]
 for i in sorted(range(len(mats)),key=lambda i:(lo[i],hi[i],mats[i])):
  a=lo[i]-2;b=hi[i]+2;c=next((j for j,e in enumerate(colors) if e<a),len(colors))
  if c==len(colors):colors.append(b)
  else:colors[c]=b
 height=sum(h)+3*(len(colors)-1)+6
 score=end*height+sum(b-a for a,b in zip(lo,hi))*2
 return score,{'width':end,'height':height,'rows':len(colors),'positions':{bs[i]['id']:{'x':xs[i],'bank':sides[i]} for i in range(n)},'order':[bs[i]['id'] for i in order]}

pop=[];t=time.time()
for _ in range(100):
 k=[rng.random() for _ in range(n)];sides=[rng.randrange(2) for _ in range(n)];result,plan=evaluate(k,sides);pop.append((result,k,sides,plan))
best=1e10;archive=[]
for generation in range(int(os.environ.get('GENERATIONS','600'))):
 pop.sort(key=lambda x:x[0])
 if pop[0][0]<best:
  best=pop[0][0];plan=pop[0][3];archive.append(plan);print(json.dumps({'gen':generation,'score':best,'size':[plan['width'],plan['height']],'rows':plan['rows']}),flush=True)
 new=pop[:10]
 while len(new)<100:
  a=min(rng.sample(pop,5),key=lambda x:x[0]);b=min(rng.sample(pop,5),key=lambda x:x[0]);k=[a[1][i] if rng.random()<.7 else b[1][i] for i in range(n)];sides=[a[2][i] if rng.random()<.7 else b[2][i] for i in range(n)]
  for _ in range(rng.randint(1,3)):
   i=rng.randrange(n)
   if rng.random()<.5:k[i]=rng.random()
   else:sides[i]=1-sides[i]
  result,plan=evaluate(k,sides);new.append((result,k,sides,plan))
 pop=new
(base/'results.json').write_text(json.dumps({'seed':seed,'population':100,'generations':600,'history':archive,'elapsed':time.time()-t},indent=2)+'\n')
(base/'bank-plan.json').write_text(json.dumps(archive[-1],indent=2)+'\n')
