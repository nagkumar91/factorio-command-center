from pathlib import Path
import json,random,time
here=Path(__file__).resolve().parent
base=here.parents[2]/'.cache/science-factory/two-bank-search'
base.mkdir(parents=True,exist_ok=True)
rng=random.Random(2919)
s=json.loads((here/'search-input.json').read_text());bs=s['blocks'];n=len(bs)
mats=list(s['busRows']);mi={m:i for i,m in enumerate(mats)}
prod={m:[i for i,b in enumerate(bs) if b['outputPort']['material']==m] for m in mats}
pred=[{p for inp in b['inputPorts'] for p in prod[inp['material']] if p!=i} for i,b in enumerate(bs)]
front={i for i,b in enumerate(bs) if b['outputPort']['material'] in {'iron-plate','copper-plate','stone-brick'}}
for i in range(n):
 if i not in front:pred[i]|=front
offsets=[[(mi[p['material']],3 if p['side']=='east' else -4 if p['lane']==0 else -2) for p in b['inputPorts']]+[(mi[b['outputPort']['material']],b['outputPort']['localGrid']['x']+1)] for b in bs]
heights=[-min(p['grid']['y'] for p in b['inputPorts'])+3 for b in bs]

def evaluate(keys,sides):
 order=[];done=set();xs={};ends=[54,54];used={10,54,56};h=[44,0]
 while len(done)<n:
  i=min((i for i in range(n) if i not in done and pred[i]<=done),key=lambda i:keys[i]);side=sides[i]
  x=max(70,ends[side]+16,max([xs[p]+16 for p in pred[i]] or [70]))
  while any(x+o in used or x+o-1 in used or x+o+1 in used for m,o in offsets[i]):x+=1
  xs[i]=x;ends[side]=x;h[side]=max(h[side],heights[i]);done.add(i);order.append(i);used.update(x+o for m,o in offsets[i])
 end=max(xs.values())+12;lo=[10000]*len(mats);hi=[-10000]*len(mats)
 for i,x in xs.items():
  for m,o in offsets[i]:lo[m]=min(lo[m],x+o-2);hi[m]=max(hi[m],x+o+3)
 for m in ['iron-ore','copper-ore','coal','stone']:lo[mi[m]]=0
 for m in ['automation-science-pack','logistic-science-pack','military-science-pack','chemical-science-pack']:hi[mi[m]]=end
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
for generation in range(350):
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
(base/'direct-front-bank-search-results.json').write_text(json.dumps({'seed':2919,'population':100,'generations':350,'history':archive,'elapsed':time.time()-t},indent=2)+'\n')
(base/'direct-front-bank-plan.json').write_text(json.dumps(archive[-1],indent=2)+'\n')
