// No rate is estimated from a recipe. These tests assess native physical counts.
// Pearson reference: https://www.itl.nist.gov/div898/handbook/eda/section3/eda35f.htm
// Gamma continued fraction: https://dlmf.nist.gov/8.9
export const stochasticPolicyId='flight-native-conditional-poisson-v1';

// Lanczos approximation for positive arguments, used by gamma probabilities.
function logGamma(z) {
  const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
  if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
  z-=1;let sum=.99999999999980993;
  for(let i=0;i<c.length;i++)sum+=c[i]/(z+i+1);
  const t=z+7.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(sum);
}
function gammaQ(a,x) {
  if(x===0)return 1;
  if(x===Infinity)return 0;
  const factor=Math.exp(a*Math.log(x)-x-logGamma(a)),eps=2e-14,tiny=1e-300;
  if(x<a+1){
    let term=1/a,sum=term;
    for(let n=1;n<100000;n++){
      term*=x/(a+n);sum+=term;
      if(Math.abs(term)<Math.abs(sum)*eps)return Math.max(0,Math.min(1,1-sum*factor));
    }
  }else{
    let b=x+1-a,c=1/tiny,d=1/b,h=d;
    for(let n=1;n<100000;n++){
      const an=-n*(n-a);b+=2;d=an*d+b;if(Math.abs(d)<tiny)d=tiny;
      c=b+an/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;const change=d*c;h*=change;
      if(Math.abs(change-1)<eps)return Math.max(0,Math.min(1,factor*h));
    }
  }
  throw new Error('Gamma probability failed to converge');
}
export function chiSquareSurvival(statistic,degreesOfFreedom){
  if(!(statistic>=0) || !Number.isInteger(degreesOfFreedom) || degreesOfFreedom<1)throw new Error('Invalid chi-square arguments');
  return gammaQ(degreesOfFreedom/2,statistic/2);
}
export function chiSquareQuantile(probability,degreesOfFreedom){
  if(!(probability>0 && probability<1))throw new Error('Probability must be strictly between zero and one');
  let lo=0,hi=Math.max(1,degreesOfFreedom);
  while(chiSquareSurvival(hi,degreesOfFreedom)>1-probability)hi*=2;
  for(let i=0;i<100;i++){
    const mid=(lo+hi)/2;
    if(chiSquareSurvival(mid,degreesOfFreedom)>1-probability)lo=mid;else hi=mid;
  }
  return (lo+hi)/2;
}
export function poissonRateInterval(count,minutes,confidence=.95){
  if(!Number.isSafeInteger(count) || count<0 || !(minutes>0) || !(confidence>0 && confidence<1))throw new Error('Invalid Poisson interval arguments');
  const alpha=1-confidence;
  return {method:'Garwood exact Poisson',confidence,count,minutes,
    lowerPerMinute:count===0?0:chiSquareQuantile(alpha/2,2*count)/(2*minutes),
    upperPerMinute:chiSquareQuantile(1-alpha/2,2*(count+1))/(2*minutes),
    assumption:'Independent Poisson arrivals at a constant rate; recipe, transport and spoilage correlations can violate this model.'};
}
export function stochasticWindowTest(counts,{alpha=.05,minimumObservedCount=100}={}){
  const valid=Array.isArray(counts) && counts.length>=3 && counts.every(n=>Number.isSafeInteger(n) && n>=0);
  const count=valid?counts.reduce((a,b)=>a+b,0):0,expected=valid?count/counts.length:0;
  const enough=valid && count>=Math.max(100,minimumObservedCount) && expected>=5;
  const positive=valid && counts.every(n=>n>0);
  const statistic=expected>0?counts.reduce((sum,n)=>sum+(n-expected)**2/expected,0):null;
  const df=valid?counts.length-1:null,p=statistic!==null?chiSquareSurvival(statistic,df):null;
  const accepted=enough && positive && p>=alpha;
  return {method:'Pearson conditional multinomial goodness of fit to equal-duration stationary Poisson counts',policyId:stochasticPolicyId,
    alpha,chiSquare:statistic,degreesOfFreedom:df,pValue:p,expectedCountPerWindow:expected,minimumObservedCount:Math.max(100,minimumObservedCount),
    sufficientObservations:enough,everyWindowPositive:positive,accepted,
    interpretation:accepted?'Variation consistent with stationary random output at the 5% test level; this does not prove stationarity.':'Insufficient evidence or variation inconsistent with stationary random output at the 5% test level.',
    assumptions:['Equal-duration windows','Independent Poisson arrivals conditional on total count; rare Bernoulli yields are an approximation','Each expected window count at least 5','No correction for multiple factory tests; per-output diagnostic only']};
}

// Audit only recipes actually placed in this blueprint. Random unused surplus
// cannot label its deterministic co-product stochastic. Propagate variation
// through consumed ingredients, preserving a reproducible dependency witness.
export function stochasticDependencyAudit(spec,raw){
  const recipes=new Map();
  for(const e of spec.entities || []){
    const name=e.recipe || spec.expectedRecipes?.[e.entity_number];
    if(name && raw.recipe?.[name])recipes.set(name,raw.recipe[name]);
  }
  const key=p=>`${p.type || 'item'}:${p.name}`;
  const products=r=>r.result?[{name:r.result,amount:r.result_count || 1}]:Object.values(r.results || {});
  const variable=new Map();
  for(const [name,r] of recipes)for(const p of products(r))if((p.probability!==undefined && p.probability>0 && p.probability<1) || (p.amount_min!==undefined && p.amount_max!==undefined && p.amount_min!==p.amount_max)){
    variable.set(key(p),{material:key(p),recipe:name,reason:'probabilistic-or-ranged-product',probability:p.probability ?? 1,amountMin:p.amount_min ?? p.amount,amountMax:p.amount_max ?? p.amount});
  }
  let changed=true;
  while(changed){changed=false;for(const [name,r] of recipes){
    const sources=Object.values(r.ingredients || {}).map(key).filter(k=>variable.has(k));
    if(!sources.length)continue;
    for(const p of products(r))if(!variable.has(key(p))){variable.set(key(p),{material:key(p),recipe:name,reason:'consumes-variable-material',dependsOn:sources});changed=true;}
  }}
  const outputKeys=(spec.outputs || []).filter(p=>p.type!=='fluid' && variable.has(key(p))).map(key);
  return {declaredStochastic:spec.stochastic===true,eligibleOutputKeys:spec.stochastic===true?outputKeys:[],
    recipeNames:[...recipes.keys()].sort(),variableMaterials:[...variable.values()].sort((a,b)=>a.material.localeCompare(b.material))};
}
