// Pack governor: the six chest arms hand over one pack of each kind every `period` ticks.
// A timer per pack signal counts up one each tick; an arm runs while its timer shows a whole
// period, and each pack it lifts takes one period off again. So no pack leaves faster than
// 3600 / period per minute, the stock limits upstream hold everything else back, and the
// build draws what the entrance panels state instead of what its fastest pack line can take.
//
//   G (green): timer + bias    constant (bias) + memory output -> the arms' conditions and the counter's input
//   P (red):   hand pulses     every arm reads its hand as a pulse -> the subtractor
//   M (red):   memory loop     counter output + subtractor output + memory output -> memory input
//
// The bias keeps every pack signal non-zero on G, because "each" skips a signal that is zero.
// `banked` whole periods at most are saved while an arm waits (chest full, no pack in reach), so a
// pause is followed by at most that many extra packs. `startDelay` ticks pass before the first
// hand-over: the arms need timer >= startDelay + period, and each pack takes only one period off,
// so the delay is paid once and the build fills its rings and machines at full speed meanwhile.
import {filterOf} from './grid.mjs';

const each = {type: 'virtual', name: 'signal-each'};
const item = name => ({type: 'item', name, quality: 'normal'});

export function governor(L, chests, x, y, {period = 120, bias = 1000, banked = 10, startDelay = 36000} = {}) {
  const tag = role => ({tags: {block: 'governor', role}});
  const products = chests.map(c => c.item);
  const constant = L.tile('constant-combinator', x, y, {control_behavior: {sections: {sections: [{index: 1,
    filters: products.map((name, i) => ({index: i + 1, type: 'item', name, quality: 'normal', comparator: '=', count: bias}))}]}}, ...tag('bias')});
  const vertical = (name, cx, cy, control_behavior, role) => L.addAt(name, {x: cx + .5, y: cy + 1}, {direction: 0, control_behavior, ...tag(role)});
  // Counter: +1 on every pack signal each tick while that pack has fewer than `banked` whole periods saved.
  const counter = vertical('decider-combinator', x + 1, y, {decider_conditions: {
    conditions: [{first_signal: each, comparator: '<', constant: bias + startDelay + banked * period, first_signal_networks: {red: false, green: true}}],
    outputs: [{signal: each, copy_count_from_input: false, constant: 1}]}}, 'counter');
  const memory = vertical('arithmetic-combinator', x, y + 1, {arithmetic_conditions: {first_signal: each, second_constant: 1, operation: '*', output_signal: each}}, 'memory');
  const subtractor = vertical('arithmetic-combinator', x + 1, y + 2, {arithmetic_conditions: {first_signal: each, second_constant: -period, operation: '*', output_signal: each}}, 'subtractor');
  // Label on the free tile beside the subtractor.
  const label = L.tile('display-panel', x, y + 3, {icon: {type: 'item', name: 'decider-combinator'},
    text: `PACK GOVERNOR · ${3600 / period}/min of each pack\nFirst packs ${startDelay / 3600} min after power-on`, always_show: true, ...tag('label')});
  const wire = (a, ca, b, cb) => L.wires.push([a.entity_number, ca, b.entity_number, cb]);
  const RED = 1, GREEN = 2, OUT_RED = 3, OUT_GREEN = 4;
  const arms = chests.map(c => c.arm);
  for (const [i, arm] of arms.entries()) {
    Object.assign(arm, filterOf([products[i]]), {override_stack_size: 1,
      control_behavior: {circuit_enabled: true, circuit_condition: {first_signal: item(products[i]), comparator: '≥', constant: bias + startDelay + period},
        circuit_read_hand_contents: true, circuit_hand_read_mode: 0}});
    arm.tags = {...arm.tags, governed: true};
    if (i) { wire(arms[i - 1], GREEN, arm, GREEN); wire(arms[i - 1], RED, arm, RED); }
  }
  const last = arms.at(-1);
  wire(constant, GREEN, last, GREEN);
  wire(counter, GREEN, constant, GREEN);
  wire(memory, OUT_GREEN, constant, GREEN);
  wire(subtractor, RED, last, RED);
  wire(counter, OUT_RED, memory, RED);
  wire(memory, OUT_RED, memory, RED);
  wire(subtractor, OUT_RED, memory, RED);
  return {name: 'pack-governor', periodTicks: period, perMinute: 3600 / period, bias, bankedPeriods: banked, startDelayTicks: startDelay, enableAt: bias + startDelay + period, counterStopsAt: bias + startDelay + banked * period,
    label: label.entity_number, constant: constant.entity_number, counter: counter.entity_number, memory: memory.entity_number, subtractor: subtractor.entity_number,
    arms: arms.map((a, i) => ({item: products[i], arm: a.entity_number}))};
}
