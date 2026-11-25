// Native scenarios of the tungsten-carbide supply. Minutes are converted to ticks here; control.lua only runs the list.
//   generous: every entrance offered more than it can use (full belts, full pipe)
//   throttled: every entrance offered exactly the figure on its panel (belts: items at that rate; pipe: fluid at that rate)
// The exit belt is emptied every four ticks except where the phase says it is blocked.
export const MINUTES = 3600;
export const FLOOR_SHARE = 0.99;        // a measured rate passes at this share of its target
export const RECOVERY_SHARE = 0.95;     // after a release or an outage a product is back when its trailing minute reaches this share
export function scenarios(m) {
  const out = m.outputPorts[0], target = m.targets[out.item];
  const generous = Object.fromEntries(m.inputPorts.map(i => [i.id, 'generous']));
  const throttled = Object.fromEntries(m.inputPorts.map(i => [i.id, i.perMinute]));
  const drained = { [out.id]: 'all' }, blocked = { [out.id]: 'none' };
  const mk = (name, description, feed) => {
    const phase = (pname, minutes, draw, extra = {}, feedOverride) => ({ name: pname, ticks: minutes * MINUTES, feed: feedOverride || feed, draw, ...extra });
    return {
      name, description, phases: [
        phase('warm-up', 15, drained),
        phase('steady', 30, drained, { expect: { minDrawn: { [out.id]: +(target * FLOOR_SHARE).toFixed(2) }, allMachinesCraft: true } }),
        phase('exit blocked', 15, blocked, { measureFrom: 5 * MINUTES, expect: { maxDrawn: { [out.id]: 0 }, stopped: 5 } }),
        phase('release', 15, drained, { measureFrom: 5 * MINUTES, expect: { minDrawn: { [out.id]: +(target * FLOOR_SHARE).toFixed(2) }, recoverTo: { targets: { [out.id]: target }, share: RECOVERY_SHARE, withinSeconds: 300 } } }),
        phase('input outage', 5, drained, {}, Object.fromEntries(m.inputPorts.map(i => [i.id, 'none']))),
        phase('recovery', 15, drained, { measureFrom: 5 * MINUTES, expect: { minDrawn: { [out.id]: +(target * FLOOR_SHARE).toFixed(2) }, recoverTo: { targets: { [out.id]: target }, share: RECOVERY_SHARE, withinSeconds: 300 } } }),
      ],
    };
  };
  return { generous: mk('generous', 'every entrance offered more than the blueprint can use', generous), throttled: mk('throttled', 'every entrance offered exactly the figure on its panel', throttled) };
}
