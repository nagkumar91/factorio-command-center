// README of the express belt mall, written from the design, the static audit and the native report.
// Every number comes from those objects; the native result and every measured figure are stated only from a
// report for exactly this string. Nothing here is arithmetic presented as a measurement.
import { PRODUCTS } from './design.mjs';

const at = q => `(${q.x}, ${q.y})`;
const fmt = (n, digits = 1) => Number(n).toFixed(digits);
const mins = ticks => ticks === undefined ? 'not reached' : (ticks / 3600).toFixed(1) + ' min';
const MATERIALS = ['iron-plate', 'copper-plate', 'plastic-bar', 'lubricant'];

// What one unit of a product costs, walked down the recipes of the pinned prototypes.
export function cost(p, product) {
  const need = {};
  const walk = (name, amount) => {
    need[name] = (need[name] || 0) + amount;
    const r = p.recipes[name];
    if (!r) return;
    const made = r.results.find(v => v.name === name).amount;
    for (const i of r.ingredients) walk(i.name, amount * i.amount / made);
  };
  walk(product, 1);
  return need;
}

// explored: [{ name, sha, report }] exploration reports kept beside the blueprint, each for the string it was run on.
export function readme(d, audit, report, p, anyReport, explored = []) {
  const m = d.manifest, f = d.footprint, c = f.counts, es = d.blueprint.blueprint.entities, byId = id => es[id - 1];
  const lane = audit.checks.find(k => k.name.startsWith('Ring stock caps'))?.detail;
  const timing = report ? Object.fromEntries(report.stockTiming.map(t => [t.phase, t])) : null;
  const native = report ? '**passed** the full protocol for this exact string' : anyReport ? `**failed** for this string: ${JSON.stringify(anyReport.failures)}` : '**not run** for this string';
  const meas = report?.measured;
  const speed = p.entities['assembling-machine-2'].crafting_speed;
  const gearsPerMinute = 60 * speed / 0.5, acPerMinute = 60 / (6 / speed);
  const ringTiles = m.ringLimits.tiles, ironPieces = m.ironBelt.length;
  const out = [];
  out.push(`# Express belt mall

**Factorio ${p.gameVersion} Space Age.** ${c['assembling-machine-2']} assembling machines 2, fast inserters, red belts, no modules or beacons. Iron, copper and plastic arrive on three belts and lubricant in one pipe; the mall makes **express transport belts, express underground belts and express splitters**, each product into **its own passive provider chest limited to one stack** (100, 50 and 50). Gears, copper cable, green and red circuits and the whole yellow and red belt tier are made inside and are not exported.

- **Size:** ${f.width} × ${f.height} = ${f.area} tiles (selection envelope of every entity; external supply excluded).
- **Entities:** ${f.entities}: ${c['assembling-machine-2']} machines, ${c['fast-transport-belt']} red belts and ${c['fast-underground-belt']} red underground pieces, ${c['fast-inserter']} fast inserters, ${c.pipe} pipes, ${c['medium-electric-pole']} medium poles, ${c['passive-provider-chest']} provider chests, ${c['display-panel']} labels.
- **Static audit:** ${audit.checksPassed} of ${audit.checksTotal} checks pass ([static-audit.json](static-audit.json)).
- **Native test:** ${native}${anyReport ? ' ([native-report.json](native-report.json))' : ''}.
${meas ? `- **Measured rates** (all three chests emptied every second, ${meas.windowMinutes} minutes counted after a 15 minute warm-up): ${PRODUCTS.map(n => `${fmt(meas.outputsPerMinute[n], 2)} ${n.replaceAll('-', ' ')}s a minute`).join(', ')}.\n- **Measured draw** (what the machines consumed in the same window): ${MATERIALS.map(n => `${fmt(meas.inputsPerMinute[n], 0)} ${n.replaceAll('-', ' ')} a minute`).join(', ')}.` : '- No rate is claimed until a native report passes for this string.'}

Import [blueprint.txt](blueprint.txt). See also the [layout schematic](layout.svg), the [manifest](manifest.json), the [ports](ports.json) and the [footprint](footprint.json).

Blueprint SHA-256, over the string with surrounding whitespace removed:

\`\`\`text
${d.hash}
\`\`\`
`);
  const need = Object.fromEntries([...PRODUCTS, 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'transport-belt', 'underground-belt', 'splitter'].map(n => [n, cost(p, n)]));
  out.push(`## Layout

Tile map from the entities (north up; x from ${f.bounds.left}, y from ${f.bounds.top}). Machines: E green circuit, C copper cable, A red circuit, t yellow belt, u yellow underground, s yellow splitter, f fast splitter (north band, y -4 to -2); U fast underground, G gear (three), X express underground, S express splitter, T express belt, F fast belt (south band, y 3 to 5). Arrows are belts, n s e w are arms by the side they drop on, = pipe, [ ] underground belt, + pole, " label, # provider chest.

\`\`\`text
${asciiMap(d)}
\`\`\`

Rows: machines, arms (y -1), the two ring rows (y 0 and 1), arms (y 2), machines, iron arms and the lubricant pipe (y 6), the iron belt with its underground hop and the inlet pipe (y 7). West entrances: copper y 0, plastic y 1, iron y 3.
`);
  out.push(`## Products and recipes

| Product | Ingredients per craft | Result per craft | Recipe seconds |
| --- | --- | --- | --- |
${[...PRODUCTS, 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'transport-belt', 'underground-belt', 'splitter', 'advanced-circuit', 'electronic-circuit', 'copper-cable', 'iron-gear-wheel'].map(n => { const r = p.recipes[n]; return `| \`${n}\` | ${r.ingredients.map(v => `${v.amount} ${v.name}`).join(' + ')} | ${r.results[0].amount} | ${r.energy_required ?? 0.5} |`; }).join('\n')}

Assembling machine 2 crafting speed is ${speed}. Every recipe above has its own machine; the gear recipe has three. There is no steel, stack or higher-tier recipe. **Plastic bars are not smelted** (they come out of a chemical plant), but the express splitter's advanced circuits need them, so plastic is the third solid input. **Lubricant is a fluid** and cannot be avoided for the express tier, so it enters by one pipe.

## The arithmetic: gears decide

What one of each express product costs, walked down the recipes of the pinned prototypes (the belt workshop's table, extended to the express tier):

| One of | Gears | Plates direct (not through a gear) | Green circuits | Red circuits | Lubricant | Raw plates in all |
| --- | --- | --- | --- | --- | --- | --- |
${PRODUCTS.map(n => { const r = need[n]; return `| \`${n}\` | ${fmt(r['iron-gear-wheel'], 2)} | ${fmt(sumDirect(p, n), 2)} | ${fmt(r['electronic-circuit'] || 0, 1)} | ${fmt(r['advanced-circuit'] || 0, 1)} | ${r.lubricant} | ${fmt(r['iron-plate'], 1)} iron${r['copper-plate'] ? `, ${fmt(r['copper-plate'], 1)} copper` : ''}${r['plastic-bar'] ? `, ${fmt(r['plastic-bar'], 0)} plastic` : ''} |`; }).join('\n')}

An assembling machine 2 makes ${fmt(gearsPerMinute, 0)} gears a minute, so one express belt costs ${fmt(need[PRODUCTS[0]]['iron-gear-wheel'], 1)} gears, one express underground ${fmt(need[PRODUCTS[1]]['iron-gear-wheel'], 2)} gears and one express splitter ${fmt(need[PRODUCTS[2]]['iron-gear-wheel'], 0)} gears and ${fmt(need[PRODUCTS[2]]['advanced-circuit'], 0)} advanced circuits. The three gear machines make ${fmt(3 * gearsPerMinute, 0)} gears a minute together, which decides the express belt and underground rates. One advanced circuit machine makes ${fmt(acPerMinute, 1)} advanced circuits a minute, which caps the express splitter at ${fmt(acPerMinute / 10, 2)} a minute however many gears there are.
`);
  out.push(`## Inputs

Use normal-quality items. Each solid material has **one belt entrance on the west edge**, a red belt tile facing east, with a display panel (item icon and \`IN: <material>\` text); end your own belt at the clear tile west of it. Lubricant enters at the south edge. Coordinates are entity centres in the blueprint; north is negative y.

| Port | Material | Entrance tile (belt facing east) | Clear tile for your belt or pipe | Panel tile | Label text |
| --- | --- | --- | --- | --- | --- |
${m.inputPorts.map(v => `| ${v.id} | \`${v.item}\` | ${at(v.kind === 'fluid' ? v.position : v.entrance)} | ${at(v.externalContact)} | ${at(byId(v.panel).position)} | \`${v.label}\` |`).join('\n')}

- **Iron** runs down the west edge and east along the south edge. The three gear machines take plates from it directly (three arms each); one arm at ${at(byId(m.inputPorts[0].ringArm).position)} lifts iron onto the ring for the few machines that need a plate (green circuit, yellow belt, underground and splitter). It dives under the lubricant inlet at ${at(byId(m.ironBelt.find(id => byId(id).name === 'fast-underground-belt')).position)}.
- **Copper** and **plastic** end at one arm each, which lifts the material onto the ring while the ring holds less than its cap.
- **Lubricant** is a fluid: connect a pipe to the open end of the inlet pipe at ${at(m.inputPorts[3].position)}, from ${at(m.inputPorts[3].externalContact)}.
- **Electricity:** any outside pole within reach of the entry pole at ${at(byId(m.power.entryPole).position)} powers the mall (${c['medium-electric-pole']} medium poles, one network). The native test connects an outside pole at ${at(m.power.externalPolePosition)}. The label \`${m.power.label}\` is at ${at(byId(m.power.panel).position)}.

## Outputs

Three passive provider chests at the east end of the north band, each **limited to one slot** (bar 1) and fed by one collector arm that takes only its own product off the ring. Nothing else can enter a chest: every other arm drops on the ring or into a machine, and each collector has one filter.

| Chest tile | Product | Holds at most | Label text |
| --- | --- | --- | --- |
${m.outputs.map(o => `| ${at(o.position)} | \`${o.item}\` | ${o.cap} (one stack) | \`${o.label}\` |`).join('\n')}

Take items by hand or cover the chests with a logistics network; each refills to its stack while the mall has supplies. The yellow and red tier items are intermediates only and have no chest.
`);
  if (report) {
    const slices = meas.perFiveMinuteSlice;
    const share = mm => { const s = mm.statusSamples || {}, total = Object.values(s).reduce((a, b) => a + b, 0) || 1; return Object.entries(s).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replaceAll('_', ' ')} ${Math.round(100 * v / total)}%`).join(', '); };
    out.push(`## Measured rates and draw

Native, with all three chests emptied every second (\`native-report.json\`): a 15 minute warm-up, then ${meas.windowMinutes} minutes counted.

| Product | Per minute | Made in each five minutes |
| --- | --- | --- |
${PRODUCTS.map(n => `| \`${n}\` | ${fmt(meas.outputsPerMinute[n], 2)} | ${Object.values(slices[n]).join(' / ')} |`).join('\n')}

Draw over the same window, what the machines consumed (production statistics), which is what each entrance has to deliver at least:

| Entrance | Per minute | Taken in by the entrance |
| --- | --- | --- |
${MATERIALS.map(n => `| \`${n}\` | ${fmt(meas.inputsPerMinute[n], 0)} | ${fmt(meas.acceptedOntoEntrancesPerMinute[n], 0)} |`).join('\n')}

These are measured figures, not recipe arithmetic. They are the draw with every chest being emptied at once; with mostly full chests the draw is lower and only sets how fast a chest refills. The iron figure is mostly the three gear machines.

Per machine over the measured window:

| Machine | Products made | Status share |
| --- | --- | --- |
${report.machines.map(mm => `| \`${mm.recipe}\`${mm.tag ? ' ' + mm.tag : ''} | ${mm.measuredProducts} | ${share(mm)} |`).join('\n')}

The gear machines and the red circuit machine never wait, which is the intended bottleneck; everything else waits for them or for its own stock cap.
`);
  }
  out.push(`## How it works

- **One ring.** ${ringTiles} red belt tiles form one clockwise loop two rows tall (row 0 eastbound, row 1 westbound), with no splitter, side-load or underground. The north band's machines work from row 0, the south band's from row 1; every item passes every machine.
- **One reader.** One belt reads the whole ring in hold mode onto a green wire.
- **Caps.** Every arm that adds an item to the ring (the iron, copper and plastic entrance arms, the third gear machine's gear arm, each recipe's output arm) works only while the ring holds less than that item's cap (manifest \`ringCaps\`): ${Object.entries(m.ringCaps).map(([k, v]) => `${k} ${v}`).join(', ')}. The caps are small because the stock lives in the chests, not on the ring.
- **Express products.** An express maker puts at most ${m.ringCaps['express-transport-belt']} of its product on the ring; its collector arm takes them into the chest. A full chest stops its collector, the ring keeps its few items, the maker stops: the one-slot limit is the product cap, and no ring cap has to count the chest.
- **Direct hand-offs, always on,** keep the big flows off the ring: the three gear machines hand gears straight to their neighbours (${m.directTransfers.filter(t => t.item === 'iron-gear-wheel').length} arms: the fast underground maker and the express underground maker from the first, the express belt maker and the fast belt maker from the second, the fast belt maker also from the third), and the cable machine hands copper cable to the green circuit machine (two arms) and the red circuit machine. Gears and cable are the high-volume items; nothing else is handed over directly.
- **Gears.** The third gear machine also puts gears on the ring for the small users (yellow belt, fast splitter, express splitter). The express underground maker takes ring gears too, but only while the ring holds more than ${m.gearReserve} of them, so the small users are served first and it takes what is left. This is the only arm that takes under a circuit condition.
- **No clock.** The belt workshop shared scarce ingredients with a 30 second clock. Here each line has its own gear machine or gets a rule, and the native runs showed no product starving without one.
- **Arms.** All ${c['fast-inserter']} arms are fast inserters with hand size one and whitelist filters.
- **Lane room.** Everything rides one lane. Ring caps ${lane?.ringCaps} + one item in hand for each of the ${lane?.handOvershootAllowance} capped arms = ${lane?.maxCirculating} items at the very most, against ${lane?.conservativeLaneCapacity} one-lane places when the ${lane?.turnTiles} turn tiles are not counted at all (bound ${m.ringLimits.bound}, 75%).${report ? ` The most the native run ever saw on the ring was ${report.ringPeakTotal} items.` : ''} Raise caps only together with this check.
- Machines keep their ordinary ingredient and product buffers while idle; those are not stock.

## Native test

Protocol: supply only the three entrance belts (both lanes full), the outside lubricant pipe and outside power. Fill from empty with a bound of ${m.nativeProtocol.stockFillTicks / 3600} minutes until all three chests hold a full stack; collect everything; refill (same bound); collect; ${m.nativeProtocol.outageTicks / 3600} minutes with every input stopped; collect; recover (same bound); then the rate phase described above. At the end of each fill phase every chest must hold exactly its stack and nothing else. The ring must hold only declared items, never more than the lane-room bound and each item never more than its cap plus one hand per arm that adds it. Every machine must craft in the measured window and each product must be made in every five-minute slice of it. The run also checks every route, recipe, filter, hand size, circuit connection, fluid connection and power connection of the imported blueprint, with no repair of any kind.
`);
  if (report) {
    const row = (label, n) => `| ${label} | ${mins(timing[n]?.allTick)} | ${PRODUCTS.map(name => mins(timing[n]?.reached?.[name])).join(' / ')} |`;
    out.push(`Result for \`${report.blueprintSha256.slice(0, 8)}\`: **${report.passed ? 'passed' : 'failed'}**, ${report.checks.filter(k => k.passed).length} of ${report.checks.length} checks, ${report.actualTicks} ticks.

| Phase | All three at one stack after | Each product (belt / underground / splitter) |
| --- | --- | --- |
${row('Fill from empty', 1)}
${row('Refill after a complete collection', 2)}
${row('Recovery after the five-minute outage', 4)}

Times are read once a second of game time; they are measurements, not pass limits. Products made in the whole run: ${report.machines.map(mm => `${mm.totalProducts} ${mm.recipe}${mm.tag ? ' ' + mm.tag : ''}`).join(', ')}. Largest ring load seen: ${report.ringPeakTotal} items.
`);
  } else out.push('No passing native report exists for this string yet. Until one does, the blueprint is not qualified.\n');
  const mine = explored.filter(e => e.report.blueprintSha256 === d.hash);
  if (mine.length) out.push(`Exploration runs for exactly this string (their reports are kept beside the blueprint, each the unedited output of \`validate.mjs --explore\`):

${mine.map(e => `- **${e.title}** ([${e.file}](${e.file})): ${e.describe(e.report)}`).join('\n')}
`);
  out.push(`## Technology

- **Express products:** \`logistics-3\`, which needs production science and lubricant.
- **Everything else made inside:** \`logistics\`, \`fast-inserter\`, \`advanced-circuit\`, \`plastics\` need the usual chain. The full prerequisite list, in research order, is \`technologyClosure\` in the manifest (${d.tech.closure.length} technologies); the native test researches exactly that list.
- **Building it:** assembling machine 2, fast inserters, medium poles, \`logistic-robotics\` or \`construction-robotics\` for the provider chest (it works as a plain chest without robots).

## Provenance

The design principle (one capped circulating belt read by one belt reader, passive provider chests limited to one stack, belt entrances from the west, display-panel labels) comes from the belt workshop and the blue-tier mall in this repository. The layout, the hand-off arrangement of the gear machines, the collector chests and the express tier are new. No comparison with other designs is claimed.

## Reproduce

From the \`factorio-command-center\` folder:

\`\`\`sh
node scripts/requested-malls/express-belt-mall/generate.mjs     # rewrites this folder; byte-identical on a re-run
node scripts/requested-malls/express-belt-mall/audit.mjs        # static audit
node scripts/requested-malls/express-belt-mall/validate.mjs     # full native protocol (about 15 minutes of real time)
node --test tests/express-belt-mall.test.mjs
\`\`\`

The generator and the tests need only the pinned \`scripts/requested-malls/express-belt-mall/prototypes.json\` (taken from the installed ${p.gameVersion} game by \`pin-prototypes.mjs\`). The validator needs the Steam install of Factorio ${p.gameVersion} with Space Age and runs it headless in a private profile under \`.cache/express-belt-mall/\`; it never opens the player's saves. After a full run, run the generator again so this page states the new result.
`);
  return out.join('\n');
}
function sumDirect(p, product) {
  // Iron plates that go into a recipe directly (not through a gear), over the whole tree of one unit.
  let total = 0;
  const walk = (name, amount) => {
    const r = p.recipes[name]; if (!r || name === 'iron-gear-wheel') return;
    const made = r.results.find(v => v.name === name).amount;
    for (const i of r.ingredients) { if (i.name === 'iron-plate') total += amount * i.amount / made; else walk(i.name, amount * i.amount / made); }
  };
  walk(product, 1);
  return total;
}

// ---- exploration reports kept beside the blueprint (each is the unedited output of validate.mjs --explore) ----
import fs from 'node:fs/promises';
import path from 'node:path';
const stockText = stock => PRODUCTS.map(n => stock[n]).join(' / ');
const EXPLORATIONS = {
  hold: { title: 'One-hour hold at full stock', describe: r => {
    const full = r.holdAtFirstFull, held = (r.protocol.stockFillTicks - full.fullSinceTick) / 3600, rest = full.restAtEnd.reduce((n, mm) => n + mm.craftsInLastMinute, 0);
    const finalStock = r.phases.find(ph => ph.phase === 'cold-start stock').stock;
    return `all three chests were full after ${mins(full.fullSinceTick)} and stayed untouched for ${held.toFixed(0)} minutes; they held ${stockText(finalStock)} (belt / underground / splitter) at the end, never more than a stack; in the last minute before the collection the machines finished ${rest} crafts in all; the ring peaked at ${r.ringPeakTotal} items (bound ${r.ringBound}); the refill after the collection and the recovery after the outage passed (${r.passed ? 'every check of the run passed' : 'failures: ' + JSON.stringify(r.failures)}).`; } },
  'no-plastic': { title: 'Plastic withheld for one hour', describe: r => withheld(r, 'plastic-bar', 'the express splitter has no advanced circuits and stays at zero while the belt and the underground reach their stacks') },
  'no-lubricant': { title: 'Lubricant withheld for one hour', describe: r => withheld(r, 'lubricant', 'no express product can be made, the yellow and red tier fills to its caps and stops') },
};
function withheld(r, item, expectation) {
  const until = r.withhold[item], at = r.samples.find(s => s.tick === until) || r.samples.find(s => s.tick >= until);
  const ringAt = r.ringPeakTotal;
  return `${item} left unsupplied for the first ${(until / 3600).toFixed(0)} minutes of the fill (${expectation}). At that point the chests held ${stockText(at.stock)} (belt / underground / splitter); the ring peaked at ${ringAt} items (bound ${r.ringBound}) over the whole run; after supply returned all three chests reached their stacks, ${r.passed ? 'and every check of the run passed' : 'failures: ' + JSON.stringify(r.failures)}.`;
}
export async function loadExplorations(dir) {
  const out = [];
  for (const file of (await fs.readdir(dir)).filter(f => /^exploration-.*-report\.json$/.test(f)).sort()) {
    const name = file.replace(/^exploration-/, '').replace(/-report\.json$/, ''), report = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    if (EXPLORATIONS[name]) out.push({ name, file, report, title: EXPLORATIONS[name].title, describe: EXPLORATIONS[name].describe });
  }
  return out;
}

const LETTER = { 'fast-underground-belt': 'U', 'express-underground-belt': 'X', 'express-splitter': 'S', 'express-transport-belt': 'T', 'fast-transport-belt': 'F', 'iron-gear-wheel': 'G', 'electronic-circuit': 'E', 'copper-cable': 'C', 'advanced-circuit': 'A', 'transport-belt': 't', 'underground-belt': 'u', splitter: 's', 'fast-splitter': 'f' };
function asciiMap(d) {
  const grid = new Map(), arrow = { 0: '^', 4: '>', 8: 'v', 12: '<' };
  for (const e of d.blueprint.blueprint.entities) {
    const x = Math.floor(e.position.x), y = Math.floor(e.position.y);
    if (e.name === 'assembling-machine-2') { for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) grid.set(`${x + u},${y + v}`, LETTER[e.recipe]); continue; }
    const ch = e.name === 'fast-transport-belt' ? arrow[e.direction || 0] : e.name === 'fast-underground-belt' ? (e.type === 'input' ? '[' : ']') : e.name === 'fast-inserter' ? { 0: 'n', 4: 'e', 8: 's', 12: 'w' }[((e.direction || 0) + 8) % 16] : e.name === 'pipe' ? '=' : e.name === 'medium-electric-pole' ? '+' : e.name === 'display-panel' ? '"' : '#';
    grid.set(`${x},${y}`, ch);
  }
  const { bounds } = d.footprint, width = bounds.right - bounds.left;
  const lines = [`    ${Array.from({ length: width }, (_, i) => String(((bounds.left + i) % 10 + 10) % 10)).join('')}`];
  for (let y = bounds.top; y < bounds.bottom; y++) lines.push(String(y).padStart(3) + ' ' + Array.from({ length: width }, (_, i) => grid.get(`${bounds.left + i},${y}`) || '.').join(''));
  return lines.join('\n');
}
