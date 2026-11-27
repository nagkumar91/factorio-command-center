// Native scenarios of the plastic-v2 supply (short protocol). Minutes are converted to ticks here; control.lua only runs the list.
// Every entrance is offered exactly the figure on its panel (belts: items at that rate). The plastic exit belt is emptied every four ticks except
// where the phase says it is blocked; the empty-barrel chest is emptied every four ticks like an exit (the player's logistics take the barrels away).
// Every scenario is its own game with a fresh import of the same string.
//   throttled        15 minutes warm-up, 15 measured (pass floor 95% of the target), plastic exit blocked 10 minutes, then released
//   <input> withheld cold start, one input (crude barrels, then water barrels) withheld for 20 minutes (the others offered throughout), then supplied
export const MINUTES = 3600;
export const FLOOR_SHARE = 0.95;
export const RECOVERY_SHARE = 0.95;
export const WITHHELD_MINUTES = 20;
export function scenarios(m) {
  const out = m.outputPorts[0], target = m.targets[out.item], floor = +(target * FLOOR_SHARE).toFixed(2);
  const bucket = m.collectors[0];
  const fed = Object.fromEntries(m.inputPorts.map(i => [i.id, i.perMinute]));
  const drained = { [out.id]: 'all', [bucket.id]: 'all' }, blocked = { [out.id]: 'none', [bucket.id]: 'all' };
  const recover = { recoverTo: { targets: { [out.id]: target }, share: RECOVERY_SHARE, withinSeconds: 300 } };
  const phase = (name, minutes, draw, extra = {}, feed = fed) => ({ name, ticks: minutes * MINUTES, feed, draw, ...extra });
  const withheld = item => {
    const port = m.inputPorts.find(i => i.item === item);
    return {
      name: `${item} withheld`, description: `cold start; ${item} withheld for ${WITHHELD_MINUTES} minutes (every other entrance at its panel figure), then supplied`,
      phases: [
        phase(`${item} withheld`, WITHHELD_MINUTES, drained, { expect: { maxDrawn: { [out.id]: 0 } } }, { ...fed, [port.id]: 'none' }),
        phase(`${item} supplied`, 15, drained, { measureFrom: 5 * MINUTES, expect: { minDrawn: { [out.id]: floor }, ...recover } }),
      ],
    };
  };
  return {
    throttled: {
      name: 'throttled', description: 'every entrance offered exactly the figure on its panel: warm-up, steady, plastic exit blocked, released',
      phases: [
        phase('warm-up', 15, drained),
        phase('steady', 15, drained, { expect: { minDrawn: { [out.id]: floor }, allMachinesCraft: true } }),
        phase('exit blocked', 10, blocked, { measureFrom: 5 * MINUTES, expect: { maxDrawn: { [out.id]: 0 }, stopped: 3 } }),
        phase('release', 10, drained, { measureFrom: 3 * MINUTES, expect: { minDrawn: { [out.id]: floor }, ...recover } }),
      ],
    },
    'crude-oil-barrel withheld': withheld('crude-oil-barrel'),
    'water-barrel withheld': withheld('water-barrel'),
  };
}
