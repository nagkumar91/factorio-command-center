// Compact metallurgic science pack blueprint (Factorio 2.1.25, Space Age, Vulcanus). A pure function of the pinned prototypes.
//
// The recipe (read from the pinned dump, never from a brief): 3 tungsten carbide + 2 tungsten plate + 200 molten copper -> 1
// metallurgic science pack, 10 s, crafting category `metallurgy`, only where the surface pressure is exactly 4000 (Vulcanus).
// That category belongs to the foundry, not to an assembling machine, so the one machine here is a foundry (speed 4, built-in
// productivity 50%). No assembling machine 2 or 3 can craft it.
//
// Tiles (x east, y south), 9 x 6:
//   rows 0..4   foundry (cols 2..6, facing north: its two molten-copper inputs are on the south side, its outputs face nothing)
//   (0,0) (0,3) requester chests: tungsten carbide, tungsten plate; fast inserters (1,0) (1,3) put them into the foundry; panels (0,1) (0,4)
//   (7,2) (8,2) output fast inserter and the passive provider chest (one slot)
//   (3,5)       molten-copper pipe, the only fluid entrance (the second input port faces nothing)
//   (7..8,3..4) substation, the one power entry
import assert from 'node:assert/strict';
import { Layout, N, W, analyzeFluids } from '../vulcanus-circuits/lib.mjs';

export const ID = 'metallurgic-compact';
export const PRODUCT = 'metallurgic-science-pack';
export const TARGET_PER_MINUTE = 16;       // at least the 15.93 a minute the 110-entity design measured
export const REQUEST_MINUTES = 2;          // each requester asks for two minutes of its ingredient

export function sizing(p) {
  const r = p.recipes[PRODUCT], foundry = p.entities.foundry;
  const amount = (list, name) => list.find(v => v.name === name).amount;
  const time = r.energy_required, speed = foundry.crafting_speed, productivity = foundry.effect_receiver.base_effect.productivity;
  const packsPerCraft = amount(r.results, PRODUCT) * (1 + productivity);
  const maxCraftsPerMinute = 60 / time * speed, maxPacksPerMinute = maxCraftsPerMinute * packsPerCraft;
  const craftsPerMinute = TARGET_PER_MINUTE / packsPerCraft;
  const per = name => amount(r.ingredients, name) * craftsPerMinute;
  const perMinute = { 'tungsten-carbide': per('tungsten-carbide'), 'tungsten-plate': per('tungsten-plate'), 'molten-copper': per('molten-copper') };
  const stack = name => p.items[name].stack_size;
  const request = Object.fromEntries(['tungsten-carbide', 'tungsten-plate'].map(n => [n, Math.ceil(perMinute[n] * REQUEST_MINUTES - 1e-9)]));
  return {
    recipe: PRODUCT, craftSeconds: time, foundrySpeed: speed, foundryProductivity: productivity, packsPerCraft,
    maxCraftsPerMinute, maxPacksPerMinute, target: TARGET_PER_MINUTE, craftsPerMinute, foundryUtilisation: craftsPerMinute / maxCraftsPerMinute,
    foundriesNeeded: craftsPerMinute / maxCraftsPerMinute, foundries: 1, spareFoundries: 0, headroomPacksPerMinute: maxPacksPerMinute - TARGET_PER_MINUTE,
    perMinute, requestMinutes: REQUEST_MINUTES, request, stackSize: Object.fromEntries(['tungsten-carbide', 'tungsten-plate', PRODUCT].map(n => [n, stack(n)])),
    outputCap: stack(PRODUCT),
  };
}

export function design(p, slots) {
  const z = sizing(p), L = new Layout();
  const foundry = L.machine('foundry', 4, 2, PRODUCT, N, 'metallurgic-science-pack', 'foundry');
  const requester = (y, item) => L.add('requester-chest', 0, y, { request_filters: { sections: [{ index: 1, filters: [{ index: 1, name: item, quality: 'normal', comparator: '=', count: z.request[item] }] }] } });
  const carbideChest = requester(0, 'tungsten-carbide'), plateChest = requester(3, 'tungsten-plate');
  L.arm('fast-inserter', 1, 0, W, 'tungsten-carbide requester chest -> foundry');
  L.arm('fast-inserter', 1, 3, W, 'tungsten-plate requester chest -> foundry');
  L.arm('fast-inserter', 7, 2, W, 'foundry -> metallurgic-science-pack provider chest');
  const outChest = L.add('passive-provider-chest', 8, 2, { bar: 1 });
  const pipe = L.pipe(3, 5);
  const sub = L.add('substation', 7, 3);
  const rate = v => (Math.round(v * 10) / 10).toLocaleString('en-US');
  const panels = {
    carbide: L.panel(0, 1, `IN: tungsten-carbide, requester chest, request ${z.request['tungsten-carbide']} (${z.requestMinutes} min), ${rate(z.perMinute['tungsten-carbide'])}/min`, 'tungsten-carbide'),
    plate: L.panel(0, 4, `IN: tungsten-plate, requester chest, request ${z.request['tungsten-plate']} (${z.requestMinutes} min), ${rate(z.perMinute['tungsten-plate'])}/min`, 'tungsten-plate'),
    copper: L.panel(4, 5, `IN: molten-copper pipe ${rate(z.perMinute['molten-copper'])}/min`, 'molten-copper', 'fluid'),
    out: L.panel(8, 1, `OUT: ${PRODUCT} provider chest, one stack (${z.outputCap}), ${z.target}/min`, PRODUCT),
    power: L.panel(7, 5, 'POWER: connect this substation', 'substation'),
  };
  assert.deepEqual(L.bounds(), { x0: 0, y0: 0, x1: 8, y1: 5, width: 9, height: 6 });
  const inputs = [
    { id: 'IN-1', item: 'tungsten-carbide', kind: 'requester-chest', side: 'west', entity: carbideChest, panel: panels.carbide, perMinute: z.perMinute['tungsten-carbide'], request: z.request['tungsten-carbide'] },
    { id: 'IN-2', item: 'tungsten-plate', kind: 'requester-chest', side: 'west', entity: plateChest, panel: panels.plate, perMinute: z.perMinute['tungsten-plate'], request: z.request['tungsten-plate'] },
    { id: 'IN-3', item: 'molten-copper', kind: 'pipe', side: 'south', entity: pipe, panel: panels.copper, perMinute: z.perMinute['molten-copper'] },
  ];
  const outputs = [{ id: 'OUT-1', item: PRODUCT, kind: 'passive-provider-chest', side: 'east', entity: outChest, panel: panels.out, perMinute: z.target, capStacks: 1, cap: z.outputCap }];
  return {
    id: ID, layout: L, sizing: z, inputs, outputs, foundry, power: { entry: sub, panel: panels.power, label: 'POWER: connect this substation', externalPole: { x: 12, y: 4 } },
    label: 'Metallurgic science pack | compact | 16 a minute', icons: [PRODUCT, 'foundry', 'requester-chest', 'substation'],
    description: `Factorio ${p.gameVersion} Space Age, Vulcanus only. One foundry makes metallurgic science packs (${z.target} a minute) from tungsten carbide and tungsten plate in two requester chests (${z.request['tungsten-carbide']} and ${z.request['tungsten-plate']}) and molten copper by pipe at the south. Packs go to one passive provider chest (one stack). Connect power to the substation. No modules or beacons.`,
  };
}
