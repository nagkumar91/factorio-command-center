// Writes blueprint-sources/launch-kit/README.md from the manifest and the committed native report.
// Called by generate.mjs; deterministic, so a re-run leaves the folder byte-identical.
import fs from 'node:fs/promises';
import fsSync from 'node:fs';

const list = x => Array.isArray(x) ? x : Object.values(x || {});
const n1 = v => v == null ? 'n/a' : String(Math.round(v * 10) / 10);

// Exploration evidence kept under history/ (string, manifest, report): read when present so the README can quote it.
function evidence(dir, name) {
  try { return JSON.parse(fsSync.readFileSync(`${dir}/history/${name}/exploration-report.json`, 'utf8')); } catch { return null; }
}
function evidenceManifest(dir, name) {
  try { return JSON.parse(fsSync.readFileSync(`${dir}/history/${name}/manifest.json`, 'utf8'))[0]; } catch { return null; }
}

export function readme(m, report, dir = '.') {
  const r = report?.builds?.[0], fresh = r && r.blueprintSha256 === m.blueprintSha256 && !report.short;
  const ms = m.measured || {};
  const ports = [...m.inputs, ...m.fluids].sort((a, b) => a.y - b.y);
  const ent = item => (ms.entrances || []).find(e => e.item === item) || {};
  const exact = m.stockControl.exactLatches.map(l => l.product);
  const machines = Object.entries(m.machineCounts).sort((a, b) => a[0].localeCompare(b[0]));
  const total = machines.reduce((a, [, c]) => a + c, 0);
  const L = [];
  L.push(`# ${m.name}`, '');
  L.push(`Status: **${m.status}**${fresh ? ` (full native protocol, report \`native-report.json\`, blueprint SHA-256 \`${m.blueprintSha256}\`)` : ''}.`, '');
  L.push('One ground blueprint that builds, once, everything needed to set up white science from orbit, and then stops: the rocket silo, the cargo landing pad, the space platform starter pack and every item the `white-platform` and `white-pack-receiver` blueprints need. Each item sits in its own passive provider chest on the east side, capped at its count. When every chest is at its count nothing crafts any more; take items out and exactly those are made again.', '');
  L.push('## Size and machines', '');
  L.push(`Footprint ${m.footprint.width} x ${m.footprint.height} = **${m.areaGoal.achievedTiles} tiles** (goal ${m.areaGoal.goalTiles}, stretch ${m.areaGoal.stretchTiles}, fallback ${m.areaGoal.fallbackTiles}). ${m.areaGoal.achievedTiles <= m.areaGoal.goalTiles ? 'The goal is met.' : `The goal is missed by ${m.areaGoal.achievedTiles - m.areaGoal.goalTiles} tiles: 16 chests need 16 rows of the east column next to five exact machines (3 rows each) and the silo needs a sixth arm side, which sets the height at ${m.footprint.height}; the ring, two lane belts and 29 machines set the width.`}`, '');
  L.push(`${total} machines: ${machines.map(([k, c]) => `${c} ${k}`).join(', ')} (all assembling machine 2, except the battery chemical plant). No modules, beacons, AM3, foundry or electromagnetic plant.`, '');
  L.push('## Kit contents (outputs, east side)', '');
  L.push('Counts live only in `scripts/launch-kit/bill.json` (`cap = count + spare`, spare: 10% rounded up on fast inserters and foundation). Bill sources: ' + Object.entries(m.bill.sources).map(([k, v]) => `${k} \`${v}\``).join(', ') + '.', '');
  L.push('| Item | count | to the platform | to the receiver | spare | cap (chest) | max cap | control | completed at (min) |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |');
  for (const b of m.bill.items) L.push(`| ${b.item} | ${b.count} | ${b.platform ?? ''} | ${b.receiver ?? ''} | ${b.spare} | ${b.cap} | ${b.max} | ${exact.includes(b.item) ? 'exact latch' : 'chest condition'} | ${n1((ms.completion || []).find(c => c.item === b.item)?.minute)} |`);
  L.push('');
  L.push('The rocket silo and the starter pack are for the launch itself. The platform share is the `white-platform` request: every item of that blueprint except the 110 foundation the starter pack provides (100 placed tiles and 10 in the hub).', '');
  const lp = m.launch;
  if (lp) {
    L.push('## Rockets to lift the platform part', '');
    L.push(`The starter pack (${(lp.weightKg['space-platform-starter-pack'] ?? 0).toLocaleString('en-US')} kg) flies alone in ${lp.starterPackRockets} rocket. The platform request then weighs **${lp.platformRequestKg.toLocaleString('en-US')} kg**: ${Object.entries(lp.platformRequest).map(([k, v]) => `${v} ${k} x ${lp.weightKg[k]} kg`).join(', ')}. At ${lp.rocketLiftKg.toLocaleString('en-US')} kg a rocket that is ${lp.cargoRockets} cargo rockets${lp.wholeRockets ? ', each exactly full' : `, the last one not full (${lp.platformRequestKg % lp.rocketLiftKg} kg); the game sends only full rockets, so that remainder would stay unbuilt`}. **${lp.totalRockets} launches in all.** ${lp.note.replace(/ Rockets leave only full.*$/, '')} The weights are the game's own (the qualifying run checks each against the prototype). The \`rocket-supplies\` blueprint makes the rocket parts.`, '');
  }
  L.push('## Entrances (west side, one labelled entrance each)', '');
  const sr = m.supplyRule;
  L.push(`Panel figure = the supply the kit was qualified at (the qualifying run feeds exactly this, throttled). \`perKit\` is the recipe demand of one whole kit computed from the dump. The figures are computed from the bill by one rule, not tuned by hand: \`perMinute = roundUp(headroom x perKit / designMinutes)\`, where \`designMinutes\` (${sr.designMinutes} for this bill) is the longest machine chain of the bill (here ${sr.longestChain}: crafts x craft time / speed / machines), headroom ${sr.solidHeadroom} on belts and ${sr.fluidHeadroom} on the two fluids, at least ${sr.minimum}/min, whole numbers at 10 and above. A single minute can exceed the panel figure by up to 8 items because the throttled feed carries up to 8 items of credit; the average over the fill stays at or below it.`, '');
  L.push('| Entrance (north to south) | kind | panel /min | per kit | accepted to kit completion | ratio | average draw /min | peak minute |', '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const p of ports) { const e = ent(p.item); L.push(`| ${p.item} | ${p.kind === 'fluid' ? 'pipe' : 'belt'} | ${n1(p.perMinute)} | ${p.perKit} | ${n1(e.measuredPerKit)}${e.rule === 'consumed' ? ` (consumed ${n1(e.consumedPerKit)})` : ''} | ${e.ratio ?? 'n/a'} | ${n1(e.averageDrawPerMinute)} | ${n1(e.peakMinuteDraw)} |`); }
  L.push('');
  const fl = m.fluids.map(p => `${p.item} ${p.staticStorage}`).join(', ');
  L.push(`Fluids: the pipes and machine input boxes hold ${fl} units of fluid (every pipe and pipe-to-ground at 100, one 1000-unit input box per machine using the fluid). That is far more than 15% of a kit's demand, so the fluid entrances are judged on what was consumed by kit completion, like stone brick (column "ratio" is accepted / perKit; the consumed ratio is in the manifest).`, '');
  const sat = evidence(dir, 'saturated-entrances');
  if (sat?.builds?.[0]) {
    const sf = sat.builds[0];
    L.push(`Unthrottled (exploration run \`history/saturated-entrances\`, every belt entrance fed as fast as it takes and every pipe at 6000/min, ${sf.blueprintSha256 === m.blueprintSha256 ? 'same string' : 'same layout at the planning bill, so per-kit figures differ from this bill'}): kit complete in ${n1(sf.fill.kitMinutes)} min; accepted by completion ${sf.entrances.map(e => `${e.item} ${n1(e.measuredPerKit)} (${e.ratio}x${e.rule === 'consumed' ? `, consumed ${e.consumedRatio}x` : ''})`).join(', ')}. An unthrottled pipe fills the pipes and boxes first, so plan the fluid supply at the panel figure, not at what an open pipe will take at the start.`);
  }
  L.push('');
  L.push('Suppliers (contract section 13): ' + m.supplierLinks.map(l => `${l.copies} \`${l.supplier}\` copy for ${l.item} (entrance row ${l.entranceRowFromTop} from the top, ${l.perMinute}/min planned)`).join('; ') + '. Concrete is the northernmost entrance and electronic circuits the southernmost, with no other entrance in the five rows north of it. One green-circuits copy (360/min) covers this kit and rocket supplies together.', '');
  L.push('## How it works', '');
  L.push(`- **Lane belts** (no control, they back up): row 20 carries steel (north lane) and electronic circuits (south lane) to the foundation, steel-chest, processing-unit and first advanced-circuit machines (the second takes its circuits from the ring and puts its advanced circuits on the ring for the processing-unit machine); row 19 carries copper to the low-density and cable machines. The steel-chest machine sits in the middle, fed by a long arm from the steel lane, and hands its chest straight to the provider-chest machine.`);
  L.push(`- **One ring** of ${m.loopControl[0].loop.length} red belt tiles (capacity ${m.loopControl[0].capacity}), every tile a per-tile hold reader on one red network. Every arm that puts an item on the ring runs only while that item is below its ring limit (sum of limits ${m.loopControl[0].maximumStock}, ${Math.round(m.loopControl[0].maximumStock / m.loopControl[0].capacity * 100)}% of capacity). It carries the small flows (iron, ring shares of steel, copper and circuits, plastic, concrete, brick), the intermediates (gears, pipes, engines, cable, advanced circuits, processing units, electric engines, low density structures, foundation) and the travelling finals to their chests. Pipe and gear makers take iron only above a ring reserve (pipe 2, gear 10), so the electric-engine chain starts at once. The iron chain is kept lean because whatever it holds when the kit is complete is iron drawn but not used: ring limits iron ${m.loopControl[0].limits['iron-plate']}, gears ${m.loopControl[0].limits['iron-gear-wheel']}, pipes ${m.loopControl[0].limits.pipe}, engines ${m.loopControl[0].limits['engine-unit']}, electric engines ${m.loopControl[0].limits['electric-engine-unit']}, and the engine and electric-engine machines load ingredients only while their own product is below its ring limit.`);
  L.push('- **Caps**: one constant combinator carries every cap as a negative number on the green cap network that every chest also writes to. Chest arms (hand 1) run while their item is below 0. Ordinary finals load ingredients only while (chest - cap) plus their own ring stock is below 0.');
  L.push(`- **Exact latches** for ${exact.join(', ')}: each stands next to its own chest (machine, arm, chest); the machine reads its contents including the craft in progress; each ingredient arm runs while that ingredient is below one craft; a decider writes 100000 on every ingredient once the product (chest - cap + machine + output hand) reaches 0. They complete exactly cap crafts.`);
  L.push('- **Silo reserves**: the silo is first on the ring for processing units and electric engines, so two deciders shut its PU and EE arms while the ring holds no more than a small reserve; the collector, crusher, pad and starter pack still find what they need.');
  L.push('- **Foundation**: the foundation machine crafts while its chest is short or the starter-pack machine lacks its 60 foundation (decider F); the foundation chest arm runs only once the starter pack holds its 60 (decider C), so the starter pack is not starved.');
  L.push('- **AM1**: the AM1 machine takes gears and circuits only while the AM2 deficit exceeds the AM1s already made (an arithmetic combinator turns the AM1 count of both machines into the AM2 signal), so it does not over-make AM1. Its iron comes by a separate arm, one craft at a time (iron < 9 on the machine\'s own red network), so it never sits on three crafts of iron while it waits for gears.');
  L.push('- Direct hand-offs: AM1 to AM2, steel chest to provider chest, battery to accumulator, cable to foundation and to the first advanced-circuit machine, the first advanced-circuit machine to the processing-unit machine. Gears, pipes and engines reach the engine and electric-engine machines, and inserters the fast-inserter machine, over the ring.');
  L.push('- Fluids: lubricant to the electric-engine machine, sulfuric acid to the processing-unit machine and the battery plant, under the belts with pipe-to-ground.', '');
  L.push('## Measured (full protocol)', '');
  if (fresh) {
    const f = r.fill;
    L.push(`- Kit complete from empty in **${n1(f.kitMinutes)} minutes** at the panel supply (limit ${m.protocol.kitLimitMinutes}); last chest: ${list(f.order).at(-1)}.`);
    L.push(`- Rocket silo, cargo landing pad and starter pack each crafted exactly once by the blueprint's own machines (products finished and production statistics). Exact finals completed exactly their caps: ${exact.map(i => `${i} ${f.finishedAtKit[i]}`).join(', ')}.`);
    L.push(`- Hold ${r.hold.minutes} min and long hold ${r.longHold.minutes} min: every chest at its cap at every one-second sample (${r.hold.mismatches + r.longHold.mismatches} mismatches); no final machine crafted in the last ${r.hold.quietMinutes} / ${r.longHold.quietMinutes} minutes; finished items outside their chest at most ${JSON.stringify(r.longHold.slackMax)} (slack allowed: ring limit + 2).`);
    L.push(`- Selective refill (removed ${Object.entries(r.refill.removed).map(([k, v]) => `${v} ${k}`).join(', ')}): all five back at their caps in ${n1(r.refill.minutes)} minutes; no other chest moved, no other final machine crafted, the pad machine crafted exactly one more.`);
    L.push(`- Ring peak stock ${r.ringOverall.maxStock} of ${r.ringOverall.capacity} (limit 90%: ${Math.floor(.9 * r.ringOverall.capacity)}).`);
    L.push(`- Idle stock once the kit is complete (ring): ${Object.entries(f.idleStock.ring).map(([k, v]) => `${v} ${k}`).join(', ')}.`);
  } else L.push('No full-protocol report for this exact string.');
  L.push('');
  L.push('## Protocol', '');
  L.push(`Private headless Factorio 2.1.24 (Space Age) from \`scripts/launch-kit/validate.mjs\` with \`control.lua\`: import the string, revive, check geometry, recipes, wiring, one power network and clear approaches; feed only the declared entrances, each throttled to its panel figure (belt credit capped at 8; fluids per tick with a one-second carry); seed nothing. Fill from empty (limit ${m.protocol.kitLimitMinutes} min), hold ${m.protocol.holdMinutes} min, selective refill (limit ${m.protocol.refillLimitMinutes} min), long hold ${m.protocol.longHoldMinutes} min. Pass formula: launch-kit.md section 8.`, '');
  L.push('Reproduce: `FACTORIO_RAW=<dump> node scripts/launch-kit/generate.mjs` then `node scripts/launch-kit/validate.mjs` (about 25 s wall time). Exploration: `LAUNCH_KIT_EXPLORE=1 LAUNCH_KIT_PHASES=kit,hold,refill,longhold LAUNCH_KIT_SOURCE=<dir> node scripts/launch-kit/validate.mjs`.', '');
  L.push('## Deviation from the spec (stated, not hidden)', '');
  L.push('`measuredPerKit <= 1.15 x perKit` cannot hold where an entrance\'s own static storage is larger than 15% of a kit. Stone brick: one kit needs 10 bricks, but the entrance belt alone holds 16 and the ring limit 4, so any supply fills them (measured: ' + `${n1(ent('stone-brick').measuredPerKit)} accepted, ${n1(ent('stone-brick').consumedPerKit)} consumed). Sulfuric acid and lubricant: the pipes and machine boxes hold ${fl} units, against 15% margins of ${m.fluids.map(p => Math.round(.15 * p.perKit)).join(' and ')}. For such an entrance (\`staticStorage\` on the port) the rule is applied to what was consumed (accepted minus what still sits on belts, the ring, machine inputs, hands, pipes and fluid boxes at kit completion): measured ${m.fluids.map(p => `${p.item} ${ent(p.item).consumedPerKit != null ? n1(ent(p.item).consumedPerKit) : 'n/a'} consumed of ${p.perKit}`).join(', ')}. Every other entrance meets the rule on accepted items. The reviewer confirmed the stone-brick reading and recommended the same for the fluids (review of b638f4a39, must-fix 4); the planner should confirm it in the spec.`, '');
  L.push('## Changing the bill', '');
  L.push('Counts live only in `scripts/launch-kit/bill.json`. The bill stage is: edit `bill.json`, run `node scripts/launch-kit/generate.mjs` (it rewrites the cap combinator, the panel figures by the supply rule above, the panel texts, `kitLimitMinutes` and the manifest, and asserts every cap is within 0..max), then run the full protocol with `node scripts/launch-kit/validate.mjs`. The unit test reads counts and spares from `bill.json` and the per-kit demands from the manifest\'s recipe audit (recomputed from the dump when it is readable); only the fixed 16-item list and the max caps are written in the test, and the planning table of launch-kit.md section 2 is asserted only while both `bill.sources` say `planning`.', '');
  L.push('The bill stage has run once: the planning bill (launch-kit.md section 2) was replaced by the counts of the qualified `white-platform` and `white-pack-receiver` strings named in `bill.sources`, and this string was qualified with the full protocol at that bill.', '');
  const pb = evidence(dir, 'platform-request-bill'), pm = evidenceManifest(dir, 'platform-request-bill');
  if (pb && pm) {
    const pf = pb.builds[0];
    L.push(`\`history/platform-request-bill\` is the earlier exploration run at the same counts (${pm.blueprintSha256 === m.blueprintSha256 ? 'the same string as this one' : 'a different string'}), made before the platform lane had finished: ${pb.passed ? 'every check passed' : 'failed: ' + pf.failures.join('; ')}; kit complete in ${n1(pf.fill?.kitMinutes)} min, refill ${n1(pf.refill?.minutes)} min, ring peak ${pf.ringOverall?.maxStock}.`, '');
  }
  L.push('Cap edge cases: a foundation cap of 0 still makes the 60 foundation the starter pack needs (spec section 10; the harness allows the foundation machine the starter pack\'s foundation plus its ring slack and no more), and a starter-pack cap of 0 does not stop the foundation chest. An entrance whose per-kit demand is 0 is not required to accept anything. Exploration evidence for the cap range (`history/cap-range-stress`, an older string of the same layout): with six caps at their max and two at 0, every chest reached exactly its cap and the zero-cap machines never crafted.', '');
  L.push('## Review notes', '');
  L.push('Fix stage after the review of b638f4a39 (verdict fix). Every must-fix was applied; none is disputed:');
  L.push('1. Counts left the test file: it reads counts and spares from `bill.json`, keeps only the item list and max caps, checks each port\'s `perKit` against the recipe audit (and against the dump when readable), and asserts the planning table only while both bill sources say `planning`. Measured: changing a count and a source in a scratch copy and regenerating fails only the two stale-report tests.');
  L.push('2. Panel figures follow the bill by the supply rule (no hand-tuned constant); first shown at the platform\'s counts in `history/platform-request-bill`, now qualified at them.');
  L.push(`3. Iron overhead cut: lower iron-chain ring limits, engine and electric-engine machines gated on their ring stock, and the AM1 machine\'s iron one craft at a time. Iron draw at this bill ${ent('iron-plate').ratio ?? 'n/a'}x (the previous string took 1.154x at these counts and 1.124x at the planning bill).`);
  L.push('4. Fluids declare `staticStorage` and are judged on consumed amounts, their panel figures carry 25% headroom, and the README states the pipe volume and the unthrottled draw.', '');
  L.push('Size ideas from the review, tried in order on paper against the layout map; neither reached a buildable candidate, so no native run was made and the size stays 32 x 27:');
  L.push('- One row less (32 x 26): removing row 11 frees the east column, but the west side is also 27 rows with no slack: the west column holds four machines on rows 5 to 17 with the battery hand-off on row 8, row 18 carries the copper underground, rows 19 and 20 the lanes and rows 21 to 26 the bottom band. One of the four west machines would have to leave the column, and the only ring-adjacent cells left are taken (top row, inner east column, the dent under the small-chest column). With the silo also needing circuit-set filters on shared arms, this is a new layout, not a fix.');
  L.push('- West margin of two columns (31 x 27): with the ring on column 2, every ring crossing puts its underground exit on the arm column inside the ring, where the copper, steel and circuit admission arms (which need a pickup tile directly east and the ring directly west), the steel and circuit side-load head and the low-density machine\'s two copper long arms all compete for the same three cells on rows 17 to 21. The best arrangement found leaves the low-density machine one copper arm and still no cell for the copper admission arm.', '');
  const firstLaunch = name => { try { return JSON.parse(fsSync.readFileSync(`${dir}/history/first-launch-order/${name}.json`, 'utf8')); } catch { return null; } };
  const lockedRun = firstLaunch('locked-throughout'), unlockedRun = firstLaunch('unlocked-at-minute-75');
  const flb = lockedRun?.builds?.[0], fub = unlockedRun?.builds?.[0];
  if (flb && fub && flb.blueprintSha256 === m.blueprintSha256 && fub.blueprintSha256 === m.blueprintSha256) {
    const caps = m.outputCaps, end = flb.fill.endChests || {}, full = Object.keys(caps).filter(k => end[k] === caps[k]).length;
    const um = unlockedRun.firstLaunch.unlockMinute, done = fub.fill.completedMinute;
    L.push('## First launch (a save that has never created a space platform)', '');
    L.push(`The asteroid-collector and crusher recipes are unlocked only by creating the first space platform (trigger technology \`space-platform\`), so the full-protocol figures above (every recipe enabled) apply to a save where a platform already exists. Exploration runs of this exact string with those recipes disabled (\`history/first-launch-order\`, same harness): locked throughout, ${full} of ${Object.keys(caps).length} chests reach their caps (starter pack at ${n1(flb.fill.completedMinute['space-platform-starter-pack'])} min, rocket silo last at ${n1(flb.fill.completedMinute['rocket-silo'])} min) and the collector and crusher machines wait with \`recipe_not_researched\`; unlocked at minute ${um}, the crusher is done at ${n1(done.crusher)} min and the fourth collector at ${n1(done['asteroid-collector'])} min, and ${unlockedRun.passed ? 'every hold and refill check passes' : 'the run failed: ' + fub.failures.join('; ')}. So on a first launch, place the silo and create the platform as soon as the silo and starter pack are in their chests; the kit then finishes by itself and the last cargo rocket waits for the collectors and crusher.`, '');
  }
  L.push('## Preserve', '');
  L.push('The red ring wires and per-tile hold readers, the green cap wires, the five latch deciders with their red wires, the two silo reserve deciders, the foundation deciders F and C, the AM1 arithmetic combinator and the AM1 iron arm\'s red wire, the ring conditions on the engine and electric-engine input arms, all arm filters and conditions. Change counts only in `bill.json` (any cap from 0 to `max` uses the same entities).', '');
  L.push('## Bill of materials', '');
  L.push(Object.entries(m.billOfMaterials.items).map(([k, v]) => `${v} ${k}`).join(', ') + '.', '');
  L.push('## How it links to the other blueprints', '');
  L.push('- `concrete-supplier` feeds the concrete entrance; one `green-circuits` copy feeds the circuit entrance.');
  L.push(`- The chests hold the \`white-platform\` request (${m.bill.items.filter(b => b.platform > 0).map(b => `${b.platform} ${b.item}`).join(', ')}) and the \`white-pack-receiver\` items (${m.bill.items.filter(b => b.receiver > 0).map(b => `${b.receiver} ${b.item}`).join(', ')}), plus the rocket silo, the starter pack and the spares. \`rocket-supplies\` makes the rocket parts.`, '');
  L.push('## Tried and rejected', '');
  L.push('Kept under `history/` (string, manifest, report, NOTE.md):', '');
  L.push('- `hand-tuned-panel-figures`: qualified, the same 32 x 27 layout with hand-tuned panel figures (fluids held at the consumption rate) and a looser iron chain; kit in 68.3 min at the planning bill, but at the platform\'s counts 82.0 min with iron 1.154x and lubricant 1.342x. Replaced by the supply rule and the lean iron chain.');
  L.push('- `saturated-entrances`: exploration evidence for the same layout at the planning bill (a different string, since the caps differ), quoted above. `platform-request-bill`: the exploration run of this exact string before the bill stage.');
  L.push('- `compact-33`: qualified, 33 x 27 = 891 tiles, kit in 68.3 min (full-protocol report). Replaced by this layout, which sends inserters to the fast-inserter machine and the second advanced-circuit machine\'s output over the ring.');
  L.push('- `wide-first-pass`: the first qualified pass, 37 x 27 = 999 tiles, kit in 66.5 min (full-protocol report). Replaced by the 33 x 27 compact layout, which uses the empty middle for the steel-chest machine and packs the east column around a corner substation.');
  L.push('- `silo-first-on-the-ring`: one AC machine, the silo took every PU and EE first; collectors and crushers finished last, kit 92.5 min, fluid and iron draws above 1.15x.');
  L.push('- `four-way-priority`: silo held until the other four exact finals were done; PU and EE production stalled behind it, silo incomplete at 100 min.');
  L.push('- `one-advanced-circuit-machine`: all hold and refill checks passed, but one AC machine set the kit at 78.2 min and acid and lubricant draws at 1.22 and 1.23x.');
  L.push('- `gear-before-pipe`: two AC machines, but the gear maker took the early iron and the electric-engine chain started at minute 12; kit 72.5 min, acid 1.29x.');
  L.push('- Counting the iron already in the AM1 machine as AM1s on the way (iron / 9 into the AM2 signal) deadlocked: the arm loaded three crafts of iron before any gears and then stopped for good, so the AM2 chest stayed at 1 (exploration, not kept). The separate one-craft iron arm replaced it.', '');
  return L.join('\n');
}

export async function writeReadme(dir) {
  const [m] = JSON.parse(await fs.readFile(dir + '/manifest.json'));
  let report; try { report = JSON.parse(await fs.readFile(dir + '/native-report.json')); } catch {}
  await fs.writeFile(dir + '/README.md', readme(m, report, dir));
}
