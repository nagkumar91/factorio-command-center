// README and layout picture of the foundry belts and fuel mall, written by generate.mjs from the manifest, the static
// audit and (only when it is for exactly this string) the native report. Nothing here is typed in by hand as a result.
import { box, scenarioSummary, FUEL, readJson, PROJECT } from './lib.mjs';
import { asciiMap, LEVEL_HOLD, STALL, TANK_READY, FINAL_ON_RING } from './design.mjs';
import path from 'node:path';

const min = t => (t === undefined || t === null ? 'never' : (t / 3600).toFixed(1));
const num = (v, d = 1) => (v === undefined || v === null ? '–' : (Math.round(v * 10 ** d) / 10 ** d).toString());
const short = n => n.replaceAll('-', ' ');
const BIG = 'blueprint-sources/requested-malls/foundry-mall', SUPPLY = 'blueprint-sources/vulcanus-supplies/rocket-fuel';
const FLUID_ROWS = [
  ['ports', 'Port matrix: every recipe change of the two recipe-switching foundries, with each network on their ports full or empty'],
  ['build:shuffle-1', 'Built one entity every 20 ticks in a shuffled order, supply and power already connected'], ['build:shuffle-2', 'Same, second shuffle'], ['build:shuffle-3', 'Same, third shuffle'],
  ['build:pipes-first', 'Built piecemeal, all pipes, tanks and pumps first'], ['build:machines-first', 'Built piecemeal, machines and substations first'], ['build:combinators-last', 'Built piecemeal, every combinator last'],
  ['build:copper-foundry-last', 'Built piecemeal; the molten copper foundry arrives ten minutes after everything else'], ['build:iron-foundry-last', 'Built piecemeal; the molten iron foundry arrives ten minutes after everything else'],
  ['build:robots-25', 'Built by 25 of the game\'s own construction robots from a ghost blueprint'], ['build:robots-200', 'Built by 200 construction robots from a ghost blueprint'],
  ['late:power', 'Everything connected, no power for five minutes'], ['late:stone-exit', 'Stone exit not connected for an hour (the stone belt fills), then connected'],
  ['thin:lava', 'Lava at 100 a second for an hour (the two lava foundries take 250), then in full'], ['thin:calcite', 'The mall part\'s calcite at 12 a minute for an hour (it takes up to 30), then in full'],
  ['starve:supply', 'After a fill: every chest emptied and lava cut for ten minutes; then the same with the mall part\'s calcite'], ['starve:foundry', 'After a fill: every chest emptied and the molten copper foundry stopped for fifteen minutes; then the same with the molten iron foundry'],
  ['place:rot90', 'Placed turned a quarter clockwise'], ['place:rot180', 'Placed turned a half'], ['place:rot270', 'Placed turned three quarters'], ['place:flipH', 'Placed mirrored left to right'], ['place:flipV', 'Placed mirrored top to bottom'],
];

export async function render(d, audit, proven, p, report) {
  const m = d.manifest, b = m.footprint.bounds, bill = m.bill, F = m.panelFigures, f = m.footprint;
  const tile = pos => `(${Math.floor(pos.x) - b.left}, ${Math.floor(pos.y) - b.top})`;
  const big = await readJson(path.join(PROJECT, BIG, 'manifest.json')).catch(() => null), supply = await readJson(path.join(PROJECT, SUPPLY, 'manifest.json')).catch(() => null);
  const bigReport = await readJson(path.join(PROJECT, BIG, 'native-report.json')).catch(() => null);
  const S = report?.scenarios, sum = S ? Object.fromEntries(Object.entries(S).map(([k, v]) => [k, scenarioSummary(v)])) : {};
  const L = [];
  const status = proven ? `**qualified** (full native protocol, \`native-report.json\`)` : report ? '**not qualified**: the native report for this string did not pass' : '**not qualified**: no native report for this string yet';
  L.push(`# Foundry belts and fuel mall · express belts, inserters, drills, foundries in list order · ${F[FUEL]} rocket fuel a minute`, '',
    `Status: ${status}. Blueprint SHA-256 \`${d.hash}\`. Factorio ${p.gameVersion} Space Age, Vulcanus, vanilla, normal quality, no modules, no beacons.`, '',
    `A smaller foundry mall. It is the [foundry mall](../foundry-mall/README.md) without the assembling machine 3 product and without the platform kit, re-packed, with the rocket fuel supply attached under it. Foundries turn lava and calcite into molten metal and cast plates, gears, steel, sticks, cable and concrete; everything on the list is kept at a cap in four passive provider chests and made **in the order of the list**. The rocket fuel section makes ${F[FUEL]} rocket fuel a minute from coal into a fifth chest; it shares no machine with the rest, so it neither waits for the list nor holds it up.`, '',
    `The big foundry mall is kept as it is; this is a second blueprint beside it.`, '');

  // ---- products
  L.push('## What it makes', '', '| Priority | Group | Product | Cap | Chest |', '| ---: | --- | --- | ---: | --- |');
  for (const g of m.groups) for (const key of g.products) L.push(`| ${g.group} | ${g.name} | ${key} | ${m.caps[key]} | ${m.stock.find(v => v.key === key).output} |`);
  L.push(`| – | rocket fuel (own section, not in the order) | ${FUEL} | ${m.caps[FUEL]} | ${m.stock.find(v => v.key === FUEL).output} |`, '',
    `Rocket fuel: the cap is ${m.fuel.stacks} stacks of ${p.items[FUEL].stack_size} (the stack size in the pinned prototypes), which is ${m.caps[FUEL] / (p.facts.rocket.rocketPartsRequired * p.facts.rocket.rocketFuelPerPart)} rockets' worth (${p.facts.rocket.rocketPartsRequired} rocket parts a rocket, ${p.facts.rocket.rocketFuelPerPart} rocket fuel a part). At ${F[FUEL]} a minute the chest fills from empty in about ${num(m.caps[FUEL] / F[FUEL], 0)} minutes.`, '');

  // ---- what was removed
  if (big) {
    const bc = big.footprint.counts, c = f.counts;
    L.push('## What is gone compared with the big foundry mall', '',
      `- **Products**: the assembling machine 3 stack and all ${big.groups[1].products.length} items of the platform kit, with the kit's share of fast inserters.`,
      `- **Machines**: the steel and low density structure foundry, the separate plate foundry (one foundry now casts plate, gear, stick, concrete and steel), three of the four advanced circuit machines, one of the two circuit machines, both speed module machines, the processing unit, engine, electric engine and foundation machines, the assembling machine 1 → 2 → 3 line, the rocket silo machine and the battery plant. Mall part now: ${c.foundry} foundries (were ${bc.foundry}), ${c['assembling-machine-3'] - 3} assembling machines 3 (were ${bc['assembling-machine-3']}), no chemical plant (was 1).`,
      `- **Control**: ${c['decider-combinator'] + c['arithmetic-combinator'] + c['selector-combinator']} combinators (were ${bc['decider-combinator'] + bc['arithmetic-combinator'] + bc['selector-combinator']}): no kit rules, no silo loader, no level-gated arms.`,
      `- **Belts and pipes**: the brick belt, the calcite belt and the molten copper manifold. Calcite and a little stone now ride the ring; the copper lava foundry sits against the cable foundry, the iron lava foundry against the casting foundry.`,
      `- **An input that is no longer needed by the mall part**: sulfuric acid (it was only for processing units and batteries). The acid entrance here feeds the rocket fuel section only.`,
      `- **A new input**: coal, for the rocket fuel section. Its calcite is a second calcite entrance, on the coal belt's other lane.`,
      `- **New in the mall part**: a dedicated refined concrete machine and a buffer chest behind the belt foundry (see "How it works").`, '');
  }

  // ---- size
  const c = f.counts;
  L.push('## Size', '', '| | Tiles | Rectangle | Entities |', '| --- | ---: | --- | ---: |',
    `| Mall part (rows 0 to ${f.mallPart.height - 1}) | **${f.mallPart.area}** | ${f.mallPart.width} × ${f.mallPart.height} | ${f.mallPart.entities} |`,
    `| Rocket fuel section (rows ${f.fuelPart.bounds.top - b.top} to ${f.height - 1}) | **${f.fuelPart.area}** | ${f.fuelPart.width} × ${f.fuelPart.height} | ${f.fuelPart.entities} |`,
    `| Together | **${f.area}** | ${f.width} × ${f.height} | ${f.entities} |`,
    ...(big ? [`| The big foundry mall | ${big.footprint.area} | ${big.footprint.width} × ${big.footprint.height} | ${big.footprint.entities} |`] : []),
    ...(supply ? [`| The stand-alone rocket fuel supply | ${supply.footprint.area} | ${supply.footprint.width} × ${supply.footprint.height} | ${supply.footprint.entities} |`] : []), '',
    big && supply ? `The mall part is ${num(100 * f.mallPart.area / big.footprint.area, 0)}% of the big foundry mall. Mall and fuel together are ${num(100 * f.area / (big.footprint.area + supply.footprint.area), 0)}% of the two blueprints placed separately, and smaller than the big foundry mall alone. The rectangle has no empty row or column: both parts are 34 wide and touch.` : '', '');

  // ---- ports
  const rate = S?.rate, fillPhase = S?.fill?.phases?.[0];
  const peak = key => { const windows = (rate?.phases || []).filter(ph => ph.perMinute); return windows.length ? Math.max(...windows.map(ph => (ph.accepted?.[key] ?? 0) / (ph.ticks / 3600))) : null; };
  L.push('## Entrances, exit, power', '', 'Tiles are counted from the blueprint\'s top-left tile (column, row). Every entrance has a panel with its figure.', '', '| Port | What | For | Kind | Tile | Edge | Panel figure (a minute) | Highest draw in a rate window, nothing held back (a minute) | Taken in the measured full fill |', '| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |');
  for (const port of m.ports) {
    const measured = fillPhase ? (port.exit ? fillPhase.stoneOut : fillPhase.accepted?.[port.key]) : null, hi = port.exit ? null : peak(port.key);
    L.push(`| ${port.id} | ${port.item}${port.exit ? ' (out)' : ''} | ${port.section === 'both' ? 'both parts' : port.section === 'fuel' ? 'rocket fuel' : 'mall part'} | ${port.kind === 'fluid' ? 'pipe' : 'belt'} | ${tile(port.position)} | ${port.side} | ${port.exit ? '–' : port.perMinute + (port.perMinuteBySection ? ` (${port.perMinuteBySection.fuel} fuel + ${port.perMinuteBySection.mall} mall)` : '')} | ${num(hi, 0)} | ${num(measured, 0)} |`);
  }
  L.push('', `- **Panel figures.** Rocket fuel: from the recipes at ${F[FUEL]} a minute (the same figures as the stand-alone supply; calcite rounded up). Mall part: lava and calcite are both lava foundries running flat out; plastic is the one advanced circuit machine flat out; tungsten carbide, lubricant and water are set above the highest draw the rate windows measured. In those windows every entrance was offered more than it could take; the rocket fuel section then makes a little over 12 a minute and takes a little over its figures, and the water column there is both parts together. "Taken in the measured full fill" counts what crossed the entrance, including what was still in pipes, belts and tanks at the end.`,
    `- **Calcite has two entrances**: a belt on the north edge for the mall part (it rides the ring to the two lava foundries) and a belt on the west edge for the fuel section (one lane of the coal belt). They are not connected inside.`,
    `- **Water has one entrance** for both parts, on the east edge: the fuel section's crackers and the casting foundry (concrete) and the refined concrete machine draw on it.`,
    `- **Sulfuric acid and coal** feed only the rocket fuel section. The mall part needs neither.`,
    `- **Power**: connect the substation at tile ${tile(d.blueprint.blueprint.entities[m.power.entry - 1].position)} (panel "${m.power.label}"). Five substations in one chain power everything.`,
    `- **Stone** is a by-product of every lava craft. The bricks for concrete are made inside; the rest leaves on the belt of OUT-STONE and must be taken away. If that belt cannot move, the two lava foundries stop and so does the mall part; nothing is harmed, and it carries on when the belt moves again (tested for an hour of blockage). The rocket fuel section is not affected.`,
    `- **Lubricant** passes a storage tank the control reads; it counts as present above ${TANK_READY}. The tank takes 25,000 when first connected.`, '');
  L.push('## Output chests and caps', '', '| Chest | Tile | Holds |', '| --- | --- | --- |');
  for (const o of m.outputs) L.push(`| ${o.id} | ${tile(o.position)} | ${o.items.join(', ')} |`);
  L.push('', `**Caps** live in one constant combinator at tile ${tile(m.capsCombinator.position)} (panel "CAPS"), one positive number per product, rocket fuel included. Edit a number and the stock follows. Nothing else holds a cap.`, '');

  // ---- how
  L.push('## How it works', '',
    `- **Casting band.** Two lava foundries lie on their sides: lava in on one side, molten metal out of the other, straight into the next foundry's ports. Molten copper goes to the cable foundry, molten iron to the one casting foundry, which casts plate, gear, stick, concrete or steel as the stock asks, each from half its limit up to the limit.`,
    `- **One ring** of ${m.ring.tiles} red belt tiles carries every intermediate and finished item. An arm that adds an item works only while the ring holds fewer than that item's limit. Calcite for the lava foundries and a little stone for the brick furnace ride it too.`,
    `- **Inside the ring**: the circuit machine, the advanced circuit machine, U1 (an assembling machine 3 that makes inserter, fast inserter, bulk inserter and drill, one recipe at a time), the refined concrete machine and the brick furnace.`,
    `- **U2**, a foundry with lubricant on its ports, makes the three belt tiers and the foundry, one recipe at a time.`,
    `- **The buffer chest.** Everything that leaves U2 goes into a steel chest first, and one arm puts it on the ring item by item while the ring holds fewer than that item's limit (finished products: ${FINAL_ON_RING}). Reason, measured: when U2 gives up a half-loaded foundry recipe it hands back some 150 ingredients at once; put straight on the ring they filled the lane, U2 could not be emptied, a foundry that cannot be emptied takes no new recipe, and the mall stood still. What lies in the chest still counts as stock for the rules.`,
    `- **Fluid ports.** A recipe with one fluid ingredient uses both input ports of a machine as one box, and a recipe change pushes what is left in a box out through any of its ports. So no machine here has two ports of one kind on the pipes of two fluids: the casting foundry gets its water through a pump standing directly on that port, and a pump lets nothing back.`,
    `- **List order.** Every rule shows a weight on one network; the highest weight in force sets the level (${m.groups.map(g => `${g.level} = ${g.name}`).join(', ')}). U1 and U2 are not given a recipe of a lower level while a higher level is in force. The level rises at once and falls only after ${LEVEL_HOLD / 60} s without a higher rule.`,
    `- **Skip and return.** A rule is true only while its product is short and one craft's worth of every scarce ingredient is in sight; the belt rules also need lubricant in the tank. A product whose outside input is missing drops out of the level by itself and comes back when the input does.`,
    `- **The rocket fuel section** is the stand-alone rocket fuel supply (\`${SUPPLY}\`) tile for tile: three refineries (simple coal liquefaction), two heavy oil crackers, three solid fuel plants handing straight to three assemblers. No rule and no level touches it. Its only link to the control is the cap: its chest and its four output arms read the caps combinator, so the arms stop when the chest holds its cap and the machines fill up behind them.`, '');
  if (supply) L.push('### The fuel section and the stand-alone rocket fuel blueprint', '',
    `Same machines, same pipes, same coal belt, same panel figures (coal ${F.coal}, calcite ${F['calcite-fuel']}, sulfuric acid ${F['sulfuric-acid']}, water ${F.waterFuel} a minute). Three differences: the rocket fuel ends in a passive provider chest in the south-east corner instead of leaving on a belt; the four output arms stop at the cap; the water comes from this blueprint's one water entrance instead of the supply's own inlet on its north edge. **If you place this blueprint you do not need the stand-alone rocket fuel supply.**`, '');
  L.push('### The priority rule, as built and as tested', '',
    `Built: **strict sequencing by group**. While a group has a product below its cap that can be made, U1 and U2 are given no recipe of a lower group. The circuit machines, the casting foundry and the refined concrete machine are shared and are not gated; they only refill ring stock up to its limits.`,
    `Tested natively: in the fill from empty at the published caps every product of a group was at its cap before any product of the next group was. Rocket fuel is outside the rule by design.`,
    `Limits, stated plainly: (1) U1 or U2 finishes the one craft it has started before it obeys a higher level; (2) inside a group the order is the rule order per machine.`, '');

  // ---- size and parts
  L.push('## Parts', '',
    `Machines: ${c.foundry} foundries, ${c['assembling-machine-3']} assembling machines 3 (two of them shadows that never craft, three in the fuel section), ${c['oil-refinery']} oil refineries, ${c['chemical-plant']} chemical plants, 1 electric furnace. Control: ${c['decider-combinator']} decider, ${c['arithmetic-combinator']} arithmetic, ${c['selector-combinator']} selector and ${c['constant-combinator']} constant combinators.`,
    `Bill of materials: ${Object.entries(c).map(([n, k]) => `${k} ${n}`).join(', ')}. Red belts and fast and bulk inserters only; hand sizes are pinned (fast 1, bulk 2), so it behaves the same whatever inserter capacity is researched.`, '',
    `Research needed (${m.technologyClosure.length} technologies in the closure), among them: foundry, calcite processing (simple coal liquefaction), advanced oil processing, rocket fuel, automation 3, logistics 3, bulk inserter, advanced combinators.`, '',
    '```', asciiMap(d, p), '```', '',
    'F foundry · R oil refinery · A assembling machine 3 · C chemical plant · K furnace · T tank · p pump · S substation · P provider chest · > < ^ v belt · = pipe · u underground pipe · i fast · b bulk inserter · d a s c combinators · ! panel · B buffer chest', '');

  // ---- measured
  if (S) {
    const capsOf = n => S[n] ? `${S[n].capsName} caps` : '';
    L.push('## Measured natively', '', `Every figure below is from \`native-report.json\` (${Object.keys(S).length} scenarios, each its own headless game on a Vulcanus surface from a fresh import of this string). **Full caps**: the fills from empty, the rate scenario and the rocket fuel scenarios. **Reduced caps** (a tenth of each cap, at least 2): refill, outage and recovery, hold, cap edits, single refills, the withheld-input scenarios and every fluid-safety scenario. A reduced-cap time is not a full-stack time.`, '');
    const mall = m.products.filter(v => !v.independent);
    const mallDone = ph => Math.max(...mall.map(v => ph.reached[v.key] ?? Infinity));
    if (fillPhase) {
      L.push(`### Fill from empty at the published caps: ${min(fillPhase.ticks)} minutes`, '', '| Product | Group | Cap | At its cap after (min) |', '| --- | ---: | ---: | ---: |');
      for (const v of [...m.products].sort((x, y) => (fillPhase.reached[x.key] ?? 1e12) - (fillPhase.reached[y.key] ?? 1e12))) L.push(`| ${v.key} | ${v.independent ? '–' : v.group} | ${v.cap} | ${min(fillPhase.reached[v.key])} |`);
      const lv = fillPhase.levelTicks;
      L.push('', `Minutes each level was in force: ${m.groups.map(g => `${g.name} ${min(lv[String(g.level)] || 0)}`).join(', ')}.`,
        `Taken at the entrances: ${m.ports.filter(v => !v.exit).map(v => `${v.key} ${num(fillPhase.accepted[v.key], 0)}`).join(', ')}; stone left by the exit ${num(fillPhase.stoneOut, 0)}.`, '');
    }
    const noFuel = S['fill:no-fuel']?.phases[0], filling = S['fuel:filling'];
    if (fillPhase && noFuel) {
      L.push('### The mall part\'s fill time with and without the fuel section', '', '| Condition | Mall part full after (min) |', '| --- | ---: |',
        `| Fuel section fills its own chest at the start, then stops (the fill above) | ${min(mallDone(fillPhase))} |`,
        `| Fuel section never runs (coal withheld) | ${min(mallDone(noFuel))} |`,
        ...(filling ? [`| Rocket fuel taken out all the time for the first ${min(filling.phases[0].ticks + filling.phases[1].ticks)} minutes, entrances at panel figures | ${min(filling.phases.reduce((n, ph) => n + ph.ticks, 0))} |`] : []), '');
    }
    const fuelRows = [['fuel:idle', 2, 'Mall part full and idle'], ['fuel:filling', 1, 'Mall part filling from empty'], ['both:emptied', 2, 'Every mall chest emptied every second as well'], ['both:emptied', 5, 'Only foundries and rocket fuel emptied (both use the water entrance)']].filter(([n]) => S[n]);
    if (fuelRows.length) {
      L.push(`### Rocket fuel: ${F[FUEL]} a minute, thirty-minute windows, entrances at their panel figures`, '', '| Condition | Rocket fuel a minute | Coal | Calcite (fuel) | Sulfuric acid | Water | Mall products a minute in the same window |', '| --- | ---: | ---: | ---: | ---: | ---: | --- |');
      for (const [n, i, text] of fuelRows) { const ph = S[n].phases[i], mn = ph.ticks / 3600; L.push(`| ${text} | **${num(ph.perMinute.collected[FUEL], 2)}** | ${num(ph.accepted.coal / mn, 0)} | ${num(ph.accepted['calcite-fuel'] / mn, 0)} | ${num(ph.accepted['sulfuric-acid'] / mn, 0)} | ${num(ph.accepted.water / mn, 0)} | ${Object.entries(ph.perMinute.collected).filter(([k, v]) => v > 0 && k !== FUEL).map(([k, v]) => `${short(k)} ${num(v, 2)}`).join(', ') || 'none taken'} |`); }
      L.push('', `Each window follows a ${m.nativeProtocol.fuelWarmupTicks / 3600}-minute warm-up under the same supply (after a long stop the pipes are full and the first minutes run above 12) and must show rocket fuel between ${m.nativeProtocol.fuelTarget - m.nativeProtocol.fuelTolerance} and ${m.nativeProtocol.fuelTarget + m.nativeProtocol.fuelTolerance} a minute. Coal, the fuel's calcite and sulfuric acid are supplied at exactly their panel figures; water at ${F.waterFuel} a minute while the mall part is idle and at the whole panel figure (${F.waterFuel + F.waterMall}) while it also draws. The inputs columns are what crossed each entrance in the window.`,
        `When the chest is not emptied it stops at exactly its cap (${m.caps[FUEL]}) and the section stands still: in the one-hour hold no chest changed and no rocket fuel assembler crafted.`, '');
    }
    if (rate) {
      L.push('### Mall rates (full caps)', '', 'After a full fill, one group at a time has its products taken out of its chest every second (15 minutes warm-up, 30 measured) while the groups above it stay full. The first row empties every mall chest at once: with strict list order that only ever shows group 1. Entrances unrestricted.', '',
        `| Measured window | Products a minute | lava | calcite | plastic | carbide | lubricant | water |`, `| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |`);
      for (const ph of rate.phases.filter(v => v.perMinute)) { const mn = ph.ticks / 3600; L.push(`| ${ph.name.replace('rate: ', '')} | ${Object.entries(ph.perMinute.collected).filter(([, v]) => v > 0).map(([k, v]) => `${short(k)} ${num(v, 2)}`).join(', ') || 'none'} | ${['lava', 'calcite', 'plastic-bar', 'tungsten-carbide', 'lubricant', 'water'].map(k => num(ph.accepted[k] / mn, k === 'lava' || k === 'water' ? 0 : 1)).join(' | ')} |`); }
      L.push('', 'Inputs are what crossed each entrance per minute in the window. Water in these windows is the mall part alone (the fuel chest is full and its section stands still).', '');
    }
    if (S.single) {
      L.push(`### Refilling one collected product (${capsOf('single')})`, '', '| Product | Taken | Back at cap after (min) |', '| --- | ---: | ---: |');
      for (const ph of S.single.phases.filter(v => v.name.startsWith('single refill'))) { const key = ph.name.split(': ')[1]; L.push(`| ${key} | ${ph.collectedAtStart?.[key] ?? 0} | ${min(ph.ticks)} |`); }
      L.push('', 'In each of these no other chest changed.', '');
    }
    const table = (title, names) => { L.push(title, '', '| Scenario | Phase | Minutes | Ended by |', '| --- | --- | ---: | --- |'); for (const n of names) if (S[n]) for (const ph of S[n].phases) L.push(`| ${n} | ${ph.name} | ${min(ph.ticks)} | ${ph.endedBy === 'caps' ? 'every cap reached' : ph.endedBy === 'ticks' ? 'fixed length' : 'LIMIT'} |`); L.push(''); };
    table(`### Refill, outage, hold, cap edits (${capsOf('hold')}; the first fill of "fill" is at full caps)`, ['fill', 'hold', 'caps']);
    if (S.hold) { const h = S.hold.phases.find(v => v.name.startsWith('one-hour')); L.push(`Hold: for one hour at full stock no chest changed (the rocket fuel chest included) and the final machines crafted ${h.finalCrafts} times.`, ''); }
    L.push('### Skip and return, one entrance withheld from a cold start (reduced caps)', '', '| Withheld | Products that need it | Everything else at its cap after (min) | After it returned: all at cap after (min) |', '| --- | --- | ---: | ---: |');
    for (const input of m.nativeProtocol.withheldInputs) { const s = S['skip:' + input]; if (!s) continue; const [a, r] = s.phases; L.push(`| ${input} | ${report.dependents[input].map(short).join(', ')} | ${a.mode === 'ticks' ? `nothing can be made (${min(a.ticks)} min)` : min(a.ticks)} | ${min(r.ticks)} |`); }
    L.push('', `In the withheld phase everything that does not need the entrance must reach and hold its cap for two minutes while the products that need it stay short; then the entrance returns and every cap must be reached. Coal, sulfuric acid or the fuel's calcite withheld stops only rocket fuel; lava or the mall part's calcite withheld stops only the mall part.`, '');
    if (sum.ports) {
      const row = v => [v.passed ? 'passed' : 'FAILED', v.foreignFluids.length ? v.foreignFluids.map(x => `${x.held} in the ${x.network} pipes`).join('; ') : 'none', v.matrix ? `${v.matrix.cases} recipe changes, ${v.matrix.leaks.length} put a fluid into another network` : v.phases.at(-1).endedBy === 'caps' ? `every cap reached ${num(v.phases.at(-1).minutes)} min after` : `NOT filled: ${v.phases.at(-1).productsShort} products short`];
      L.push('### Fluid safety (reduced caps)', '', 'In these, as in every other scenario, every fluid segment and the pump are read every tick and every machine fluid box every second.', '', '| Scenario | What is done | Verdict | Foreign fluid | Afterwards |', '| --- | --- | --- | --- | --- |');
      for (const [name, text] of FLUID_ROWS) if (sum[name]) L.push(`| ${name} | ${text}${sum[name].construction ? ` (built in ${num(sum[name].construction.ticks / 3600)} min)` : ''} | ${row(sum[name]).join(' | ')} |`);
      L.push('', `A mirror image is written by the test as its own string (positions and directions mirrored, the mirror flag toggled on foundries, refineries and chemical plants), because the game has no script call that flips a blueprint; the game's own flip key was not exercised. Turning is done by the game.`, '');
    }
    const all = Object.values(S);
    L.push('### Checks in every scenario', '',
      `- Import: every entity at its position and direction, every recipe or circuit recipe control, every arm's hand size, filters and conditions, every combinator's parameters, every circuit net as one network with no two nets joined, one electric network.`,
      `- Chests: no chest ever held an item it does not declare (${all.every(s => s.checks.find(v => v.name === 'no chest ever held a foreign item')?.passed) ? 'held in all' : 'FAILED'}).`,
      `- Fluids: every fluid segment and the pump read every tick, ${Math.min(...all.map(s => s.segmentsWatched))} readings a tick: no foreign fluid, ever (${all.every(s => s.checks.find(v => v.name.startsWith('no pipe, tank or pump'))?.passed) ? 'held in all' : 'FAILED'}). Every machine's fluid boxes read every second: none joined to the pipes of two fluids except through a pump (${all.every(s => s.checks.find(v => v.name.startsWith('no fluid box of a machine'))?.passed) ? 'held in all' : 'FAILED'}).`,
      `- Recipes: every recipe-switching machine read every 10 ticks: it never held a recipe none of its rules asks for (${all.filter(s => !s.matrix).every(s => s.checks.find(v => v.name.startsWith('no recipe-switching machine'))?.passed) ? 'held in all' : 'FAILED'}).`,
      `- Ring: peak ${Math.max(...all.map(s => s.ringPeakTotal))} items against a bound of ${m.ring.bound} (75% of both lanes); static lane limits inner ${m.ring.laneLimits.inner}, outer ${m.ring.laneLimits.outer} of ${m.ring.laneCapacity} per lane.`, '');
    if (fillPhase) {
      L.push('### Switching machines in the full fill', '', '| Machine | Recipe changes | Time per recipe (min) |', '| --- | ---: | --- |');
      for (const [k, v] of Object.entries(fillPhase.recipeTicks)) L.push(`| ${k} | ${fillPhase.switches[k]} | ${Object.entries(v).sort((x, y) => y[1] - x[1]).map(([n, t]) => `${n === 'none' ? 'changing' : n} ${min(t)}`).join(', ')} |`);
      L.push('', '"iron-ore-melting" and "wooden-chest" are the parking recipes: recipes the machine can never start, held while it has nothing to make.', '');
    }
    if (bigReport && fillPhase) {
      const bf = bigReport.scenarios.fill.phases[0], bm = await readJson(path.join(PROJECT, BIG, 'manifest.json'));
      const span = (ph, man, keys) => { const t = keys.map(k => ph.reached[k]); return Math.max(...t); };
      L.push('### Against the big foundry mall, same products', '', `The big mall reaches these products after its assembling machine 3 stack and its kit; here they are the whole list. Its measured full fill: express belts at cap after ${min(span(bf, bm, ['express-transport-belt', 'express-underground-belt', 'express-splitter']))} min, foundries after ${min(bf.reached.foundry)} min, of which the first ${min(Math.max(...bm.groups[1].products.map(k => bf.reached[k])))} min are assembling machine 3 and the kit. Here: express belts after ${min(span(fillPhase, m, ['express-transport-belt', 'express-underground-belt', 'express-splitter']))} min, foundries after ${min(fillPhase.reached.foundry)} min.`, '');
    }
    L.push('### Harness speed', '', `Scenarios ran side by side at ${all.map(s => s.timesRealTime).filter(Boolean).map(v => Math.round(v)).sort((x, y) => x - y).join(', ')} times real time; ${num(report.wallSecondsTotal, 0)} s of wall time in all for ${num(all.reduce((n, s) => n + s.actualTicks, 0) / 216000, 1)} game hours.`, '');
  }

  // ---- bill
  const cols = ['lava', 'calcite', 'plastic-bar', 'tungsten-carbide', 'lubricant', 'water', 'sulfuric-acid', 'coal', 'calcite-fuel'];
  L.push('## Bill from the recipes (expected values, productivity counted)', '', `| Group | ${cols.join(' | ')} | molten iron | molten copper | stone made | stone used |`, `| --- | ${cols.map(() => '---:').join(' | ')} | ---: | ---: | ---: | ---: |`);
  const rowOf = v => [...cols.map(k => v[k]), v.moltenIron, v.moltenCopper, v.stoneMade, v.stoneUsed].map(x => num(x, 0)).join(' | ');
  for (const g of m.groups) L.push(`| ${g.group} ${g.name} | ${rowOf(bill.perGroup[g.group])} |`);
  L.push(`| rocket fuel, ${m.caps[FUEL]} | ${rowOf(bill.fuelStock)} |`, `| **one full fill** | ${rowOf(bill.fullFill)} |`, '',
    'The measured fill takes more than this: the ring, the machines\' input buffers, the pipes and the tank are filled as well, and both lava recipes run whenever either metal is short.', '');

  // ---- limits
  L.push('## Known limits', '',
    `- One foundry casts all five iron products. It keeps up with this list; it would not keep up with the big mall's kit.`,
    `- U1 or U2 that has started loading a recipe keeps it until the craft is done; if the input it is waiting for never comes, it gives the recipe up after ${STALL.U1 / 3600} minutes (U1) or ${STALL.U2 / 3600} minutes (U2). U1 hands the loaded items back to the ring, U2 into its buffer chest.`,
    `- The buffer chest can hold intermediates for a long time when the ring is at its limits. They count as stock and are used first when the ring has room.`,
    `- There is no water tank: nothing in the control waits for water. With water missing the casting foundry may sit on the concrete recipe while nothing else is asked of it; plate, gear and stick still come first, and only foundries (and rocket fuel) need water.`,
    `- Tiny recipes can run one craft over their cap; the extra rides the ring or lies in the buffer chest and goes into the chest after the next collection.`,
    `- Collecting from a chest reopens that product's level; lower groups pause until it is full again. Rocket fuel is never paused by this.`,
    `- The rocket fuel section's figures hold with all three refineries fed: coal ${F.coal}, calcite ${F['calcite-fuel']}, sulfuric acid ${F['sulfuric-acid']}, water ${F.waterFuel} a minute.`, '');
  L.push('## Reproduce', '', '```', 'node scripts/requested-malls/foundry-belts-fuel-mall/generate.mjs      # writes this folder from the pinned prototypes', 'node scripts/requested-malls/foundry-belts-fuel-mall/audit.mjs         # static audit', 'node scripts/requested-malls/foundry-belts-fuel-mall/validate.mjs      # full native protocol (needs the game)', '```', '',
    `Static audit: ${audit.passed ? `passed, ${audit.checksTotal} checks` : 'FAILED: ' + audit.errors.join('; ')}. Prototypes pinned from a private \`--dump-data\` of Factorio ${p.gameVersion}. The validator and the harness are the foundry mall's (\`scripts/requested-malls/foundry-mall/validate.mjs\`, \`control.lua\`), pointed at this folder; the fuel section's ports are checked against the rocket fuel supply's measured port tables.`, '');

  // ---- picture
  const scale = 18, left = 30, top = 60, esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const colors = { foundry: '#c6703a', 'oil-refinery': '#9a5b8a', 'assembling-machine-3': '#477196', 'chemical-plant': '#6a9a5b', 'electric-furnace': '#8a6f5a', 'storage-tank': '#5d8f8f', pump: '#3f7f9f', substation: '#e0af60', 'fast-transport-belt': '#b74c41', pipe: '#75bd95', 'pipe-to-ground': '#4f9a72', 'fast-inserter': '#41a9d2', 'bulk-inserter': '#58c38a', 'passive-provider-chest': '#d94f4f', 'steel-chest': '#9aa4ad', 'display-panel': '#f2f6fc', 'constant-combinator': '#c9b458', 'decider-combinator': '#b48ad6', 'arithmetic-combinator': '#8fa0e0', 'selector-combinator': '#e08fc0' };
  let shapes = '';
  for (const e of d.blueprint.blueprint.entities) {
    const bb = box(e, p, 'selection_box'), x = left + (bb.left - b.left) * scale;
    const role = m.machines.find(v => v.entity === e.entity_number)?.role;
    shapes += `<rect x="${x.toFixed(1)}" y="${(top + (bb.top - b.top) * scale).toFixed(1)}" width="${((bb.right - bb.left) * scale).toFixed(1)}" height="${((bb.bottom - bb.top) * scale).toFixed(1)}" rx="2" fill="${colors[e.name] || '#888'}" stroke="#101b29"><title>#${e.entity_number} ${esc(role || e.text || e.name)}</title></rect>`;
    if (role && !role.includes('shadow')) shapes += `<text x="${(left + (e.position.x - b.left) * scale).toFixed(1)}" y="${(top + (e.position.y - b.top) * scale + 3).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="8">${esc(role.replace('electronic-circuit', 'EC').replace('advanced-circuit', 'AC').replace('refined-concrete', 'RC').replace('liquefaction', 'liq').replace('heavy-cracking', 'crack').replace('solid-fuel', 'solid').replace('rocket-fuel', 'fuel').replace('molten-', 'lava→').replace('stone-brick', 'brick'))}</text>`;
  }
  const width = left * 2 + f.width * scale, height = top + f.height * scale + 40, split = top + (m.fuel.row - b.top) * scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101b29"/><g font-family="Arial,sans-serif"><text x="${left}" y="26" fill="#f2f6fc" font-size="20">Foundry belts and fuel mall</text><text x="${left}" y="46" fill="#a8bed4" font-size="12">${f.width} × ${f.height} = ${f.area} tiles · mall part ${f.mallPart.width} × ${f.mallPart.height} above the line, rocket fuel section ${f.fuelPart.width} × ${f.fuelPart.height} below · ${d.hash.slice(0, 16)}…</text>${shapes}<line x1="${left}" y1="${split}" x2="${left + f.width * scale}" y2="${split}" stroke="#f2f6fc" stroke-dasharray="6 4"/></g></svg>\n`;
  return { 'README.md': L.join('\n') + '\n', 'layout.svg': svg };
}
