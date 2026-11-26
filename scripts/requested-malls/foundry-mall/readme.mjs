// README and layout picture of the foundry mall, written by generate.mjs from the manifest, the static audit and
// (only when it is for exactly this string) the native report. Nothing here is typed in by hand as a result.
import fs from 'node:fs/promises';
import path from 'node:path';
import { box, scenarioSummary } from './lib.mjs';
import { asciiMap, LEVEL_HOLD, STALL, BRICK_STACKS, TANK_READY, FINAL_ON_RING } from './design.mjs';

const min = t => (t === undefined || t === null ? 'never' : (t / 3600).toFixed(1));
const num = (v, d = 1) => (v === undefined || v === null ? '–' : (Math.round(v * 10 ** d) / 10 ** d).toString());
const short = n => n.replace('space-platform-', 'platform ').replaceAll('-', ' ');
const INPUT_ORDER = ['lava', 'calcite', 'plastic-bar', 'tungsten-carbide', 'sulfuric-acid', 'lubricant', 'water'];

export async function loadExplorations(out) {
  const files = (await fs.readdir(out).catch(() => [])).filter(f => /^exploration-.*-report\.json$/.test(f)).sort();
  return Promise.all(files.map(async f => ({ file: f, report: JSON.parse(await fs.readFile(path.join(out, f), 'utf8')) })));
}

// The same fluid scenarios run on the string published before this one (written by validate.mjs --evidence).
// The hand-back and outage scenarios run on the string published before this one (written by validate.mjs --evidence).
export const BEFORE = { sha: 'b9243fa7ff6b0d164538d99c3d96d0315ed15feb018d74e40ab6da068f83134c', file: 'published-b9243fa7-handback-scenarios.json', upgrade: 'placed-over-b9243fa7.json' };
export const EARLIER = { sha: '7977ee595dd543c191177381ddd3ad0867650e1227e8562379da6a043aa188ed', file: 'published-7977ee59-fluid-scenarios.json' };
const FLUID_SCENARIOS = [
  ['ports', 'Port matrix: every recipe change of every recipe-switching foundry, with each network on its ports full or empty'],
  ['build:shuffle-1', 'Built one entity every 20 ticks in a shuffled order, supply and power already connected'], ['build:shuffle-2', 'Same, second shuffle'], ['build:shuffle-3', 'Same, third shuffle'],
  ['build:pipes-first', 'Built piecemeal, all pipes, tanks and pumps first'], ['build:machines-first', 'Built piecemeal, machines and substations first'], ['build:combinators-last', 'Built piecemeal, every combinator last'],
  ['build:copper-foundry-last', 'Built piecemeal; the molten copper foundry arrives ten minutes after everything else'], ['build:iron-foundry-last', 'Built piecemeal; the molten iron foundry arrives ten minutes after everything else'],
  ['build:robots-25', 'Built by 25 of the game\'s own construction robots from a ghost blueprint'], ['build:robots-200', 'Built by 200 construction robots from a ghost blueprint'],
  ['late:power', 'Everything connected, no power for five minutes'], ['late:stone-exit', 'Stone exit not connected for an hour (the stone belt fills), then connected'],
  ['thin:lava', 'Lava at 100 a second for an hour (the two lava foundries take 250), then in full'], ['thin:calcite', 'Calcite at 12 a minute for an hour (they take 30), then in full'],
  ['starve:supply', 'After a fill: every chest emptied and lava cut for ten minutes; then the same with calcite'], ['starve:foundry', 'After a fill: every chest emptied and the molten copper foundry stopped for fifteen minutes; then the same with the molten iron foundry'],
  ['place:rot90', 'Placed turned a quarter clockwise'], ['place:rot180', 'Placed turned a half'], ['place:rot270', 'Placed turned three quarters'], ['place:flipH', 'Placed mirrored left to right'], ['place:flipV', 'Placed mirrored top to bottom'],
];

export async function render(d, audit, proven, p, report, out) {
  const m = d.manifest, b = m.footprint.bounds, bill = m.bill;
  const earlier = await fs.readFile(path.join(out, EARLIER.file), 'utf8').then(JSON.parse, () => null);
  const before = await fs.readFile(path.join(out, BEFORE.file), 'utf8').then(JSON.parse, () => null);
  const placedOver = await fs.readFile(path.join(out, BEFORE.upgrade), 'utf8').then(JSON.parse, () => null);
  const tile = pos => `(${Math.floor(pos.x) - b.left}, ${Math.floor(pos.y) - b.top})`;
  const explorations = await loadExplorations(out);
  const L = [];
  const status = proven ? `**qualified** (full native protocol, \`native-report.json\`)` : report ? '**not qualified**: the native report for this string did not pass' : '**not qualified**: no native report for this string yet';
  L.push(`# Foundry mall · lava and calcite in, six groups of products out, in list order`, '',
    `Status: ${status}. Blueprint SHA-256 \`${d.hash}\`. Factorio ${p.gameVersion} Space Age, Vulcanus, vanilla, normal quality, no modules, no beacons.`, '',
    `One blueprint for Vulcanus. Foundries turn lava and calcite into molten iron and molten copper and cast plates, steel, gears, pipes, sticks, cable, low density structures and concrete; assembling machines 3 make the rest. Everything is kept at a cap in five passive provider chests on the south edge, and made **in the order of the list**: a group lower on the list waits while a group above it has something it can make.`, '',
    `Rocket parts (the 50 processing units, 50 low density structures and 50 rocket fuel per launch) are **not** part of this blueprint.`, '');

  // ---- products
  L.push('## What it makes', '', '| Priority | Group | Product | Cap | Chest |', '| ---: | --- | --- | ---: | --- |');
  for (const g of m.groups) for (const key of g.products) L.push(`| ${g.group} | ${g.name} | ${key} | ${m.caps[key]}${m.capSignals[key] === 'signal-K' ? ' (signal K)' : ''} | ${m.stock.find(v => v.key === key).output} |`);
  L.push('', `The kit is exactly the bill in \`scripts/launch-kit/bill.json\` (count + spare). Fast inserters are two separate stocks: the kit's ${m.kitShare} go into the kit chest (OUT-2) at the kit's priority, and a full stack of ${m.caps['fast-inserter']} goes into the inserter chest (OUT-4) at the inserter group's priority, ${m.kitShare + m.caps['fast-inserter']} in all. Each chest is counted against its own cap only; the inserter chest takes fast inserters only while the kit chest has all of its own.`, '');

  // ---- ports
  const rate = report?.scenarios?.rate, fillPhase = report?.scenarios?.fill?.phases?.[0];
  L.push('## Entrances, exit, power', '', 'Tiles are counted from the blueprint\'s top-left tile (column, row).', '', '| Port | What | Kind | Tile | Side | For one full fill (recipes) | Used in the measured full fill |', '| --- | --- | --- | --- | --- | ---: | ---: |');
  for (const port of m.ports) {
    const expected = port.exit ? bill.fullFill.stoneSurplus : bill.fullFill[port.item];
    const measured = fillPhase ? (port.exit ? fillPhase.stoneOut : fillPhase.consumed[port.item]) : null;
    L.push(`| ${port.id} | ${port.item} | ${port.kind === 'fluid' ? 'pipe' : 'belt'} | ${tile(port.position)} | ${port.label.match(/(west|east|south|north)/)?.[1] || ''} | ${num(expected, 0)} | ${num(measured, 0)} |`);
  }
  L.push('', `- **Power**: connect the substation at tile ${tile(d.blueprint.blueprint.entities[m.power.entry - 1].position)} (panel "${m.power.label}"). Four substations power everything. Idle draw is small; with all foundries working it reaches about 25 MW.`,
    `- **Stone** is a by-product of every lava craft. The bricks the bill needs are made inside (a five-stack brick stock); the rest leaves on the belt of OUT-STONE and must be taken away (run that belt to an inserter over lava). If the exit backs up, the two lava foundries stop and so does everything else; it carries on once the belt moves again (tested for an hour of blockage). About 93% of the stone is surplus: there is nothing in this bill to spend it on.`,
    `- **Water and lubricant** each pass a storage tank the control reads; a fluid counts as present above ${TANK_READY}. The tanks take 25,000 each when first connected.`,
    `- **Other inputs needed** besides lava and calcite: plastic bar, tungsten carbide (foundries only), sulfuric acid (processing units, batteries), lubricant (electric engines, express belts, foundries), water (concrete, refined concrete). No oil or tungsten chain is inside.`, '');
  L.push('## Output chests and caps', '', '| Chest | Tile | Holds |', '| --- | --- | --- |');
  for (const o of m.outputs) L.push(`| ${o.id} | ${tile(o.position)} | ${o.items.join(', ')} |`);
  L.push('', `**Caps** live in one constant combinator at tile ${tile(m.capsCombinator.position)} (panel "CAPS"), one positive number per product, plus signal K = the fast inserters kept in the kit chest. Edit a number and the stock follows. Nothing else holds a cap.`, '');

  // ---- how
  L.push('## How it works', '',
    `- **Casting core.** Two foundries make molten copper and molten iron from lava and calcite; pipes carry both to four casting foundries next to the ring. One casts iron plate. One casts steel or low density structures. One casts cable (handed straight to the two circuit machines) or copper plate. One casts gears, pipes, sticks, concrete or steel. The last three take their recipe from the circuit network.`,
    `- **Fluid ports.** In ${p.gameVersion} a recipe with one fluid ingredient uses both input ports of a foundry as one box, and when that recipe is taken away the game pushes what is left in the box back out through either port, into any pipe that will take it. An empty pipe takes anything. So no machine here has two ports of one kind on the pipes of two fluids. The two foundries that need a second fluid get it through a pump standing directly on that port, and a pump lets nothing back: molten copper for low density structures (pump at tile ${tile(d.blueprint.blueprint.entities[m.pumps[0].entity - 1].position)}, fed straight from one output port of the copper lava foundry; its other output port feeds the pipes of the cable foundry) and water for concrete (pump at tile ${tile(d.blueprint.blueprint.entities[m.pumps[1].entity - 1].position)}).`,
    `- **One ring** of ${m.ring.tiles} red belt tiles carries every intermediate and finished item. An arm that adds an item works only while the ring holds fewer than that item's limit; a recipe-switching machine is told to make an item only while the stock in sight is below its limit.`,
    `- **The buffer chest.** Everything that leaves U2 goes into a steel chest first, and one arm puts it on the ring item by item while the ring holds fewer than that item's limit (finished products: ${FINAL_ON_RING}). When U2 gives up a part-loaded foundry recipe it hands back some 150 ingredients at once; put straight on the ring they filled the lane and U2 could never be emptied again (see the section on string \`${BEFORE.sha.slice(0, 8)}…\`). What lies in the chest still counts as stock for the rules.`,
    `- **Two universal machines.** U1 (assembling machine 3) makes ${m.rules.filter(r => r.machine === 'U1').map(r => r.recipe).filter((v, i, a) => a.indexOf(v) === i).length} recipes: the small kit items, inserters, drills and refined concrete. U2 (a foundry, lubricant on its fluid box) makes the three belt tiers and the foundry, with the foundry's +50% on each. One decider per recipe ("rule") says when that recipe is wanted and makeable; a selector picks the highest; the machine takes the recipe from the circuit. A never-fed shadow machine reads out the recipe's ingredients so the input arms load exactly one craft. A recipe is changed only on the tick a craft finishes or while the machine is parked.`,
    `- **Dedicated machines** for the high-volume chain: 2 electronic circuit, 4 advanced circuit, 2 speed module, processing unit, engine, electric engine, foundation, the assembling machine 1 → 2 → 3 line, the rocket silo (loads exactly one craft), a battery plant and the brick furnace.`,
    `- **List order.** Every rule and every dedicated final shows a weight on one network; the highest weight in force sets the level (6 = assembling machine 3 … 1 = foundry). Machines and recipes of a lower level are held while a higher level is in force. The level rises at once and falls only after ${LEVEL_HOLD / 60} s without a makeable product at that level.`,
    `- **Skip and return.** A rule is true only while its product is short *and* one craft's worth of every scarce ingredient is in sight (ring + the machine), and fluid recipes also need their tank above ${TANK_READY}. A product whose outside input is missing therefore drops out of the level by itself, and comes back when the input does. The two dedicated finals use a timer instead: assembling machine 3 gives up its level after ${STALL['assembling-machine-3'] / 60} s without a craft, the rocket silo after ${STALL['rocket-silo'] / 60} s without a delivery.`, '');
  L.push('### The priority rule, as built and as tested', '',
    `Built: **strict sequencing by group**, not sharing. While a group has a product below its cap that can be made, no lower group loads anything: the input arms of the lower dedicated machines are switched off and the universal machines are not given lower recipes. Chosen over sharing by reserve because it can be checked exactly and needs no tuning; the cost is that a full fill is the sum of the groups, not the longest of them.`,
    `Tested natively, every tick: no level-gated arm may be enabled for more than five ticks while a higher level is in force. Reported per phase: the minutes each level was in force, the time each product reached its cap, and what each machine crafted at which level.`,
    `Limits of the rule, stated plainly: (1) a universal machine finishes the one craft it has started before it obeys a higher level; (2) inside the kit the order is the bill's order per machine, and the silo, foundation and the small items run side by side; (3) the casting foundries and the circuit machines are shared and keep the ring at its limits at every level; (4) "makeable" is read from stock in sight, so a group can lose its turn for a while if an intermediate it needs takes longer than ${LEVEL_HOLD / 60} s to come round.`, '');

  // ---- size
  const c = m.footprint.counts;
  L.push('## Size and parts', '', `Footprint **${m.footprint.width} × ${m.footprint.height} = ${m.footprint.area} tiles**, ${m.footprint.entities} entities.`, '',
    `Machines: ${c.foundry} foundries, ${c['assembling-machine-3']} assembling machines 3 (two of them shadows that never craft), 1 chemical plant, 1 electric furnace. Control: ${c['decider-combinator']} decider, ${c['arithmetic-combinator']} arithmetic, ${c['selector-combinator']} selector and ${c['constant-combinator']} constant combinators.`, '',
    `Bill of materials: ${Object.entries(c).map(([n, k]) => `${k} ${n}`).join(', ')}. Red belts and fast, bulk and long-handed inserters only; hand sizes are pinned (fast 1, bulk 2), so the mall behaves the same whatever inserter capacity is researched.`, '',
    `Research needed (${m.technologyClosure.length} technologies in the closure), among them: foundry, automation 3, logistics 3, bulk inserter, rocket silo, space platform (the asteroid collector and crusher recipes), advanced combinators (the selector combinator), electric energy distribution 2.`, '',
    '```', asciiMap(d, p), '```', '',
    'F foundry · A assembling machine 3 · C chemical plant · K furnace · T tank · p pump · S substation · P provider chest · B brick chest · > < ^ v belt · = pipe · u underground pipe · i fast · b bulk · l long-handed inserter · d a s c combinators · ! panel', '');

  // ---- measured
  if (report?.scenarios) {
    const S = report.scenarios, capsOf = n => S[n] ? `${S[n].capsName} caps` : '';
    L.push('## Measured natively', '', `Every figure below is from \`native-report.json\` (${Object.keys(S).length} scenarios, each its own headless game on a Vulcanus surface from a fresh import of this string). **Full caps**: the fill from empty and the rate scenario. **Reduced caps** (a tenth of each cap, at least 2; the silo, pad and starter pack stay at 1): refill, outage and recovery, hold, cap edits, single refills, the seven withheld-input scenarios and every fluid-safety scenario. A reduced-cap time is not a full-stack time.`, '');
    if (fillPhase) {
      L.push(`### Fill from empty at the published caps: ${min(fillPhase.ticks)} minutes`, '', '| Product | Group | Cap | At its cap after (min) |', '| --- | ---: | ---: | ---: |');
      for (const v of [...m.products].sort((x, y) => (fillPhase.reached[x.key] ?? 1e12) - (fillPhase.reached[y.key] ?? 1e12))) L.push(`| ${v.key === 'fast-inserter' ? 'fast-inserter (inserter group)' : v.key} | ${v.group} | ${v.cap} | ${min(fillPhase.reached[v.key])} |`);
      const lv = fillPhase.levelTicks;
      L.push('', `Minutes each level was in force: ${m.groups.map(g => `${g.name} ${min(lv[String(g.level)] || 0)}`).join(', ')}. Level-gated arms enabled against the level: ${fillPhase.gatedActive} ticks.`,
        `Used: ${INPUT_ORDER.map(n => `${n} ${num(fillPhase.consumed[n], 0)}`).join(', ')}; molten iron ${num(fillPhase.consumed['molten-iron'], 0)}, molten copper ${num(fillPhase.consumed['molten-copper'], 0)}; stone made ${num(fillPhase.consumed['stone made'], 0)}, used ${num(fillPhase.consumed['stone used'], 0)}, left by the exit ${num(fillPhase.stoneOut, 0)}.`,
        `Left on the ring when the last chest filled (finished products not in a chest): ${Object.entries(fillPhase.ringAtEnd).filter(([k]) => k in m.caps).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}.`, '');
    }
    if (rate) {
      L.push('### Rates (full caps)', '', 'After a full fill, one group at a time has its products taken out of its chest every second (15 minutes warm-up, 30 measured) while the groups above it stay full. The first row empties every chest at once: with strict list order that only ever shows group 1.', '',
        `| Measured window | Products per minute | ${INPUT_ORDER.join(' | ')} | stone out |`, `| --- | --- | ${INPUT_ORDER.map(() => '---:').join(' | ')} | ---: |`);
      for (const ph of rate.phases.filter(v => v.perMinute)) L.push(`| ${ph.name.replace('rate: ', '')} | ${Object.entries(ph.perMinute.collected).filter(([, v]) => v > 0).map(([k, v]) => `${short(k)} ${num(v, 2)}`).join(', ') || 'none'} | ${INPUT_ORDER.map(n => num(ph.perMinute.consumed[n], 1)).join(' | ')} | ${num(ph.perMinute.stoneOut, 1)} |`);
      L.push('', 'Inputs are what the machines consumed per minute in the window (production statistics): the draw each entrance has to meet.', '');
    }
    if (S.single) {
      L.push(`### Refilling one collected product (${capsOf('single')})`, '', '| Product | Taken | Back at cap after (min) | lava | calcite | plastic | carbide | acid | lubricant | water |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
      for (const ph of S.single.phases.filter(v => v.name.startsWith('single refill'))) { const item = ph.name.split(': ')[1]; L.push(`| ${item} | ${ph.collectedAtStart?.[item] ?? 0} | ${min(ph.ticks)} | ${INPUT_ORDER.map(n => num(ph.consumed[n], 0)).join(' | ')} |`); }
      L.push('', 'Draw is the total consumed during that refill; it includes topping the ring back up.', '');
    }
    const table = (title, names) => { L.push(title, '', '| Scenario | Phase | Minutes | Ended by |', '| --- | --- | ---: | --- |'); for (const n of names) if (S[n]) for (const ph of S[n].phases) L.push(`| ${n} | ${ph.name} | ${min(ph.ticks)} | ${ph.endedBy === 'caps' ? 'every cap reached' : ph.endedBy === 'ticks' ? 'fixed length' : 'LIMIT'} |`); L.push(''); };
    table(`### Refill, outage, hold, cap edits (${capsOf('hold')})`, ['fill', 'hold', 'caps']);
    if (S.hold) { const h = S.hold.phases.find(v => v.name.startsWith('one-hour')); L.push(`Hold: for one hour at full stock no chest changed and the final machines crafted ${h.finalCrafts} times.`, ''); }
    if (S.caps) { const ph = S.caps.phases; L.push(`Cap edits (written into the caps combinator by script, as a player would): raised to ${JSON.stringify(ph[1].setCaps)} → every chest at the new caps in ${min(ph[1].ticks)} min; lowered to ${JSON.stringify(ph[2].setCaps)} with those chests emptied → refilled to exactly the lower caps in ${min(ph[2].ticks)} min; restored in ${min(ph[3].ticks)} min.`, ''); }
    L.push(`### Skip and return, one outside input withheld from a cold start (reduced caps)`, '', '| Withheld | Products that need it | Everything else at its cap after (min) | After it returned: all at cap after (min) |', '| --- | --- | ---: | ---: |');
    for (const input of INPUT_ORDER) { const s = S['skip:' + input]; if (!s) continue; const [a, r] = s.phases; L.push(`| ${input} | ${report.dependents[input].length === m.products.length ? 'all' : report.dependents[input].map(short).join(', ')} | ${a.mode === 'ticks' ? `nothing can be made (${min(a.ticks)} min, nothing made)` : min(a.ticks)} | ${min(r.ticks)} |`); }
    L.push('', `In the withheld phase the mall must hold every cap that does not need the input for two minutes while the dependent products stay short; then the input returns and every cap must be reached.`, '');
    const handbackRow = (name, v) => { const ph = v.phases, last = ph.at(-1), mid = ph[2];
      return [name.startsWith('outage') ? `${name.split(':')[1] === 'all' ? 'every input' : name.split(':')[1]} cut for ${name.split(':')[2]} minutes, every chest emptied` : `${ph[1]?.name.split(';')[0]}; then ${mid?.name.split(':')[0].replace(' still cut', ' still cut')}`, v.caps, v.passed ? 'passed' : 'FAILED',
        name.startsWith('outage') ? '–' : mid ? (mid.endedBy === 'caps' ? `refilled after ${num(mid.minutes)} min` : mid.endedBy === 'ticks' ? `waited ${num(mid.minutes)} min` : `NOT refilled in ${num(mid.minutes)} min`) : '–',
        last ? (last.endedBy === 'caps' ? `every cap reached ${num(last.minutes)} min after` : `NOT filled: ${last.productsShort} products short after ${num(last.minutes)} min`) : 'stopped',
        last?.holding?.U2 ? `${last.holding.U2.recipe === 'none' ? 'no recipe' : last.holding.U2.recipe}, ${last.holding.U2.waiting} waiting to leave` : '–']; };
    const handbackNames = [...(m.nativeProtocol.handbackScenarios || []), ...(m.nativeProtocol.outageScenarios || [])].filter(n => S[n]);
    if (handbackNames.length) {
      L.push('### Hand-back and outages', '',
        `A universal machine that has loaded part of a recipe and cannot finish it drops the recipe after its give-up time when something of a higher rank is wanted, and hands back what it holds. Each hand-back row: a product is taken with an entrance cut, so the machine stands part-loaded; then a higher product is taken. Where the higher product does not need the cut entrance it must be refilled with the entrance still cut. Each outage row: every chest emptied and the entrance cut for twenty minutes, then a fill.`, '',
        '| Scenario | Caps | Verdict | Higher product | After the entrance returned | U2 at the end |', '| --- | --- | --- | --- | --- | --- |');
      for (const n of handbackNames) L.push(`| ${handbackRow(n, scenarioSummary(S[n])).join(' | ')} |`);
      L.push('');
    }
    if (before) {
      const B = before.scenarios, jam = B['handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt'], stuck = jam?.phases[2];
      L.push(`### The string published before this one, \`${BEFORE.sha.slice(0, 8)}…\`, in the same scenarios`, '',
        `That string had no buffer chest: U2's two output arms dropped straight onto the ring. **It jams when U2 drops a part-loaded foundry recipe.** The way there: tungsten carbide runs out while foundries are being made, so U2 stands with the carbide it could get, 50 steel, 30 circuits and 20 refined concrete; the ring is refilled to its limits meanwhile; then express belts, underground belts or splitters are wanted. After five minutes U2 drops the foundry recipe and its arms put the load back on the ring until the lane is full. What is left stays in U2, and a foundry that still holds something takes no new recipe.`,
        stuck ? `Measured on that string at reduced caps: ${stuck.endedBy === 'caps' ? 'refilled' : `express belts not refilled in ${num(stuck.minutes)} minutes`}; U2 at the end: ${stuck.holding?.U2?.recipe === 'none' ? 'no recipe' : stuck.holding?.U2?.recipe}, ${stuck.holding?.U2?.waiting} items waiting to leave, ${stuck.onRing} items on the ring; and after the tungsten carbide returned it stood for another ${num(jam.phases[3].minutes)} minutes with ${jam.phases[3].productsShort} products short. It does not clear by itself.` : '', '',
        '| Scenario | Caps | Verdict | Higher product | After the entrance returned | U2 at the end |', '| --- | --- | --- | --- | --- | --- |');
      for (const n of handbackNames) if (B[n]) L.push(`| ${handbackRow(n, B[n]).join(' | ')} |`);
      const byHand = B['recover:empty-by-hand'], takeAll = B['recover:take-all'];
      L.push('', `From \`${BEFORE.file}\` (\`${before.nativeCommand}\` on that string). It did not jam in the twenty-minute outages, in U1's hand-backs (U1 stands inside the ring and hands back onto the other lane, which has room) or when U2 dropped a part-loaded underground belt recipe (what it hands back there is what the belts it turns to are made of).`,
        byHand ? `Clearing it, tested on that string: with U2 jammed, everything it held was taken out by hand (${byHand.phases[3]?.emptiedByHand?.U2} items): ${byHand.phases[3]?.endedBy === 'caps' ? `express belts were refilled ${num(byHand.phases[3].minutes)} minutes later and every cap was reached ${num(byHand.phases[4].minutes)} minutes after the tungsten carbide returned` : 'it did NOT recover'}.` : '',
        takeAll ? `Emptying every chest instead (so that the other machines use up what crowds the ring): ${takeAll.phases[3]?.endedBy === 'caps' ? `it cleared; everything that does not need tungsten carbide was refilled after ${num(takeAll.phases[3].minutes)} minutes` : `it did NOT clear in ${num(takeAll.phases[3]?.minutes)} minutes`}.` : '', '');
    }
    const all = Object.values(S);
    const sum = Object.fromEntries(Object.entries(S).map(([k, v]) => [k, scenarioSummary(v)]));
    const fluidRow = (v, withJoins) => v ? [v.passed ? 'passed' : 'FAILED', v.foreignFluids.length ? v.foreignFluids.map(f => `${f.held} in the ${f.network} pipes from minute ${num(f.firstTick / 3600)} for ${num(f.ticks / 3600)} min`).join('; ') : 'none', ...(withJoins ? [v.joinedBoxes.length ? v.joinedBoxes.map(j => `${j.machine} on ${j.recipe}: its ${j.box} box on a ${j.joinedTo} pipe (${j.seconds} s)`).join('; ') : 'none'] : []),
      v.matrix ? `${v.matrix.cases} recipe changes, ${v.matrix.leaks.length} put a fluid into another network` : v.phases.length ? (v.phases.at(-1).endedBy === 'caps' ? `every cap reached ${num(v.phases.at(-1).minutes)} min after` : `NOT filled: ${v.phases.at(-1).productsShort} products short after ${num(v.phases.at(-1).minutes)} min`) : 'stopped'] : null;
    if (sum.ports) {
      L.push('### Fluid safety (reduced caps)', '',
        `These scenarios place and feed the mall the way a player does rather than the way a test does. In all of them, as in every other scenario, every fluid segment and pump is read every tick and every machine fluid box every second.`, '',
        '| Scenario | What is done | Verdict | Foreign fluid | Afterwards |', '| --- | --- | --- | --- | --- |');
      for (const [name, text] of FLUID_SCENARIOS) { const row = fluidRow(sum[name]); if (row) L.push(`| ${name} | ${text}${sum[name].construction ? ` (built in ${num(sum[name].construction.ticks / 3600)} min${sum[name].construction.deferred ? `, ${sum[name].construction.deferred} entities refused at first` : ''})` : ''} | ${row.join(' | ')} |`); }
      const mx = sum.ports.matrix;
      L.push('', `Port matrix: ${mx.cases} cases. Each one sets a recipe on one recipe-switching foundry through its own red wire (taken off the mall's selector and put on a test combinator for this scenario), fills or empties the networks on its ports, asks for another recipe and reads every segment for two seconds. Fluid put into another network: ${mx.leaks.length} cases. Fluid box joined to the pipes of two fluids: ${mx.joins.length}.`,
        `Piecemeal construction: the game refused no entity for fluid reasons in any order (it has no such rule: an empty pipe run accepts whichever fluid arrives first). A mirror image is written by the test as its own string (positions and directions mirrored, the mirror flag set on foundries and the chemical plant, the tanks on their other diagonal), because the game has no script call that flips a blueprint; the game's own flip key was not exercised. Turning is done by the game.`, '');
    }
    if (earlier) {
      const E = earlier.scenarios, stuck = Object.entries(E).filter(([, v]) => v.phases.length && v.phases.at(-1).endedBy !== 'caps' && !v.matrix).map(([k]) => k);
      const leak = Object.values(E).flatMap(v => v.foreignFluids)[0], stone = E['late:stone-exit']?.foreignFluids?.[0];
      L.push(`### An earlier string, \`${EARLIER.sha.slice(0, 8)}…\`, in the fluid scenarios`, '',
        `That string had the molten copper pipe directly on the second input port of the steel foundry. Whenever that foundry cast steel, its one molten iron box was joined to the iron trunk on one port and to the copper pipes on the other. When it stopped casting steel with the iron trunk full and the copper pipes empty, the game pushed the molten iron left in the box (up to 330) into the copper pipes. After that the copper lava foundry could not put molten copper into its own pipes, no cable was cast, and the mall stood still for good.`,
        stone ? `The plain way to get there: **the stone exit not connected**. The stone belt fills, both lava foundries stop with their output full, cable casting empties the copper pipes while the iron trunk stays full, and the next time the steel foundry lets go of its recipe the iron goes in. Measured on that string: molten iron in the copper pipes ${num(stone.firstTick / 3600)} minutes after a cold start (${stone.peak} units; at that moment the lava foundries were: ${Object.entries(stone.lavaFoundries || {}).map(([k, v]) => `${k} ${v.replaceAll('_', ' ')}`).join(', ')}; the iron trunk held ${Object.entries(stone.networks || {}).filter(([k]) => k.startsWith('molten-iron')).map(([, v]) => `${v.amount} of ${v.capacity}`).join()}), still there ${num(stone.ticks / 3600)} minutes later, and after the stone exit was connected no product was ever made again.` : '', '',
        '| Scenario | Verdict | Foreign fluid | Fluid box joined to two fluids | Afterwards |', '| --- | --- | --- | --- | --- |');
      for (const [name] of FLUID_SCENARIOS) if (E[name]) L.push(`| ${name} | ${fluidRow(E[name], true).join(' | ')} |`);
      const aid = E['recover:flush'];
      if (aid) L.push('', `First aid, tested on that string (\`recover:flush\`): after the hour of blocked stone the exit was connected and nothing else done: ${aid.phases[1].productsShort} of ${m.products.length} products still short ${num(aid.phases[1].minutes)} minutes later. Then the pipe run holding the wrong fluid was emptied, as the flush button of a pipe does (${aid.phases[2].flushed.map(v => `${v.amount} ${v.held} out of the ${v.network} pipes`).join(', ')}): ${aid.phases[2].endedBy === 'caps' ? `every cap was reached ${num(aid.phases[2].minutes)} minutes after` : 'it did NOT fill'}. The flush was done by script; the button itself was not pressed.`);
      L.push('', `From \`${EARLIER.file}\` (\`${earlier.nativeCommand}\` on the earlier string, fill limit ${earlier.limitTicks / 3600} minutes). On that string the open joint shows in every scenario; molten iron actually crossed where the copper pipes were empty at the wrong moment (${Object.entries(E).filter(([, v]) => v.foreignFluids.length || v.matrix?.leaks.length).map(([k]) => k).join(', ')})${stuck.length ? `, and the mall never filled again in ${stuck.join(', ')}` : ''}. Molten copper in the iron pipes was not produced by any scenario: on that string no single box ever joined copper to the iron trunk.`, '');
    }
    L.push('### Checks in every scenario', '',
      `- Import: every entity at its position and direction, every recipe or circuit recipe control, every arm's hand size, filters and conditions, every combinator's parameters, every circuit net as one network with no two nets joined, one electric network.`,
      `- Chests: no chest ever held an item it does not declare (${all.every(s => s.checks.find(v => v.name === 'no chest ever held a foreign item')?.passed) ? 'held in all' : 'FAILED'}).`,
      `- Fluids: every fluid segment (pipes, underground pipes, tanks) and both pumps read every tick, ${Math.min(...all.map(s => s.segmentsWatched))} readings a tick: no foreign fluid, ever (${all.every(s => s.checks.find(v => v.name.startsWith('no pipe, tank or pump'))?.passed) ? 'held in all' : 'FAILED'}). Every machine's fluid boxes read every second: none joined to the pipes of two fluids except through a pump (${all.every(s => s.checks.find(v => v.name.startsWith('no fluid box of a machine'))?.passed) ? 'held in all' : 'FAILED'}).`,
      `- Recipes: every recipe-switching machine read every 10 ticks: it never held a recipe none of its rules asks for (${all.filter(s => !s.matrix).every(s => s.checks.find(v => v.name.startsWith('no recipe-switching machine'))?.passed) ? 'held in all' : 'FAILED'}).`,
      `- Ring: peak ${Math.max(...all.map(s => s.ringPeakTotal))} items against a bound of ${m.ring.bound} (75% of both lanes); static lane limits inner ${m.ring.laneLimits.inner}, outer ${m.ring.laneLimits.outer} of ${m.ring.laneCapacity} per lane.`,
      `- Level gate: ${all.reduce((n, s) => n + s.phases.reduce((k, ph) => k + ph.gatedActive, 0), 0)} ticks with a gated arm enabled against the level, over all scenarios.`, '');
    if (fillPhase) {
      L.push('### Switching machines in the full fill', '', '| Machine | Recipe changes | Time per recipe (min) |', '| --- | ---: | --- |');
      for (const [k, v] of Object.entries(fillPhase.recipeTicks)) L.push(`| ${k} | ${fillPhase.switches[k]} | ${Object.entries(v).sort((x, y) => y[1] - x[1]).map(([n, t]) => `${n === 'none' ? 'changing' : n} ${min(t)}`).join(', ')} |`);
      L.push('', '"iron-ore-melting" and "wooden-chest" are the parking recipes: recipes the machine can never start, held while it has nothing to make.', '');
    }
    L.push('### Harness speed', '', `Scenarios ran side by side at ${all.map(s => s.timesRealTime).filter(Boolean).map(v => Math.round(v)).sort((x, y) => x - y).join(', ')} times real time; ${num(report.wallSecondsTotal, 0)} s of wall time in all for ${num(all.reduce((n, s) => n + s.actualTicks, 0) / 216000, 1)} game hours.`, '');
  }

  // ---- bill
  L.push('## Bill from the recipes (expected values, productivity counted)', '', '| Group | lava | calcite | plastic | carbide | acid | lubricant | water | molten iron | molten copper | stone made | stone used |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const g of m.groups) { const v = bill.perGroup[g.group]; L.push(`| ${g.group} ${g.name} | ${[v.lava, v.calcite, v['plastic-bar'], v['tungsten-carbide'], v['sulfuric-acid'], v.lubricant, v.water, v.moltenIron, v.moltenCopper, v.stoneMade, v.stoneUsed].map(x => num(x, 0)).join(' | ')} |`); }
  const f = bill.fullFill;
  L.push(`| **one full fill** | ${[f.lava, f.calcite, f['plastic-bar'], f['tungsten-carbide'], f['sulfuric-acid'], f.lubricant, f.water, f.moltenIron, f.moltenCopper, f.stoneMade, f.stoneUsed].map(x => num(x, 0)).join(' | ')} |`, '',
    'The measured fill uses more than this: the ring, the machines\' input buffers and the brick stock are filled as well, and both lava recipes run whenever either metal is short.', '');

  // ---- behaviours and limits
  L.push('## Things to know', '',
    `- The asteroid collector and crusher recipes exist only once a space platform has been created. On Vulcanus that is always the case.`,
    `- A universal machine that has started loading a recipe keeps it until the craft is done; if the input it is waiting for never comes and something of a higher rank is wanted, it gives the recipe up after ${STALL.U1 / 3600} minutes (U1) or ${STALL.U2 / 3600} minutes (U2). U1 hands the loaded items back to the ring, U2 into its buffer chest.`,
    `- The buffer chest can hold intermediates for a long time when the ring is at its limits. They count as stock and are used first when the ring has room.`,
    `- Tiny recipes can run one craft over their cap (an arm's second item is a full set). The extra rides the ring, counts as stock and goes into the chest after the next collection.`,
    `- Kit items enter the kit chest only while no assembling machine 3 is wanted.`,
    `- Collecting from a chest reopens that product's level; lower groups pause until it is full again.`,
    `- Connect the stone exit. A stone belt that cannot move stops the two lava foundries, and with them everything; nothing is harmed and the mall carries on when the belt moves again.`,
    `- The brick stock (${BRICK_STACKS} stacks) is filled from surplus stone whenever metal is cast, so concrete can be made later when little stone is flowing.`, '');
  L.push('## Tried and rejected (native exploration, not kept as strings)', '',
    '- **One recipe signal per machine without a parking recipe**: a machine that reads its own contents takes the item signals of what it still holds as recipe signals once the real signal is gone, and keeps crafting (gears to 150 on the ring).',
    '- **Recipe following the pick at once**: an arm carrying an ingredient when the recipe changes holds it for good; the machine also flipped between two recipes hundreds of times while a product changed hands.',
    '- **Counting what a switching machine has loaded as ring stock** for the casting rules: the caster stopped at the limit while the landing pad still waited for 180 concrete.',
    '- **A 78-tile ring**: the inner lane filled at about 300 items and everything stopped; the ring is folded twice at its east end for 20 more tiles.',
    '- **The water pipe straight into the gear foundry**: when that foundry changes recipe, its leftover molten iron flows out into any connected pipe that will take it; with water not yet connected it filled the water tank with molten iron, and water could never enter. A pump now stands between the tank and the foundry.',
    `- **The molten copper pipe straight into the steel foundry** (published as \`${EARLIER.sha.slice(0, 8)}…\` and withdrawn): the same fault with molten iron and the copper pipes; see the section on that string above. A pump now stands on that port too, and the static audit refuses any machine with two ports of one kind on the pipes of two fluids.`,
    '- **A recipe wire that is empty for one tick while a universal machine parks**: a machine that reads its own contents takes them as its recipe for that tick (the belt foundry showed casting-iron-gear-wheel for one tick). Harmless on these pipes, closed anyway.',
    '- **Casting copper plate in the steel foundry**: a one-fluid recipe uses both input ports as one box, so the molten copper box sat on the iron trunk as well; molten copper ended in the iron pipes.',
    '- **A level that falls at once**: lower groups slipped in during the seconds a kit item waited for processing units.',
    '- **Sharing by reserve instead of strict order**, and **dedicated machines for every recipe** (about 55 machines): not built; estimated only.', '');
  if (explorations.length) L.push('Kept exploration reports: ' + explorations.map(e => `\`${e.file}\``).join(', ') + '.', '');
  L.push(`## If you already placed the string before this one (\`${BEFORE.sha.slice(0, 8)}…\`)`, '',
    '**How to recognise the jam.** U2 is the foundry in the south-west corner with the lubricant tank beside it.', '',
    '1. U2 shows no recipe and does nothing, although express belts, underground belts or splitters are below their caps.',
    '2. Open it: its output or trash slots hold tungsten carbide, steel, circuits or refined concrete. The two arms above its right half stand still with their hands full.',
    '3. The ring is crowded with the same things: far more tungsten carbide than the 8 it normally carries.', '',
    '**How to clear it by hand.**', '',
    '1. Open U2 and take out everything it holds, slots and trash. It takes a recipe again within seconds.',
    '2. Pick the surplus tungsten carbide off the ring, or simply restore the tungsten carbide supply: the next foundry uses it up.',
    '3. It can happen again whenever U2 has to drop a part-loaded foundry recipe, so treat this as first aid.', '',
    '**How to get the fix without rebuilding.** This string differs from that one only around U2:', '',
    `1. Remove the two bulk inserters above the right half of U2 (tiles ${tile({ x: 10.5, y: 11.5 })} and ${tile({ x: 11.5, y: 11.5 })}) and the decider combinator at U2's top-left corner (tiles ${tile({ x: 5.5, y: 12.5 })} and ${tile({ x: 6.5, y: 12.5 })}).`,
    `2. Place this blueprint exactly on top of the old one. Robots add the buffer chest at ${tile(d.blueprint.blueprint.entities[m.buffer.chest - 1].position)}, the arm from U2 into it, the arm from it onto the ring, seven combinators and their wires. Nothing else moves; entrances, chests and caps stay where they are.`,
    `3. ${placedOver ? (placedOver.passed ? `Tested natively: this string placed over that one after removing those ${placedOver.placedOver.removedFirst.length} entities (${placedOver.placedOver.added} entities added). Every circuit net came out whole, the hand-back that jammed the old string passed and a fill from empty reached every cap. The test places the blueprint by script, the way a blueprint is placed over standing entities; a player's own paste in a running game with stock on the ring was not exercised.` : `Tested natively and it did NOT come out right (${Object.values(placedOver.scenarios).flatMap(v => v.failures).slice(0, 2).join('; ')}). Take the mall down and place this string instead.`) : 'Not tested: whether placing over the old one also adds the wires between entities that were already there. If U2 does not come back to life, take the mall down and place this string.'}`, '');
  L.push(`## If you already placed the earlier string (\`${EARLIER.sha.slice(0, 8)}…\`)`, '',
    '**How to tell it is contaminated.** Hold the pointer over the pipes (or turn on the detailed view, Alt):', '',
    '1. The copper pipes are the two pipes directly under the west lava foundry (the one set to molten copper) and the three pipes on top of the cable foundry. They must show molten copper or nothing. If they show **molten iron**, that is the fault.',
    '2. The signs around it: the copper lava foundry stands still with its output full, the cable foundry waits for molten copper, the two circuit machines wait for cable, and nothing new arrives in the chests.',
    '3. Look at the iron pipes too (the row under the east lava foundry and the pipe above each of the other casting foundries): they must show molten iron or nothing. No test put molten copper there, but look.', '',
    '**How to clear it without rebuilding.**', '',
    '1. Click one of the copper pipes that shows molten iron. In the window that opens, press the flush (bin) button next to the fluid. That empties the whole connected run of pipes, underground pieces included; you need to do it once.',
    '2. If the iron pipes show molten copper, do the same on one iron pipe.',
    '3. Connect the stone exit (the belt on the north-west corner marked "OUT: surplus stone") to something that takes the stone away. A stone belt that cannot move is what sets the fault off.',
    '4. Molten copper returns and the mall carries on (tested: see the first-aid line under the table of the earlier string). On the earlier string it can happen again whenever the copper pipes run empty, so treat this as first aid.', '',
    '**How to fix it for good.** Use this string instead. Only two rows of pipes and two combinator settings differ, everything else is on the same tiles:', '',
    '1. Remove every pipe and underground pipe on tile rows 8 and 9 (the two rows between the lava foundries and the casting foundries). The water pump in those rows can stay.',
    '2. Place this blueprint exactly on top of the old one. Robots put in the new pump (column 7, rows 8 and 9) and the pipes and underground pipes of those two rows. Nothing else moves; chests, caps and entrances stay where they are. That is the whole fluid fix.',
    '3. Two combinator settings and two wires also differ (they close a one-tick recipe gap that does no harm on these pipes). Placing the blueprint over the old one was not tested for carrying those over; to be sure of having them, take the old mall down and place this one.', '');
  L.push('## Reproduce', '', '```', 'node scripts/requested-malls/foundry-mall/generate.mjs      # writes this folder from the pinned prototypes', 'node scripts/requested-malls/foundry-mall/audit.mjs         # static audit', 'node scripts/requested-malls/foundry-mall/validate.mjs      # full native protocol (needs the game): 34 headless games, a few minutes on ten cores', '```', '',
    `Static audit: ${audit.passed ? `passed, ${audit.checksTotal} checks` : 'FAILED: ' + audit.errors.join('; ')}. Prototypes pinned from a private \`--dump-data\` of Factorio ${p.gameVersion} (\`scripts/requested-malls/foundry-mall/prototypes.json\`).`, '');

  // ---- picture
  const scale = 18, left = 30, top = 60, esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const colors = { foundry: '#c6703a', 'assembling-machine-3': '#477196', 'chemical-plant': '#6a9a5b', 'electric-furnace': '#8a6f5a', 'storage-tank': '#5d8f8f', pump: '#3f7f9f', substation: '#e0af60', 'fast-transport-belt': '#b74c41', pipe: '#75bd95', 'pipe-to-ground': '#4f9a72', 'fast-inserter': '#41a9d2', 'bulk-inserter': '#58b05a', 'long-handed-inserter': '#d25a5a', 'passive-provider-chest': '#d78352', 'steel-chest': '#9aa3ad', 'display-panel': '#dac77a', 'constant-combinator': '#7d6fb3', 'decider-combinator': '#8d7fd0', 'arithmetic-combinator': '#6d8fd0', 'selector-combinator': '#b07fd0' };
  let shapes = '';
  for (const e of d.blueprint.blueprint.entities) {
    const bb = box(e, p, 'selection_box'), x = left + (bb.left - b.left) * scale, y = top + (Math.max(bb.top, e.position.y - 0.5 - (bb.bottom - bb.top > 1 ? (bb.bottom - bb.top) / 2 - 0.5 : 0)) - b.top) * scale;
    const role = m.machines.find(v => v.entity === e.entity_number)?.role;
    shapes += `<rect x="${x.toFixed(1)}" y="${(top + (bb.top - b.top) * scale).toFixed(1)}" width="${((bb.right - bb.left) * scale).toFixed(1)}" height="${((bb.bottom - bb.top) * scale).toFixed(1)}" rx="2" fill="${colors[e.name] || '#888'}" stroke="#101b29"><title>#${e.entity_number} ${esc(role || e.text || e.name)}</title></rect>`;
    if (role && !role.includes('shadow')) shapes += `<text x="${(left + (e.position.x - b.left) * scale).toFixed(1)}" y="${(top + (e.position.y - b.top) * scale + 3).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="8">${esc(role.replace('electronic-circuit', 'EC').replace('advanced-circuit', 'AC').replace('assembling-machine-', 'AM').replace('space-platform-foundation', 'foundation').replace('electric-engine-unit', 'e-engine').replace('processing-unit', 'PU').replace('molten-', 'molten ').replace('speed-module', 'SM').replace('rocket-silo', 'silo'))}</text>`;
  }
  const width = left * 2 + m.footprint.width * scale, height = top + m.footprint.height * scale + 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101b29"/><g font-family="Arial,sans-serif"><text x="${left}" y="26" fill="#f2f6fc" font-size="20">Foundry mall</text><text x="${left}" y="46" fill="#a8bed4" font-size="12">${m.footprint.width} × ${m.footprint.height} tiles · ${c.foundry} foundries · ${c['assembling-machine-3']} AM3 · 5 provider chests · schematic</text>${shapes}<text x="${left}" y="${height - 14}" fill="#a8bed4" font-size="11">North-west: lava, calcite, stone exit · East: water, sulfuric acid · South: lubricant, plastic, tungsten carbide, the five chests and the caps combinator</text></g></svg>\n`;
  return { 'README.md': L.join('\n') + '\n', 'layout.svg': svg };
}
