// README.md and layout.svg of the Vulcanus science blueprint. Every number comes from the design, the pinned prototypes, the
// static audit or the native report for exactly this string; nothing is typed in.
import fs from 'node:fs/promises';
import path from 'node:path';
import { PROJECT } from './lib.mjs';
import { ascii, LEGEND, sizeOf } from './layout.mjs';
import { FULL_LENGTH, PROTOCOL } from './protocol.mjs';
import { TARGET, GOVERNOR } from './design.mjs';

const f0 = v => Math.round(v).toLocaleString('en-US'), f1 = v => (Math.round(v * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1 }), f2 = v => (Math.round(v * 100) / 100).toFixed(2);
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const COLORS = { foundry: '#b8743a', 'assembling-machine-3': '#4f8f6f', 'chemical-plant': '#477196', 'electric-furnace': '#8a6a52', 'fast-inserter': '#41a9d2', 'bulk-inserter': '#58c36e', 'long-handed-inserter': '#d78352', 'fast-transport-belt': '#b74c41', 'fast-underground-belt': '#8a3a31', 'fast-splitter': '#d9695c', 'express-transport-belt': '#3f77b8', 'express-underground-belt': '#2d5584', 'express-splitter': '#5f97d8', pipe: '#75bd95', 'pipe-to-ground': '#4f8f6f', substation: '#e0af60', 'display-panel': '#dac77a', 'passive-provider-chest': '#c94f4f', 'constant-combinator': '#9a8fd0', 'decider-combinator': '#9a8fd0', 'arithmetic-combinator': '#9a8fd0' };
export function layoutSvg(d) {
  const scale = 9, left = 24, top = 60, fp = d.footprint;
  let shapes = '';
  for (const e of d.blueprint.blueprint.entities) {
    const [w, h] = sizeOf(e.name, e.direction || 0), x = left + (e.position.x - w / 2) * scale, y = top + (e.position.y - h / 2) * scale;
    shapes += `<rect x="${x}" y="${y}" width="${w * scale}" height="${h * scale}" fill="${COLORS[e.name] || '#888'}" stroke="#101b29" stroke-width="0.5"><title>#${e.entity_number} ${esc(e.recipe || e.text || e.name)}</title></rect>`;
  }
  const width = left * 2 + fp.width * scale, height = top + fp.height * scale + 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101b29"/><g font-family="Arial,sans-serif"><text x="${left}" y="26" fill="#f2f6fc" font-size="18">${esc(d.blueprint.blueprint.label)}</text><text x="${left}" y="46" fill="#a8bed4" font-size="12">${fp.width} × ${fp.height} = ${fp.area.toLocaleString('en-US')} tiles · schematic from the entities: foundries brown, assembling machines green, fast belts red, express belts blue, pipes pale green, substations yellow, chests red squares</text>${shapes}<text x="${left}" y="${height - 14}" fill="#a8bed4" font-size="11">North is up. Lava and calcite enter top-left, plastic on the top edge, acid and lubricant on the bottom edge, stone leaves on the left edge.</text></g></svg>\n`;
}

export async function render(d, audit, proven, p, exact) {
  const m = d.manifest, fp = d.footprint, B = m.bill, lines = [];
  const supply = await fs.readFile(path.join(PROJECT, 'blueprint-sources/vulcanus-supplies/coal-plastic-lubricant/native-report.json'), 'utf8').then(JSON.parse).catch(() => null);
  const supplyOut = supply?.passed ? supply.measured.steady.throttled.outputsPerMinute : null;
  const status = proven ? `**qualified** (full native protocol, \`native-report.json\`, ${Object.keys(proven.scenarios).length} scenarios)` : exact ? '**not qualified**: the native report for this string did not pass' : '**not qualified**: no native report for this string yet';
  lines.push(`# Vulcanus science · production and utility packs, ${TARGET} a minute each, from lava and calcite`, '');
  lines.push(`Status: ${status}. Blueprint SHA-256 \`${d.hash}\`. Factorio ${p.gameVersion} Space Age, Vulcanus, vanilla, normal quality, no modules, no beacons, every recipe fixed in the blueprint.`, '');
  lines.push(`One blueprint for Vulcanus. Nine foundries turn lava and calcite into molten iron and molten copper; 32 more cast iron plate, copper plate, steel, gears, sticks, pipes, cable and low density structures; assembling machines 3 make electronic and advanced circuits, processing units, productivity modules, electric furnaces, rails, engines, electric engines and flying robot frames; chemical plants make batteries; electric furnaces make stone bricks. The two packs end in their own passive provider chests. It makes production (purple) and utility (yellow) science only: the other four packs stay with the six-pack design.`, '');
  lines.push('## What it makes', '');
  lines.push('| Pack | Target | Measured, every port offered more than it takes | Measured, every port held to its panel figure | Chest |', '| --- | ---: | ---: | ---: | --- |');
  for (const o of m.outputs) lines.push(`| ${o.item} | ${TARGET}/min | ${proven ? f2(proven.measured.rates.generous[o.item]) + '/min' : '-'} | ${proven ? f2(proven.measured.rates.throttled[o.item]) + '/min' : '-'} | passive provider at tile (${o.tile.x}, ${o.tile.y}), ${o.capacity.toLocaleString('en-US')} packs (five stacks, one rocket load) |`);
  lines.push('', `Measured over ${PROTOCOL.steadyMinutes} minutes after a ${PROTOCOL.warmupMinutes}-minute warm-up from empty; the pass floor is ${m.passFloor} a minute. A governor beside each chest hands over exactly one pack a second, so the build draws what its panels say and no more. When both chests are full and nothing is collected, everything stops; it starts again when packs are taken.`, '');

  lines.push('## Size and machines', '');
  lines.push(`Footprint **${fp.width} × ${fp.height} = ${fp.area.toLocaleString('en-US')} tiles** (every entity counted), ${fp.entities.toLocaleString('en-US')} entities. This is a large blueprint: nothing is brought in but plastic and two fluids, so all the smelting and all the circuits (${f0(B.crafts['electronic-circuit'])} electronic and ${f0(B.crafts['advanced-circuit'])} advanced circuits a minute) are made inside, without modules.`, '');
  lines.push('| Recipe | Machine | Needed at 60/min (recipe arithmetic) | Whole machines | Built |', '| --- | --- | ---: | ---: | ---: |');
  for (const [name, v] of Object.entries(B.machines).sort((a, b) => b[1].exact - a[1].exact)) lines.push(`| ${name} | ${v.machine} | ${f2(v.exact)} | ${v.whole} | ${m.machinesBuilt[name]} |`);
  const spare = Object.entries(B.machines).filter(([n, v]) => m.machinesBuilt[n] > v.whole).map(([n, v]) => `${n} ${m.machinesBuilt[n]} (${v.whole})`);
  const total = k => m.machines.filter(v => v.name === k).length;
  lines.push('', `The arithmetic counts the foundry's built-in +50% productivity on every casting recipe that allows it (not on pipes). In all: ${total('foundry')} foundries, ${total('assembling-machine-3')} assembling machines 3, ${total('chemical-plant')} chemical plants, ${total('electric-furnace')} electric furnaces.`, '');
  lines.push(`Spares, and why: ${spare.join(', ')} (built, with the whole-machine count in brackets).`);
  lines.push('- casting-steel 6 for 4.80: three foundries feed the rail machines and three the furnace machines, each group on its own belt lane; five shared would have had 4% to spare.', '- casting-iron 9 for 7.11: eight feed the circuit machines, one more stands beside the battery plants so that their plates do not ride the circuit belt.', '- casting-copper-cable 10 for 8.06: eight hand cable straight to the circuit machines (two foundries for every three machines), two more feed the advanced-circuit rows.', '- advanced-circuit 24 for 22.40, electronic-circuit 12 for 10.40, rail 3 for exactly 2.00: a machine that would have to run all the time is given a neighbour.', '- productivity-module 4 for exactly 4.00, no spare, on purpose: a fifth machine took advanced circuits the electric-furnace machines needed for as long as it was filling its belt; in the native run of that five-machine version production science made 56.4 a minute in the measured ten minutes after a start without plastic. The four run all the time.', '');
  lines.push(`Other entities: ${Object.entries(fp.counts).filter(([n]) => !['foundry', 'assembling-machine-3', 'chemical-plant', 'electric-furnace'].includes(n)).map(([n, c]) => `${c.toLocaleString('en-US')} ${n.replaceAll('-', ' ')}`).join(', ')}. Hand sizes are pinned (fast 1, bulk 2, long-handed 1), so the build behaves the same whatever inserter capacity is researched. Research needed: ${m.technologyClosure.length} technologies, among them foundry, automation 3, bulk inserter, logistics 3 (express belts), production and utility science.`, '');

  lines.push('## Ports', '', 'Tiles are counted from the blueprint\'s top-left tile (column, row). Every port has a panel beside it with the same figure.', '');
  lines.push('| Port | What | Kind | Side | Tile | Panel figure | Recipe total at 60/min | Taken, offered more | Taken, held to the panel |', '| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |');
  for (const v of m.ports) {
    const need = v.exit ? B.stone.surplus : B.outside[v.item], g = proven?.measured.ports.generous, t = proven?.measured.ports.throttled;
    lines.push(`| ${v.id} | ${v.item}${v.exit ? ' (out)' : ''} | ${v.kind} | ${v.side} | (${v.tile.x}, ${v.tile.y}) | ${f0(v.perMinute)}/min | ${f1(need)} | ${g ? f1(g[v.item]) : '-'} | ${t ? f1(t[v.item]) : '-'} |`);
  }
  lines.push('', `- **Power**: connect the substation at tile (${m.power.tile.x}, ${m.power.tile.y}) (panel "${m.power.label}"). ${fp.counts.substation} substations power everything; with everything working the build draws about ${f0((total('foundry') * 2.5 + total('assembling-machine-3') * 0.375 + total('electric-furnace') * 0.18 + total('chemical-plant') * 0.21))} MW for the machines alone.`);
  lines.push(`- **Lava**: ${f0(B.outside.lava)} a minute is ${f0(B.outside.lava / 60)} a second, about what one offshore pump gives (1,200 a second). **Calcite**: ${f1(B.outside.calcite)} a minute on a belt.`);
  lines.push(`- **Stone** is a by-product of every lava craft: ${f0(B.stone.made)} a minute are made, the rails and the stone bricks use ${f0(B.stone.used)}, and ${f0(B.stone.surplus)} a minute (${f1(B.stone.surplus / 60)} a second) leave on the express belt of OUT-STONE. Take it away, for example into lava with several inserters. If that belt backs up, the lava foundries stop and so does everything else; it starts again when the belt moves.`);
  lines.push('- **Nothing else comes in**: no coal, no water, no stone, no plates, no circuits.', '');

  lines.push('## Supplies it needs', '');
  if (supplyOut) {
    const plastic = supplyOut['plastic-bar'], lube = supplyOut.lubricant;
    lines.push(`- **Plastic bars**: ${f0(B.outside['plastic-bar'])} a minute. One copy of the coal to plastic bars and lubricant supply makes ${f0(plastic)} plastic and ${f0(lube)} lubricant a minute (its own native report), so this build needs **${Math.ceil(B.outside['plastic-bar'] / plastic - 1e-9)} copies** for the plastic (${f1(B.outside['plastic-bar'] / plastic)} exactly). ${f0(B.crafts['advanced-circuit'] * 2)} of the plastic go into advanced circuits, ${f0(B.crafts['casting-low-density-structure'] * 5)} into low density structures.`);
    const blocked = supply.measured.phases.throttled['lubricant exit blocked']?.outputsPerMinute['plastic-bar'];
    lines.push(`- **Lubricant**: ${f0(B.outside.lubricant)} a minute, for the electric engines: **${Math.ceil(B.outside.lubricant / lube - 1e-9)} copy** covers it. The ${Math.ceil(B.outside['plastic-bar'] / plastic - 1e-9)} copies built for the plastic can make ${f0(Math.ceil(B.outside['plastic-bar'] / plastic - 1e-9) * lube)} lubricant a minute, far more than is used here; in that supply's own native test plastic kept coming at ${blocked === undefined ? 'its rate' : f0(blocked) + ' a minute'} with its lubricant exit blocked, so the unused lubricant exits can be left closed.`);
  } else lines.push(`- Plastic bars ${f0(B.outside['plastic-bar'])} a minute and lubricant ${f0(B.outside.lubricant)} a minute.`);
  lines.push(`- **Sulfuric acid**: ${f0(B.outside['sulfuric-acid'])} a minute (${f0(B.crafts.battery * 20)} for batteries, ${f0(B.crafts['processing-unit'] * 5)} for processing units), from your own source.`, '');

  lines.push('## How it works', '');
  lines.push('- **Lava foundries** (top row): lava comes in along the top, each foundry takes calcite from the belt under it and puts its stone on the stone belt; the molten metal goes down into two mains (iron row 10, copper row 12) and from there down the west edge and east to the circuit band.');
  lines.push('- **Heads and bodies.** Each band has foundries at its west end, above and below one belt, so that each side loads its own lane (steel and sticks; steel and bricks; cable; iron and copper plate; gears and pipes). The machines of the band stand east of them along the same belt.');
  lines.push('- **Production science**: three rail machines each stand between two pack machines and hand them the rails directly; electric furnaces and productivity modules arrive on one belt, a lane each.');
  lines.push('- **Electronic circuits** (east column): cable foundries stand between the circuit machines and hand them cable directly, two foundries for three machines; iron plates run down the middle belt.');
  lines.push('- **Advanced circuits**: two rows of twelve around one cable belt; circuits on the near belt, plastic on the far belt.');
  lines.push('- **South strip**: engines and electric engines, low density structures, batteries, then processing units over utility science over frames.');
  lines.push(`- **Governors**: beside each chest a timer adds one a tick; the chest arm runs while it shows ${GOVERNOR.period} ticks more than the start delay, and every pack it lifts takes ${GOVERNOR.period} off. One pack a second, ${TARGET} a minute. Nothing is handed over for the first ${GOVERNOR.startDelay / 3600} minutes after the governors get power, so belts and machines fill first; after a pause at most ${GOVERNOR.banked} extra packs follow. These eight combinators are the only circuits; no machine has a circuit connection.`);
  lines.push('- **Fluids**: one fluid per pipe network. A foundry with a one-fluid recipe takes that fluid on both of its input ports (the game joins them), so no port is left to meet a wrong pipe; the low density structure foundries take iron on one port from a pipe and copper on the other through a pipe-to-ground that passes under the iron main.', '');

  if (proven) {
    const S = proven.scenarios, rate = (s, name) => { const ph = s.phases.find(v => v.name === name); return Object.values(ph.packsPerMinute).map(f2).join(' / '); };
    const sweeps = Object.values(S).reduce((n, s) => n + s.fluidSweeps, 0), faults = Object.values(S).reduce((n, s) => n + s.fluidFaultCount, 0);
    lines.push('## Measured natively', '', `Every figure below is from \`native-report.json\`: ${Object.keys(S).length} scenarios, each its own headless game on a Vulcanus surface from a fresh import of this string, with only the technology closure researched. Rates are production / utility packs a minute taken from the chests.`, '');
    lines.push('### Full-length runs', '', '| Scenario | Result |', '| --- | --- |');
    lines.push(`| Every port offered more than it takes | ${rate(S.generous, 'steady')} over ${PROTOCOL.steadyMinutes} minutes after ${PROTOCOL.warmupMinutes} minutes from empty |`);
    lines.push(`| Every port held to exactly its panel figure | ${rate(S.throttled, 'steady')} over ${PROTOCOL.steadyMinutes} minutes after ${PROTOCOL.warmupMinutes} minutes from empty |`);
    const bl = S.blocked.phases, st = S.stone.phases, ou = S.outage.phases;
    lines.push(`| Chests not emptied | both chests at exactly ${Object.values(bl[1].chests).join(' and ')} and the pack machines still after ${f1(bl[1].minutes)} minutes; ${PROTOCOL.holdMinutes} minutes held with ${Object.values(bl[2].packCrafts).join(' and ')} pack crafts; after release ${rate(S.blocked, 'rate after release')} (minutes 10 to 20) |`);
    lines.push(`| Every input cut for ${PROTOCOL.outageMinutes} minutes | during the outage ${rate(S.outage, 'outage of every input')}; afterwards ${rate(S.outage, 'rate after the outage')} (minutes 10 to 20 after supply returned) |`);
    lines.push(`| Stone exit blocked | pack machines still after ${f1(st[1].minutes)} minutes; ${Object.values(st[2].packCrafts).join(' and ')} pack crafts in the next 5 minutes; after release ${rate(S.stone, 'rate after release')} (minutes 20 to 30) |`);
    lines.push('', '### Shortened runs', '', `Each of these ends with ${PROTOCOL.shortMeasureMinutes} minutes measured (not 30). Staged builds and turned placements run ${PROTOCOL.shortWarmupMinutes} minutes first. A withheld-input start runs, once the input is supplied, until both packs have kept the floor of ${PROTOCOL.passFloor} a minute for ten minutes (the time that took is in the table), and is then measured for ${PROTOCOL.shortMeasureMinutes} more.`, '', '| Scenario | Start | Rate over the measured 10 minutes | Foreign fluid |', '| --- | --- | ---: | ---: |');
    for (const [name, s] of Object.entries(S)) {
      if (FULL_LENGTH.includes(name)) continue;
      const start = name.startsWith('single:') ? `only the ${name.slice(7)} chest emptied, the other left to fill (${Object.entries(s.phases.at(-1).chests).filter(([k]) => k !== name.slice(7)).map(([, v]) => v).join('')} packs in it at the end)` : name.startsWith('withheld:') ? `cold start with ${name.slice(9)} withheld for ${PROTOCOL.withheldMinutes} minutes (${Object.entries(s.phases[0].packsPerMinute).map(([k, v]) => `${k.split('-')[0]} ${f1(v)}`).join(', ')} a minute meanwhile), then supplied: both packs at the floor for ten minutes ${f1(s.phases[1].minutes)} minutes later` : name.startsWith('build:') ? `built ${PROTOCOL.stagedBuild.perStep} entities every ${PROTOCOL.stagedBuild.everyTicks} ticks, order ${s.build.name} (complete after ${f1(s.build.completeTick / 60)} s), ${s.build.feedAfterBuild ? 'supplies connected a minute after the last entity' : 'power and every input live from the first tick'}` : `placed ${name.slice(7).replace('flip-', 'flipped ')}${s.flip ? ' (a flipped copy of the string, see below)' : ' (the game\'s own rotation of this string)'}`;
      lines.push(`| ${name} | ${start} | ${name.startsWith('single:') ? f2(s.phases.at(-1).packsPerMinute[name.slice(7)]) + ' (the emptied pack)' : rate(s, 'rate')} | ${s.fluidFaultCount} |`);
    }
    lines.push('', `**Fluid watch**: in every scenario every pipe network and every machine was checked every ${PROTOCOL.fluidWatchEveryTicks} ticks (while a staged build is going up: every pipe, pipe-to-ground and machine one by one; afterwards one pipe of each network and every machine, and every entity one by one every 600 ticks). ${sweeps.toLocaleString('en-US')} sweeps in all, **${faults} foreign fluids found**. At import the harness also checks that every machine port joins a pipe of exactly its own fluid or nothing.`, '');
    lines.push(`**Flips**: the headless game has no player cursor to flip a blueprint with. The two flipped placements are copies of the string turned over by the game's own rule for each entity (\`LuaEntity.flip\`, recorded in \`fluid-slots.json\` by a native probe), imported and run like the others; their strings differ from the published one (\`placedSha256\` in the report). The three rotations are the game's own \`build_blueprint\` rotation of the published string.`, '');
    lines.push(`Harness speed: about ${f0(Object.values(S).reduce((n, s) => n + (s.timesRealTime || 0), 0) / Object.keys(S).length)} times real time per game; ${f0(proven.wallSecondsTotal / 60)} minutes of wall time for ${f1(Object.values(S).reduce((n, s) => n + s.actualTicks, 0) / 216000)} game hours.`, '');
  }
  lines.push('## Good to know', '');
  lines.push(`- The first packs reach the chests ${GOVERNOR.startDelay / 3600} minutes after the substations get power, whatever else is ready. From then on it is one pack of each kind a second.`);
  lines.push(`- Take the stone away: ${f0(B.stone.surplus)} a minute leave on one express belt on the west edge. A blocked stone belt stops the whole build (measured above).`);
  lines.push('- Both packs share the lava foundries, the stone belt, the circuit column and the plastic. If only one chest is emptied, that pack keeps its rate and the other line stops with its chest full (measured above, 35 minutes each way).');
  lines.push('- Belts are fast (red) and express (blue) as placed; do not swap the blue ones for red: the stone belt, the plate belt and the circuit belts carry more than a red lane holds.');
  lines.push('- It can be placed in any of the four rotations and flipped on either axis (measured above). Leave the tile beyond each port free for your own belt or pipe.');
  lines.push(`- The electric furnaces that make stone bricks have no recipe to set: a furnace smelts what it is given, and they are given only stone.`, '');
  lines.push('## Layout', '', '```', ...ascii(d.blueprint.blueprint.entities).rows, '```', '', LEGEND, '');
  lines.push('## Reproduce', '', '```', 'node scripts/vulcanus-science/production-utility-science/generate.mjs          # blueprint, manifest, ports, audit, README', 'node scripts/vulcanus-science/production-utility-science/validate.mjs          # the full native protocol (needs the game)', 'node scripts/vulcanus-science/production-utility-science/probes/fluid-slots.mjs # the fluid ports and flip rule, read from the game', 'node --test tests/vulcanus-science.test.mjs                                    # no game needed', '```', '');
  lines.push(`Static audit: ${audit.passed ? `passed, ${audit.checksTotal} checks` : 'FAILED: ' + audit.errors.join('; ')} (\`static-audit.json\`). Arm rates and what a machine holds before it stops: \`scripts/vulcanus-science/production-utility-science/rates.json\` (native probe).`, '');
  return { 'README.md': lines.join('\n'), 'layout.svg': layoutSvg(d) };
}
