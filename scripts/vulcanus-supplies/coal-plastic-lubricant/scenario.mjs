// Native scenarios of the coal-plastic-lubricant supply. Minutes are converted to ticks here; control.lua only runs the list.
//   generous: every entrance offered more than it can use (full belts, full pipes); two extra phases measure what the exits can give at most
//   throttled: every entrance offered exactly the figure on its panel
// "Drained" is: plastic bars taken off the exit belt as fast as they arrive, lubricant taken at its target figure (300 a minute) from the exit pipe.
export const MINUTES = 3600;
export const FLOOR_SHARE = 0.99;        // a measured rate passes at this share of its target
export const RECOVERY_SHARE = 0.95;     // after a release or an outage a product is back when its trailing minute reaches this share
export function scenarios(m) {
  const plastic = m.outputPorts.find(o => o.item === 'plastic-bar'), lub = m.outputPorts.find(o => o.item === 'lubricant');
  const tp = m.targets['plastic-bar'], tl = m.targets.lubricant;
  const floor = t => +(t * FLOOR_SHARE).toFixed(2);
  const none = Object.fromEntries(m.inputPorts.map(i => [i.id, 'none']));
  const mk = (name, description, feed, extra = []) => {
    const draw = (p, l) => ({ [plastic.id]: p, [lub.id]: l });
    const drained = draw('all', tl), noLub = draw('all', 'none'), noPlastic = draw('none', tl), neither = draw('none', 'none');
    const phase = (pname, minutes, d, ex = {}, more = {}) => ({ name: pname, ticks: minutes * MINUTES, feed: more.feed || feed, draw: d, ...ex });
    const both = { minDrawn: { [plastic.id]: floor(tp), [lub.id]: floor(tl) } };
    const recover = { recoverTo: { targets: { [plastic.id]: tp, [lub.id]: tl }, share: RECOVERY_SHARE, withinSeconds: 600 } };
    return {
      name, description, phases: [
        phase('warm-up', 15, drained),
        phase('steady', 30, drained, { expect: { ...both, allMachinesCraft: true } }),
        phase('lubricant exit blocked', 15, noLub, { measureFrom: 5 * MINUTES, expect: { minDrawn: { [plastic.id]: floor(tp) }, maxDrawn: { [lub.id]: 0 } } }),
        phase('release after lubricant block', 10, drained, { measureFrom: 5 * MINUTES, expect: { ...recover } }),
        phase('plastic exit blocked', 15, noPlastic, { measureFrom: 5 * MINUTES, expect: { minDrawn: { [lub.id]: floor(tl) }, maxDrawn: { [plastic.id]: 0 } } }),
        phase('release after plastic block', 10, drained, { measureFrom: 5 * MINUTES, expect: { ...recover } }),
        phase('both exits blocked', 15, neither, { measureFrom: 5 * MINUTES, expect: { maxDrawn: { [plastic.id]: 0, [lub.id]: 0 }, stopped: 5 } }),
        phase('release after both blocked', 15, drained, { measureFrom: 5 * MINUTES, expect: { ...recover } }),
        phase('input outage', 5, drained, {}, { feed: none }),
        phase('recovery after outage', 15, drained, { measureFrom: 5 * MINUTES, expect: { ...recover } }),
        ...extra.map(e => phase(e.name, 10, e.draw, { measureFrom: 5 * MINUTES })),
      ],
    };
  };
  const generous = Object.fromEntries(m.inputPorts.map(i => [i.id, 'generous']));
  const throttled = Object.fromEntries(m.inputPorts.map(i => [i.id, i.perMinute]));
  return {
    generous: mk('generous', 'every entrance offered more than the blueprint can use; two capacity phases at the end', generous, [
      { name: 'capacity: both exits unlimited', draw: { [plastic.id]: 'all', [lub.id]: 'all' } },
      { name: 'capacity: lubricant unlimited, plastic blocked', draw: { [plastic.id]: 'none', [lub.id]: 'all' } },
    ]),
    throttled: mk('throttled', 'every entrance offered exactly the figure on its panel', throttled),
  };
}
