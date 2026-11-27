// README of the compact metallurgic science pack blueprint, written from the manifest, the audit and (only when it is for exactly
// this string and passed) the native report.
const f1 = v => (Math.round(v * 10) / 10).toLocaleString('en-US');
const f2 = v => (Math.round(v * 100) / 100).toLocaleString('en-US');
export function readme(d, audit, proven, picture) {
  const m = d.manifest, z = m.sizing, fp = m.footprint, c = fp.counts, [i1, i2, i3] = m.inputPorts, [o1] = m.outputPorts;
  const parts = Object.entries(c).map(([n, k]) => `${k} ${n.replaceAll('-', ' ')}`).join(', ');
  const status = proven
    ? `**Qualified natively** in Factorio ${m.requiredGameVersion} Space Age on a Vulcanus surface, for the exact string in \`blueprint.txt\` (SHA-256 \`${m.candidateSha256}\`). All ${Object.keys(proven.runs).length} scenarios below passed (\`native-report.json\`). The robot network is not part of the test: what robots would deliver is put into the requester chests by script and what they would take is removed from the provider chest by script (see "What the test does not cover").`
    : `**Static only, not native-tested.** The ${audit.checksTotal} static checks pass (\`static-audit.json\`); no native report exists for this string.`;
  const run = (name, phase) => proven?.runs[name]?.phases.find(p => p.name === phase);
  const nativeTables = proven ? `
## Measured natively

Every figure is from \`native-report.json\`: ${Object.keys(proven.runs).length} scenarios, each its own headless game on a Vulcanus surface (pressure 4000) from a fresh import of this exact string, with only the ${m.technologyClosure.length} technologies in \`manifest.technologyClosure\` researched.

| What is measured | Result |
| --- | --- |
| Packs a minute, every entrance offered exactly its panel figure (30 minutes after 10 minutes of warm-up) | **${f2(proven.measured.outputsPerMinute[m.product].panelFigures)}** (target ${m.target}) |
| Packs a minute, every entrance offered more than it can take (20 minutes) | **${f2(proven.measured.outputsPerMinute[m.product].offeredMore)}** |
| Foundry state over the panel-figure half hour | ${Object.entries(proven.measured.foundryStatusPanel).map(([k, v]) => `${k.replaceAll('_', ' ')} ${Math.round(v / 18)}%`).join(', ')} |
| Foundry state offered more | ${Object.entries(proven.measured.foundryStatusGenerous).map(([k, v]) => `${k.replaceAll('_', ' ')} ${Math.round(v / 12)}%`).join(', ')} |

| Port | What | Panel figure | Taken, offered the panel figure | Taken, offered more |
| --- | --- | ---: | ---: | ---: |
${m.inputPorts.map(p => `| ${p.id} | ${p.item} | ${f1(p.perMinute)}/min | ${f1(proven.measured.inputsPerMinute[p.id].tookAtPanelFigures)}/min | ${f1(proven.measured.inputsPerMinute[p.id].tookOfferedMore)}/min |`).join('\n')}

| Scenario | What is done | Verdict | Result |
| --- | --- | --- | --- |
| generous | every entrance offered more than needed; 5 minutes warm-up, 20 measured, then the product exit blocked for 15 minutes, then released for 10 | ${proven.runs.generous.passed ? 'passed' : 'FAILED'} | ${f2(run('generous', 'steady').drawnPerMinute.measured)} a minute; with the exit blocked the chest filled to exactly ${run('generous', 'exit blocked').chestFinal} (one stack) and the foundry stopped with its output full (${run('generous', 'exit blocked').status.full_output} of 900 seconds in that state); released, back to the rate in ${run('generous', 'release').recovery.secondsToReach} s (${f2(run('generous', 'release').drawnPerMinute.measured)} a minute) |
| panel | every entrance offered exactly its panel figure; 10 minutes warm-up, 30 measured | ${proven.runs.panel.passed ? 'passed' : 'FAILED'} | ${f2(run('panel', 'steady').drawnPerMinute.measured)} a minute |
${['IN-1', 'IN-2', 'IN-3'].map(id => `| withheld:${id} | ${m.inputPorts.find(p => p.id === id).item} withheld from a cold start for 20 minutes, then supplied; the others offered more | ${proven.runs['withheld:' + id].passed ? 'passed' : 'FAILED'} | nothing made while withheld; back to 95% of the target ${run('withheld:' + id, 'supplied').recovery.secondsToReach} s after supply; ${f2(run('withheld:' + id, 'supplied').drawnPerMinute.measured)} a minute over the next ten minutes |`).join('\n')}

### Checks in every scenario

- Import: every entity at its exact position and direction, the recipe, no modules, crafting speed ${z.foundrySpeed} and built-in productivity ${z.foundryProductivity * 100}% read from the running game and compared with the pinned data, every panel text, every inserter's pickup and drop where the audit says, the two requests as the game reads them, the provider chest limited to one slot, one electric network.
- Ports: exactly one fluid connection of the foundry stands on a pipe (the copper entrance); the second input port and both output ports face nothing.
- Every second: no fluid but molten copper in the foundry or any pipe; the output chest never holds more than one stack (${z.outputCap}); the power stays on.
- All ${Object.keys(proven.runs).length} games together simulated ${f1(Object.values(proven.runs).reduce((n, r) => n + r.actualTicks, 0) / 216000)} game hours.

### What the test does not cover

- **The robot network.** Delivery to the requester chests and collection from the provider chest are done by script. Whether robots keep up depends on your network.
- **Placed turned or mirrored, piecemeal construction.** Not run; this is one machine and one pipe, and the blueprint has no belts to break.
- **Different research states.** Only the research needed to build and run it was done.
` : '';
  return `# Metallurgic science packs, one foundry · ${m.target} a minute

${status}

Makes **metallurgic science packs** from tungsten carbide, tungsten plate and molten copper, ${m.target} a minute, in **one foundry**. The two solid ingredients come from two requester chests that a robot network fills; the molten copper comes in by pipe; the packs go to one passive provider chest capped at one stack. It replaces the 110-entity "Metallurgic science pack · intermediate" flight-factory design, which was built for a mod profile that cannot be used now. Vanilla Space Age, normal quality, no modules, no beacons, no circuit network, no robots inside (no roboports). Vulcanus only: the recipe needs a surface pressure of exactly 4000.

## The recipe, read from the pinned 2.1.25 data

\`${m.product}\`: ${z.craftSeconds} s in category \`metallurgy\`, 3 tungsten carbide + 2 tungsten plate + 200 molten copper give 1 pack; allowed only where the surface pressure is 4000. A foundry has crafting speed ${z.foundrySpeed} and built-in productivity ${z.foundryProductivity * 100}%, so one foundry does ${z.maxCraftsPerMinute} crafts a minute and gives ${z.packsPerCraft} packs a craft: up to **${z.maxPacksPerMinute} packs a minute**. The target ${m.target} a minute (the old design measured 15.93; 15 or more was acceptable) needs ${f2(z.craftsPerMinute)} crafts a minute, ${f1(z.foundryUtilisation * 100)}% of one foundry.

Productivity makes the extra packs for free, so the ingredients are per craft, not per pack: at ${m.target} packs a minute, ${f2(z.craftsPerMinute)} crafts use ${f1(z.perMinute['tungsten-carbide'])} tungsten carbide, ${f1(z.perMinute['tungsten-plate'])} tungsten plate and ${f1(z.perMinute['molten-copper'])} molten copper a minute.

## Size and machines

- Footprint **${fp.width} × ${fp.height} = ${fp.area} tiles**, counting every entity (${fp.entities}): ${parts}. The old design had 110 entities (35 substations, 3 roboports, 61 pipes, 3 panels, 5 chests, 1 foundry, 2 bulk inserters) spread over about 49 × 73 tiles.
- Machines: **1 foundry**, no spare machine. It has room to spare instead: it can make ${z.maxPacksPerMinute} a minute (${f2(z.maxPacksPerMinute / m.target)} times the target), so the target never needs a second one. No assembling machine 2 or 3 is used, and none could be: the recipe's category \`metallurgy\` is crafted only by foundries. (The brief allowed AM2/AM3 "where needed"; none is needed or possible.)
- Inserters: three fast inserters (hand size pinned to 1; the busiest carries ${f1(z.perMinute['tungsten-carbide'])} items a minute at the target).

## Layout

\`\`\`
${picture.map((r, y) => `  ${y} ${r}`).join('\n')}
\`\`\`

\`F\` foundry, \`?\` requester or provider chest (west: requesters, east: provider), \`i\` fast inserter, \`=\` pipe, \`#\` substation, \`!\` display panel. Columns count from the west edge and rows from the north edge, both from 0. A drawing is in \`layout.svg\`. (The picture shows the chests as \`?\` because the shared drawing code has no letter for them; the table below names them.)

## Entrances, exit, power

Tiles are counted from the blueprint's top-left tile (column, row). Every port has a display panel beside it with the item, \`IN:\` or \`OUT:\` and the per-minute figure.

| Port | What | Kind | Tile | Side | Panel figure | Request or cap |
| --- | --- | --- | --- | --- | ---: | --- |
| IN-1 | tungsten carbide | requester chest | (${i1.tile.x}, ${i1.tile.y}) | west | ${f1(i1.perMinute)}/min | requests ${i1.request} (${z.requestMinutes} minutes of use; stack size ${i1.stackSize}, so two stacks) |
| IN-2 | tungsten plate | requester chest | (${i2.tile.x}, ${i2.tile.y}) | west | ${f1(i2.perMinute)}/min | requests ${i2.request} (${z.requestMinutes} minutes of use; stack size ${i2.stackSize}, under one stack) |
| IN-3 | molten copper | pipe | (${i3.tile.x}, ${i3.tile.y}) | south, connect at (${i3.tile.x}, ${i3.tile.y + 1}) | ${f1(i3.perMinute)}/min | none |
| OUT-1 | metallurgic science pack | passive provider chest | (${o1.tile.x}, ${o1.tile.y}) | east | ${o1.perMinute}/min | one slot = one stack = ${o1.cap} packs |

- **Request counts**: ${i1.request} tungsten carbide and ${i2.request} tungsten plate, each two minutes of the ingredient at ${m.target} packs a minute, rounded up (${f1(i1.perMinute)} × 2 = ${f1(i1.perMinute * 2)} and ${f1(i2.perMinute)} × 2 = ${f1(i2.perMinute * 2)}). Each chest has the one request at normal quality and nothing else. The panels say the same numbers.
- **Molten copper**: ${f1(i3.perMinute)} a minute (${f1(i3.perMinute / 60)} a second) at the target, by one pipe on the foundry's south side. Both of the foundry's input ports are one box for a one-fluid recipe, so one pipe on either feeds it; the pipe stands on the left one and the right one faces nothing.
- **Output**: the foundry's inserter fills the provider chest, which holds one stack (${o1.cap} packs). When nothing takes the packs the chest fills, the foundry stops with its output full, and it all starts again when robots take packs. At ${m.target} a minute a full chest is about ${f1(o1.cap / m.target)} minutes of output.
- **Power**: connect the substation at tiles (7–8, 3–4), marked by the panel \`POWER: connect this substation\` at (7, 5). One substation powers the foundry and the three inserters. The foundry is rated 2.5 MW.

## Fluids

- **molten-copper**: one pipe network of 1 pipe, joined to 1 foundry port.
- One fluid per network, no machine on two fluids, so no pump and no tank is needed. Every port the recipe does not use (the second input port and both output ports) faces nothing.
- The foundry's input-port behaviour comes from the native probe of the Vulcanus circuits family (a foundry recipe with one fluid ingredient uses both input ports as one box). That probe was run for casting iron; this blueprint's table (\`scripts/metallurgic-compact/fluid-slots.json\`) copies it with the fluid renamed${proven ? ', and the native run above confirms it for this recipe (the one pipe feeds the foundry at full rate and the foundry reports exactly one port on a pipe)' : '. It is not confirmed for this recipe by a game run'}.

## How it differs from the old 110-entity design

- Same machine and the same idea (one foundry, two requester chests, molten copper by pipe, output to a provider chest). The old one needed 35 substations and 3 roboports, a long pipe run and several displays; this one has one substation, no roboports and one pipe.
- Rewritten for the vanilla 2.1.25 recipe read from the game's own data, not the old mod profile.
- Every input is exactly one labelled entrance with a per-minute figure on its own panel, and the two solid inputs are requester chests with their request counts written on the panel.
${nativeTables}
## Things to know

- Vulcanus only. The recipe's surface condition is pressure 4000; on another surface the foundry will not craft it.
- The requesters ask for ${i1.request} and ${i2.request}; a robot network that is slower than two minutes of use can starve the foundry. Raise the request counts in the game if your deliveries are slow; the panel figures stay the same.
- Research needed (${m.technologyClosure.length} technologies in the closure), among them: ${m.requirements.filter(r => ['foundry', 'requester-chest', 'passive-provider-chest', 'metallurgic-science-pack', 'substation', 'fast-inserter'].includes(r.recipe)).map(r => `${r.technology} (${r.recipe})`).join(', ')}.
- Arms: three fast inserters carry 1 item a swing (pinned in the blueprint), so inserter capacity research changes nothing here.

## Reproduce

From \`factorio-command-center/\`:

\`\`\`
node scripts/metallurgic-compact/generate.mjs      # writes this folder from the pinned data (keeps the committed string)
node scripts/metallurgic-compact/native.mjs        # ${Object.keys(proven?.runs || { a: 1, b: 1, c: 1, d: 1, e: 1 }).length} headless games, about a minute (needs the game)
node --test tests/metallurgic-compact.test.mjs
\`\`\`

The pinned data is \`scripts/metallurgic-compact/prototypes.json\`, taken from \`factorio --dump-data\` of the installed 2.1.25 game by \`pin-prototypes.mjs\`. The tests need neither the game nor the dump. The native runner needs the installed Factorio 2.1.25 (Steam, Space Age), compares its game files with the pinned snapshot, and runs in private profiles under \`.cache/metallurgic-compact/\`; it never touches the player's game.
`;
}
