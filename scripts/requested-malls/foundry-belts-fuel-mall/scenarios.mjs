// The scenarios only this mall has: the rocket fuel section measured at the figures on its panels, the mall part's
// fill without it, and both emptied at once. Everything else is the foundry mall's protocol (validate.mjs there).
import { FUEL } from './lib.mjs';

export function scenario(name, { fill, protocol, manifest }) {
  const F = manifest.panelFigures;
  // the fuel section's own entrances at their panel figures; water at the fuel figure alone, or at the whole panel figure when the mall part draws too
  const fuelOnly = { coal: F.coal, 'calcite-fuel': F['calcite-fuel'], 'sulfuric-acid': F['sulfuric-acid'], water: F.waterFuel };
  const withMall = { ...fuelOnly, water: F.waterFuel + F.waterMall };
  const bounds = { [FUEL]: { min: protocol.fuelTarget - protocol.fuelTolerance, max: protocol.fuelTarget + protocol.fuelTolerance } };
  const mall = manifest.products.filter(v => !v.independent).map(v => v.key);
  const window = (label, supply, extra = {}) => [
    { name: `warm-up: ${label}`, mode: 'ticks', ticks: protocol.fuelWarmupTicks, collectEvery: 60, supply, expect: 'never', ...extra },
    { name: `rocket fuel, thirty minutes: ${label}`, mode: 'ticks', ticks: protocol.fuelWindowTicks, collectEvery: 60, supply, measure: true, rateBounds: bounds, expect: 'never', ...extra }];
  // the mall part alone: coal withheld, so the fuel section never runs
  if (name === 'fill:no-fuel') return { caps: 'full', phases: [
    { name: 'fill from empty, coal withheld (the fuel section never runs)', mode: 'until_caps', limit: protocol.fillLimitTicks, withhold: ['coal'], except: [FUEL], expect: 'caps_except', settleSeconds: protocol.settleSeconds }] };
  // (a) the mall part full and idle: only rocket fuel is taken out
  if (name === 'fuel:idle') return { caps: 'full', phases: [fill('fill from empty'), ...window('the mall part full and idle', fuelOnly, { collectItems: [FUEL] })] };
  // (b) the mall part filling from empty while rocket fuel is taken out all the time
  if (name === 'fuel:filling') return { caps: 'full', phases: [...window('the mall part filling from empty', withMall, { collectItems: [FUEL] }), fill('the mall part finishes its fill, rocket fuel no longer taken', { supply: withMall })] };
  // every chest and the fuel chest emptied every second; then only the foundries and the fuel (the two that share the water entrance)
  if (name === 'both:emptied') { const last = manifest.groups.at(-1); return { caps: 'full', phases: [fill('fill from empty'),
    ...window('every mall chest emptied as well', withMall, { rateItems: manifest.groups[0].products }).map((ph, i) => (i ? { ...ph, expect: 'rate' } : ph)),
    fill('refill before the shared-water window'),
    ...window(`only ${last.name} and rocket fuel emptied (both draw on the water entrance)`, withMall, { collectItems: [...last.products, FUEL], rateItems: last.products }).map((ph, i) => (i ? { ...ph, expect: 'rate' } : ph))] }; }
  void mall;
}
