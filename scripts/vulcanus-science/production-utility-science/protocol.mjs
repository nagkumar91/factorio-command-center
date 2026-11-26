// The native protocol of the Vulcanus science blueprint: the scenarios (each its own headless game) and their phases.
// Times are game ticks. A phase with a goal ends when the goal has held; its limit is a failure, not a length.
import { GOVERNOR } from './design.mjs';
export const MIN = 3600;
export const PROTOCOL = Object.freeze({
  seed: 21026, externalPowerWatts: 1000000000, passFloor: 57, warmupMinutes: 15, steadyMinutes: 30, holdMinutes: 10, outageMinutes: 5, withheldMinutes: 20,
  shortWarmupMinutes: 25, shortMeasureMinutes: 10, recoveryLimitMinutes: 120, stagedBuild: { perStep: 3, everyTicks: 6 }, lateSupplyTicks: 3600, fluidWatchEveryTicks: 5,
  feed: 'belts: generous = one item on each lane every tick (more than a fast belt carries); throttled = perMinute/3600 a tick, alternating lanes. pipes: generous = the outside pipe kept full; throttled = perMinute/3600 a tick plus what was refused, at most one second saved',
  take: 'packs: everything in the two chests once a second; stone: everything on the exit tile every four ticks',
  buildOrders: ['shuffle-1', 'shuffle-2', 'shuffle-3', 'pipes-first', 'machines-first', 'foundries-last'],
  orientations: ['east', 'south', 'west', 'flip-horizontal', 'flip-vertical'],
  withheld: ['lava', 'calcite', 'plastic-bar', 'sulfuric-acid', 'lubricant'],
  single: ['production-science-pack', 'utility-science-pack'],
  governor: GOVERNOR,
});
const P = PROTOCOL;
// Which packs need which outside input (from the recipes: sulfuric acid goes into processing units and batteries, lubricant into electric engines).
export const NEEDS = { lava: ['production-science-pack', 'utility-science-pack'], calcite: ['production-science-pack', 'utility-science-pack'], 'plastic-bar': ['production-science-pack', 'utility-science-pack'], 'sulfuric-acid': ['utility-science-pack'], lubricant: ['utility-science-pack'] };
export function scenarioNames() {
  return ['generous', 'throttled', 'blocked', 'outage', 'stone', ...P.single.map(n => 'single:' + n), ...P.withheld.map(n => 'withheld:' + n), ...P.buildOrders.flatMap(o => [`build:${o}:live`, `build:${o}:late`]), ...P.orientations.map(o => 'orient:' + o)];
}
// Full-length scenarios and shortened ones are reported apart.
export const FULL_LENGTH = ['generous', 'throttled', 'blocked', 'outage', 'stone'];
export function scenario(name, manifest) {
  const inputs = manifest.ports.filter(v => !v.exit);
  const all = mode => Object.fromEntries(inputs.map(v => [v.id, mode === 'panel' ? v.perMinute : mode]));
  const floor = { minPacks: P.passFloor };
  const tail = feed => [{ name: 'warm-up', mode: 'ticks', ticks: P.shortWarmupMinutes * MIN, feed }, { name: 'rate', mode: 'ticks', ticks: P.shortMeasureMinutes * MIN, feed, measure: true, expect: floor }];
  const base = { rotation: 0, flip: null, build: { mode: 'instant', name: 'all at once' } };
  if (name === 'generous' || name === 'throttled') {
    const feed = all(name === 'generous' ? 'generous' : 'panel');
    return { ...base, phases: [{ name: 'warm-up', mode: 'ticks', ticks: P.warmupMinutes * MIN, feed }, { name: 'steady', mode: 'ticks', ticks: P.steadyMinutes * MIN, feed, measure: true, expect: floor }] };
  }
  const gen = all('generous');
  if (name === 'blocked') return { ...base, phases: [
    { name: 'warm-up', mode: 'ticks', ticks: P.warmupMinutes * MIN, feed: gen },
    { name: 'chests not emptied', mode: 'until', limit: 120 * MIN, quietSeconds: 60, untilChestsFull: true, feed: gen, collect: false, expect: { chestsFull: true } },
    { name: 'hold', mode: 'ticks', ticks: P.holdMinutes * MIN, feed: gen, collect: false, expect: { chestsFull: true, zeroPackCrafts: true } },
    { name: 'release', mode: 'ticks', ticks: 10 * MIN, feed: gen },
    { name: 'rate after release', mode: 'ticks', ticks: 10 * MIN, feed: gen, measure: true, expect: floor }] };
  if (name === 'outage') return { ...base, phases: [
    { name: 'warm-up', mode: 'ticks', ticks: P.warmupMinutes * MIN, feed: gen },
    { name: 'outage of every input', mode: 'ticks', ticks: P.outageMinutes * MIN, feed: all('none') },
    { name: 'recovery', mode: 'ticks', ticks: 10 * MIN, feed: gen },
    { name: 'rate after the outage', mode: 'ticks', ticks: 10 * MIN, feed: gen, measure: true, expect: floor }] };
  if (name === 'stone') return { ...base, phases: [
    { name: 'warm-up', mode: 'ticks', ticks: P.warmupMinutes * MIN, feed: gen },
    { name: 'stone exit blocked', mode: 'until', limit: 240 * MIN, quietSeconds: 180, feed: gen, stone: false },
    { name: 'stopped', mode: 'ticks', ticks: 5 * MIN, feed: gen, stone: false, expect: { zeroPackCrafts: true } },
    { name: 'release', mode: 'ticks', ticks: 20 * MIN, feed: gen },
    { name: 'rate after release', mode: 'ticks', ticks: 10 * MIN, feed: gen, measure: true, expect: floor }] };
  if (name.startsWith('single:')) {
    // only one of the two chests is emptied: the other fills and its line stops, the emptied pack must keep its rate
    const item = name.slice(7);
    return { ...base, phases: [{ name: 'warm-up', mode: 'ticks', ticks: P.shortWarmupMinutes * MIN, feed: gen, collectOnly: item }, { name: 'rate', mode: 'ticks', ticks: P.shortMeasureMinutes * MIN, feed: gen, collectOnly: item, measure: true, expect: { minPacksOf: [item], floor: P.passFloor } }] };
  }
  if (name.startsWith('withheld:')) {
    const item = name.slice(9), port = inputs.find(v => v.item === item);
    // the packs that cannot be made without this input must not appear; acid and lubricant are used by utility science only
    return { ...base, phases: [{ name: `cold start without ${item}`, mode: 'ticks', ticks: P.withheldMinutes * MIN, feed: { ...gen, [port.id]: 'none' }, expect: { noPacks: NEEDS[item] } },
      { name: 'recovery', mode: 'until_rate', floor: P.passFloor, limit: P.recoveryLimitMinutes * MIN, feed: gen }, { name: 'rate', mode: 'ticks', ticks: P.shortMeasureMinutes * MIN, feed: gen, measure: true, expect: floor }] };
  }
  if (name.startsWith('build:')) {
    const [, order, supply] = name.split(':');
    return { ...base, build: { mode: 'staged', name: order, ...P.stagedBuild, feedAfterBuild: supply === 'late' }, phases: tail(gen) };
  }
  if (name.startsWith('orient:')) {
    const o = name.slice(7);
    return { ...base, rotation: { east: 4, south: 8, west: 12 }[o] || 0, flip: o.startsWith('flip-') ? o.slice(5) : null, phases: tail(gen) };
  }
  throw new Error('unknown scenario ' + name);
}
// The order entities appear in for a staged build (entity numbers).
export function buildOrder(name, entities) {
  const ids = entities.map(e => e.entity_number), by = f => { const a = entities.filter(f).map(e => e.entity_number), set = new Set(a); return [a, ids.filter(n => !set.has(n))]; };
  if (name.startsWith('shuffle-')) {
    let s = P.seed + Number(name.slice(8)) * 7919; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const a = [...ids]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  if (name === 'pipes-first') { const [a, rest] = by(e => e.name === 'pipe' || e.name === 'pipe-to-ground'); return [...a, ...rest]; }
  if (name === 'machines-first') { const [a, rest] = by(e => /^(foundry|assembling-machine-3|chemical-plant|electric-furnace)$/.test(e.name)); return [...a, ...rest]; }
  if (name === 'foundries-last') { const [a, rest] = by(e => e.name === 'foundry'); return [...rest, ...a]; }
  return ids;
}
// A flipped copy of the blueprint, by the game's own rule for each entity (fluid-slots.json, flips): positions mirrored, directions
// mirrored, machines with ports turned and mirrored as LuaEntity.flip leaves them, splitter sides swapped.
export function flipBlueprint(object, axis, slots) {
  const horizontal = axis === 'horizontal', swap = horizontal ? { 4: 12, 12: 4 } : { 0: 8, 8: 0 };
  const out = JSON.parse(JSON.stringify(object));
  for (const e of out.blueprint.entities) {
    if (horizontal) e.position.x = -e.position.x; else e.position.y = -e.position.y;
    const d = e.direction || 0, table = slots.flips[e.name]?.[axis];
    if (table) {
      const to = table['d' + d + (e.mirror ? 'M' : '')], nd = Number(/^d(\d+)/.exec(to)[1]);
      if (nd) e.direction = nd; else delete e.direction;
      if (to.endsWith('M') && e.recipe && slots.slots[`${e.name}|${e.recipe}`]) e.mirror = true; else delete e.mirror;
    } else if (swap[d] !== undefined) { if (swap[d]) e.direction = swap[d]; else delete e.direction; }
    for (const key of ['input_priority', 'output_priority']) if (e[key]) e[key] = e[key] === 'left' ? 'right' : 'left';
  }
  return out;
}
