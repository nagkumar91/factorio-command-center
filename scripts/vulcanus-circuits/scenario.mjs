// The native protocol of the Vulcanus circuit blueprints: every scenario of a qualifying run, as data for control.lua.
// Minutes are converted to ticks here. Every member runs the same list; only its ports, groups and target differ.
export const MIN = 3600;
export const PROTOCOL = Object.freeze({
  seed: 21026, externalPowerWatts: 400000000, floorShare: 0.95,
  warmupTicks: 15 * MIN, measureTicks: 30 * MIN, blockTicks: 15 * MIN, stoppedMinutes: 5, outageTicks: 5 * MIN, coldTicks: 20 * MIN,
  reachLimitTicks: 30 * MIN, holdTicks: 10 * MIN, latePowerTicks: 5 * MIN, blockedStoneTicks: 60 * MIN, cutTicks: 10 * MIN, stopTicks: 15 * MIN,
  buildStepTicks: 20, buildPerStep: 2, buildGapTicks: 10 * MIN,
  buildOrders: ['shuffle-1', 'shuffle-2', 'shuffle-3', 'pipes-first', 'machines-first', 'copper-lava-last', 'iron-lava-last'],
  placements: ['rot90', 'rot180', 'rot270', 'flipH', 'flipV'],
  maxResearch: { stack: 2, bulk: 11 },
  surface: 'vulcanus (game.planets.vulcanus.create_surface; ground set to volcanic-ash-flats, natural entities removed, only the chunks under the blueprint kept)',
  research: 'exactly manifest.technologyClosure, nothing else: bulk inserter capacity bonus 1, inserter stack size bonus 0 (research:max sets them to the values of all seven capacity researches)',
  feed: 'belts: items put on the entrance belt (generous: one item a lane every tick the belt has room; throttled: a credit of perMinute/3600 a tick, capped at 8, one item a credit on alternating lanes); pipes: fluid put into one outside pipe touching the entrance (generous: kept full; throttled: perMinute/3600 a tick plus what was refused, capped at one second)',
  draw: 'a belt is placed beyond every exit, the way a player connects one, and emptied every four ticks; a blocked or unconnected exit is the same belt left alone',
  reach: 'a phase that waits for the rate ends when the trailing minute of the product exit reaches 95% of the target; its limit is a failure',
  acceptance: 'In every scenario: no pipe ever holds a fluid other than its network\'s (every fluid segment read every tick, every machine fluid box every five ticks), no machine box is joined to a pipe of another fluid, no unused port is joined to anything, no belt line carries an undeclared item and the exits give only their own item; the imported blueprint is exactly the string. Full length: from empty, 15 minutes of warm-up then 30 minutes measured at 95% of the target or more, once with every entrance offered more than it can take and once with every entrance offered exactly its panel figure; each input withheld from a cold start for 20 minutes and then supplied; the stone exit left unconnected for an hour and then connected. Goal-ended: with the product exit blocked for 15 minutes nothing crafts in the last five and the rate returns when it is released; the same with the stone exit; a five-minute outage of every input; five minutes without power; built a few entities at a time in three shuffled orders, pipes first, machines first and with either lava foundry group ten minutes late, supply and power live; lava and calcite cut for ten minutes each and each lava foundry group stopped for fifteen; placed turned in each direction and mirrored on each axis; and with every inserter capacity research done. After each of these the exit reaches the rate and then holds 95% of the target over ten measured minutes.',
});

const SHUFFLE_SEED = { 'shuffle-1': 1, 'shuffle-2': 2, 'shuffle-3': 3, 'pipes-first': 11, 'machines-first': 12, 'copper-lava-last': 13, 'iron-lava-last': 14 };
export function shuffled(list, seed) {
  let a = seed >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out;
}
// The order entities appear in a piecemeal build (entity numbers; a negative entry is a pause of that many ticks).
export function buildOrder(name, entities, m) {
  const ids = list => list.map(e => e.entity_number), seed = SHUFFLE_SEED[name];
  const PIPES = ['pipe', 'pipe-to-ground'], MACHINES = ['foundry', 'assembling-machine-3', 'substation'];
  const split = test => [...shuffled(ids(entities.filter(test)), seed), ...shuffled(ids(entities.filter(e => !test(e))), seed + 100)];
  if (name.startsWith('shuffle-')) return shuffled(ids(entities), seed);
  if (name === 'pipes-first') return split(e => PIPES.includes(e.name));
  if (name === 'machines-first') return split(e => MACHINES.includes(e.name));
  // one lava foundry group arrives ten minutes after everything else: one molten metal exists for a long time and the other does not
  const late = new Set(m.groups[name === 'copper-lava-last' ? 'copper-lava' : 'iron-lava']);
  return [...shuffled(ids(entities.filter(e => !late.has(e.entity_number))), seed), -PROTOCOL.buildGapTicks, ...late];
}

export function scenarios(m) {
  const P = PROTOCOL, product = m.outputPorts.find(o => o.product), stone = m.outputPorts.find(o => o.byproduct), target = m.target;
  const floor = +(target * P.floorShare).toFixed(3);
  const all = v => Object.fromEntries(m.inputPorts.map(i => [i.id, v])), generous = all('generous'), none = all('none'), throttled = Object.fromEntries(m.inputPorts.map(i => [i.id, i.perMinute]));
  const without = id => ({ ...generous, [id]: 'none' });
  const open = { [product.id]: 'all', [stone.id]: 'all' }, productBlocked = { [stone.id]: 'all' }, stoneBlocked = { [product.id]: 'all' };
  const fixed = (name, ticks, extra = {}) => ({ name, mode: 'ticks', ticks, feed: generous, draw: open, ...extra });
  const reach = (name, extra = {}) => ({ name, mode: 'until_rate', limit: P.reachLimitTicks, share: P.floorShare, feed: generous, draw: open, ...extra });
  const hold = (name = 'ten measured minutes at the rate') => fixed(name, P.holdTicks, { expect: { minProduct: floor } });
  const out = {};
  const rate = (feed, what, everyMachine = true) => ({ length: 'full', description: `from empty: 15 minutes of warm-up, then 30 minutes measured, ${what}`, phases: [
    fixed('warm-up', P.warmupTicks, { feed }),
    fixed('steady', P.measureTicks, { feed, expect: { minProduct: floor, allMachinesCraft: everyMachine } }) ] });
  out['rate:generous'] = rate(generous, 'every entrance offered more than it can take');
  // Offered exactly the panel figures every machine must craft, unless the member declares spare machines that then stand idle
  // (manifest.sizing.idleAtPanelSupply; they must craft in the generous run).
  out['rate:throttled'] = rate(throttled, 'every entrance offered exactly its panel figure', !m.sizing.idleAtPanelSupply);
  out.blocks = { length: 'goal-ended', description: 'product exit blocked and released, stone exit blocked and released, five-minute outage of every input', phases: [
    reach('reach the rate from empty'),
    fixed('product exit blocked', P.blockTicks, { draw: productBlocked, measureFrom: 5 * MIN, expect: { maxProduct: 0, stopped: P.stoppedMinutes } }),
    reach('product exit released'),
    fixed('stone exit blocked', P.blockTicks, { draw: stoneBlocked, expect: { stopped: P.stoppedMinutes } }),
    reach('stone exit released'),
    fixed('five-minute outage of every input', P.outageTicks, { feed: none }),
    reach('recovery after the outage'), hold() ] };
  for (const i of m.inputPorts) out['cold:' + i.item] = { length: 'full', description: `${i.item} withheld from a cold start for 20 minutes, then supplied (also: ${i.item} connected late)`, phases: [
    fixed(`${i.item} withheld from a cold start`, P.coldTicks, { feed: without(i.id), expect: { maxProduct: 0 } }),
    reach(`after ${i.item} was supplied`), hold() ] };
  for (const order of P.buildOrders) out['build:' + order] = { length: 'goal-ended', description: ({ 'pipes-first': 'built a few entities at a time, every pipe first', 'machines-first': 'built a few entities at a time, machines and substations first', 'copper-lava-last': 'built a few entities at a time; the molten copper lava foundries arrive ten minutes after everything else', 'iron-lava-last': 'built a few entities at a time; the molten iron lava foundries arrive ten minutes after everything else' })[order] || 'built a few entities at a time in a seeded shuffled order', build: order, phases: [reach('reach the rate after piecemeal construction'), hold()] };
  out['late:power'] = { length: 'goal-ended', description: 'everything connected, no power for five minutes', phases: [
    fixed('no power for five minutes', P.latePowerTicks, { power: false, expect: { maxProduct: 0 } }), reach('after power arrived'), hold() ] };
  out['late:stone-exit'] = { length: 'full', description: 'stone exit not connected for an hour, then connected', phases: [
    fixed('stone exit not connected for an hour', P.blockedStoneTicks, { draw: stoneBlocked, expect: { stopped: P.stoppedMinutes } }), reach('after the stone exit was connected'), hold() ] };
  const lavaPort = m.inputPorts.find(i => i.item === 'lava'), calcitePort = m.inputPorts.find(i => i.item === 'calcite');
  out['starve:supply'] = { length: 'goal-ended', description: 'in mid-run lava cut for ten minutes, then calcite cut for ten minutes', phases: [
    reach('reach the rate from empty'),
    fixed('lava cut for ten minutes', P.cutTicks, { feed: without(lavaPort.id) }), reach('after lava returned'),
    fixed('calcite cut for ten minutes', P.cutTicks, { feed: without(calcitePort.id) }), reach('after calcite returned'), hold() ] };
  out['starve:foundry'] = { length: 'goal-ended', description: 'in mid-run one molten metal runs dry while the other is full: each lava foundry group stopped for fifteen minutes in turn', phases: [
    reach('reach the rate from empty'),
    fixed('molten copper lava foundries stopped for fifteen minutes', P.stopTicks, { stop: ['copper-lava'] }), reach('after the molten copper lava foundries restarted'),
    fixed('molten iron lava foundries stopped for fifteen minutes', P.stopTicks, { stop: ['iron-lava'] }), reach('after the molten iron lava foundries restarted'), hold() ] };
  for (const place of P.placements) out['place:' + place] = { length: 'shortened', description: ({ rot90: 'placed turned a quarter clockwise', rot180: 'placed turned a half', rot270: 'placed turned three quarters', flipH: 'placed mirrored left to right', flipV: 'placed mirrored top to bottom' })[place], place, phases: [reach('reach the rate from empty'), hold()] };
  out['research:max'] = { length: 'shortened', description: 'every inserter capacity research done (the pinned hand sizes must hold)', bonus: P.maxResearch, phases: [reach('reach the rate from empty'), hold()] };
  return out;
}
// What a qualifying run must contain, by name.
export const scenarioNames = m => Object.keys(scenarios(m));
