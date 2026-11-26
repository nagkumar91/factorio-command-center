// Native scenarios of the rocket-fuel supply. Minutes are converted to ticks here; control.lua only runs the list.
// Every scenario is its own game with a fresh import of the same string. In every scenario every pipe, underground and machine fluid
// box is read every four ticks; any foreign fluid at any time fails the run.
//
//   1  supply protocol, full length (15 minutes warm-up from empty, 30 measured): generous and throttled
//   2  each input withheld from a cold start for 20 minutes, then supplied (every other entrance at its panel figure throughout)
//   3  how a player builds it: built a piece at a time in five orders with power and inputs live; power late; each input connected
//      late; the exit not connected for an hour (entrances generous); and with the inserter capacity bonus a player may have
//      researched (entrances at their panel figures)
//   4  placed turned three ways and mirrored on each axis (entrances at their panel figures); north is the two runs of group 1
// Groups 2 to 4 are shortened: after the disturbance the run goes on until the exit gave at least the floor over five whole minutes in a
// row (the scenario fails if that takes longer than the limit), and the rate is then measured over ten more minutes.
export const MINUTES = 3600;
export const FLOOR_SHARE = 0.95;        // the brief's pass floor: 11.4 of 12 a minute
export const FLUID_READ_TICKS = 4;
export const REACH_WINDOW_MINUTES = 5;
export const REACH_LIMIT_MINUTES = 40;
export const HOLD_MINUTES = 10;
export const BUILD = { perStep: 1, stepTicks: 30 };   // one entity every half second
export const BUILD_ORDERS = ['shuffle-1', 'shuffle-2', 'shuffle-3', 'pipes-first', 'machines-first'];
export const HAND_BONUSES = [1, 3];                    // inserter capacity bonus 1 (hand size 2) and the most the game's researches give (3, hand size 4)
export const PLACED = ['rot90', 'rot180', 'rot270', 'flipH', 'flipV'];
export const GROUPS = {
  1: 'supply protocol, full length',
  2: 'each input withheld from a cold start for 20 minutes, then supplied',
  3: 'how a player builds it',
  4: 'placed turned and mirrored',
};

export function scenarios(m) {
  const out = m.outputPorts[0], target = m.targets[out.item], floor = +(target * FLOOR_SHARE).toFixed(2);
  const all = v => Object.fromEntries(m.inputPorts.map(i => [i.id, v]));
  const generous = all('generous'), throttled = Object.fromEntries(m.inputPorts.map(i => [i.id, i.perMinute])), none = all('none');
  const without = (feed, port) => ({ ...feed, [port.id]: 'none' });
  const drained = { [out.id]: 'all' }, blocked = { [out.id]: 'none' };
  const phase = (name, minutes, feed, draw, extra = {}) => ({ name, ticks: minutes * MINUTES, feed, draw, ...extra });
  const atRate = { minDrawn: { [out.id]: floor } }, nothing = { maxDrawn: { [out.id]: 0 } };
  const back = seconds => ({ recoverTo: { targets: { [out.id]: target }, share: FLOOR_SHARE, windowSeconds: 300, withinSeconds: seconds } });
  // the shortened ending: until the floor is held over five minutes in a row, then ten measured minutes
  const reach = (name, feed, extra = {}) => phase(name, REACH_LIMIT_MINUTES, feed, drained, { endWhen: { drawn: { [out.id]: floor }, windowMinutes: REACH_WINDOW_MINUTES }, ...extra });
  const hold = feed => phase('rate held', HOLD_MINUTES, feed, drained, { expect: { ...atRate, allMachinesCraft: true } });
  const sc = (name, group, length, description, phases, extra = {}) => ({ name, group, length, description, mixEveryTicks: FLUID_READ_TICKS, phases, ...extra });
  const list = [];
  // ---- 1: the supply protocol
  const protocol = (name, description, feed) => sc(name, 1, 'full', description, [
    phase('warm-up', 15, feed, drained),
    phase('steady', 30, feed, drained, { expect: { ...atRate, allMachinesCraft: true } }),
    phase('exit blocked', 30, feed, blocked, { expect: { ...nothing, stopped: 5 } }),
    phase('release', 15, feed, drained, { measureFrom: 5 * MINUTES, expect: { ...atRate, ...back(600) } }),
    phase('input outage', 5, none, drained),
    phase('recovery', 20, feed, drained, { measureFrom: 10 * MINUTES, expect: { ...atRate, ...back(900) } }),
  ]);
  list.push(protocol('generous', 'every entrance offered more than the blueprint can use', generous));
  list.push(protocol('throttled', 'every entrance offered exactly the figure on its panel', throttled));
  // ---- 2: each input withheld from a cold start
  for (const port of m.inputPorts) list.push(sc(`withheld-${port.item}`, 2, 'shortened', `${port.item} withheld from a cold start for 20 minutes while every other entrance is offered its panel figure, then supplied at its panel figure`, [
    phase(`${port.item} withheld from a cold start`, 20, without(throttled, port), drained, { expect: nothing }),
    reach(`${port.item} supplied: until the rate`, throttled),
    hold(throttled),
  ]));
  // ---- 3: how a player builds it
  for (const order of BUILD_ORDERS) list.push(sc(`build-${order}`, 3, 'shortened', `built one entity every ${BUILD.stepTicks} ticks in the order ${order}, with power and every entrance live from the first tick`, [
    reach('built piece by piece: until the rate', generous),
    hold(generous),
  ], { build: { order, ...BUILD } }));
  list.push(sc('late-power', 3, 'shortened', 'everything placed and every entrance live, power connected after ten minutes', [
    phase('no power for ten minutes', 10, generous, drained, { power: false, expect: nothing }),
    reach('power connected: until the rate', generous),
    hold(generous),
  ]));
  for (const port of m.inputPorts) list.push(sc(`late-${port.item}`, 3, 'shortened', `everything placed and powered, ${port.item} connected after five minutes${port.kind === 'pipe' ? ' (its outside pipe does not exist before that)' : ''}`, [
    phase(`${port.item} not connected for five minutes`, 5, without(generous, port), drained, { ...(port.kind === 'pipe' ? { absent: [port.id] } : {}), expect: nothing }),
    reach(`${port.item} connected: until the rate`, generous),
    hold(generous),
  ]));
  list.push(sc('exit-unconnected', 3, 'shortened', 'everything placed, powered and supplied, nothing takes from the exit for an hour, then it is connected', [
    phase('exit not connected for an hour', 60, generous, blocked, { expect: { ...nothing, stopped: 5 } }),
    reach('exit connected: until the rate', generous),
    hold(generous),
  ]));
  // the hand sizes a player's own game can have: every scenario above runs at hand size 1 (no bonus); the game's researches give fast inserters up to 3 more
  for (const bonus of HAND_BONUSES) list.push(sc(`hand-size-${1 + bonus}`, 3, 'shortened', `inserter capacity bonus ${bonus} (fast inserters carry ${1 + bonus}), from empty, every entrance at its panel figure`, [
    reach('from empty: until the rate', throttled),
    hold(throttled),
  ], { inserterBonus: bonus }));
  // ---- 4: placed turned and mirrored
  for (const place of PLACED) list.push(sc(`place-${place}`, 4, 'shortened', `placed ${place} from empty, every entrance at its panel figure`, [
    reach('from empty: until the rate', throttled),
    hold(throttled),
  ], { place }));
  return Object.fromEntries(list.map(s => [s.name, s]));
}
