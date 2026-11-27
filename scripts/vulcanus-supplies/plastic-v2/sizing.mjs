// Recipe arithmetic of the plastic-v2 supply for any plastic rate, from the pinned recipes and machine speeds. Nothing here is typed in:
// the machine counts, the crude barrels, the coal and the water a minute all come from the game dump through prototypes.json.
// Balance: advanced oil processing makes heavy, light and petroleum gas in a fixed ratio; every heavy oil is cracked to light oil, every
// light oil to petroleum gas, so the only thing the plastic plants take out is petroleum gas and nothing is left over to be burned or stored.
export const amount = (rec, name) => [...rec.ingredients, ...rec.results].find(v => v.name === name).amount;
export const craftTime = rec => rec.energy_required ?? 0.5;
export function sizing(p, target) {
  const r = n => p.recipes[n], speed = n => p.entities[n].crafting_speed;
  const plastic = r('plastic-bar'), aop = r('advanced-oil-processing'), hc = r('heavy-oil-cracking'), lc = r('light-oil-cracking'), barrel = r('empty-crude-oil-barrel'), waterBarrel = r('empty-water-barrel');
  const crude = p.fluids['crude-oil'];
  const plasticCrafts = target / amount(plastic, 'plastic-bar');
  const gas = plasticCrafts * amount(plastic, 'petroleum-gas');
  // petroleum gas per advanced craft once all the heavy and light oil is cracked, and the crack crafts per advanced craft
  const lightPerAop = amount(aop, 'light-oil'), heavyPerAop = amount(aop, 'heavy-oil'), gasPerAop = amount(aop, 'petroleum-gas');
  const heavyCracksPerAop = heavyPerAop / amount(hc, 'heavy-oil');
  const lightPerAopTotal = lightPerAop + heavyCracksPerAop * amount(hc, 'light-oil');
  const lightCracksPerAop = lightPerAopTotal / amount(lc, 'light-oil');
  const gasPerAopTotal = gasPerAop + lightCracksPerAop * amount(lc, 'petroleum-gas');
  const aopCrafts = gas / gasPerAopTotal;
  const need = { 'plastic-bar': plasticCrafts, 'advanced-oil-processing': aopCrafts, 'heavy-oil-cracking': aopCrafts * heavyCracksPerAop, 'light-oil-cracking': aopCrafts * lightCracksPerAop };
  const crudePerMinute = aopCrafts * amount(aop, 'crude-oil'), barrelsPerMinute = crudePerMinute / amount(barrel, 'crude-oil');
  need['empty-crude-oil-barrel'] = barrelsPerMinute;
  const waterPerMinute = aopCrafts * amount(aop, 'water') + aopCrafts * heavyCracksPerAop * amount(hc, 'water') + aopCrafts * lightCracksPerAop * amount(lc, 'water');
  const waterBarrelsPerMinute = waterPerMinute / amount(waterBarrel, 'water');
  need['empty-water-barrel'] = waterBarrelsPerMinute;
  const machineOf = { 'plastic-bar': 'chemical-plant', 'advanced-oil-processing': 'oil-refinery', 'heavy-oil-cracking': 'chemical-plant', 'light-oil-cracking': 'chemical-plant', 'empty-crude-oil-barrel': 'assembling-machine-3', 'empty-water-barrel': 'assembling-machine-3' };
  const each = Object.fromEntries(Object.keys(need).map(k => [k, 60 * speed(machineOf[k]) / craftTime(r(k))]));
  const machinesNeeded = Object.fromEntries(Object.entries(need).map(([k, v]) => [k, Math.ceil(v / each[k] - 1e-9)]));
  const perMinute = { coal: plasticCrafts * amount(plastic, 'coal'), 'crude-oil-barrel': barrelsPerMinute, 'water-barrel': waterBarrelsPerMinute, waterFluid: waterPerMinute };
  const waterBy = { 'advanced-oil-processing': aopCrafts * amount(aop, 'water'), 'heavy-oil-cracking': need['heavy-oil-cracking'] * amount(hc, 'water'), 'light-oil-cracking': need['light-oil-cracking'] * amount(lc, 'water') };
  // the most plastic one refinery's worth of crude can make, and what the smallest machine counts can reach
  const maxPerMachine = Object.fromEntries(Object.keys(need).map(k => [k, each[k] / need[k] * target]));
  const maxPlasticPerMinute = Math.min(...Object.keys(need).map(k => machinesNeeded[k] * each[k] / need[k] * target));
  return { target, crudeFluidPerBarrel: amount(barrel, 'crude-oil'), gasPerAopTotal, requiredCraftsPerMinute: need, craftsPerMinuteEach: each, machinesNeeded, utilization: Object.fromEntries(Object.keys(need).map(k => [k, need[k] / (machinesNeeded[k] * each[k])])), perMinute, waterBy, crudePerMinute, maxPlasticPerMinute, crudeFluid: crude.name, emptyBarrelsPerMinute: barrelsPerMinute + waterBarrelsPerMinute, barrelsPerSecondOneMachine: each['empty-crude-oil-barrel'] / 60, plasticPerCrudeBarrel: target / barrelsPerMinute };
}
