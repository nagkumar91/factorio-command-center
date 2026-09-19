# Early game · raw materials, no robots

104 independent production modules, grouped into 29 research packs, for Factorio
2.0.77 with Space Age. Each module makes one finished product from raw materials.
Its smelting, gears, cables, circuits and other intermediate recipes are inside
the saved layout. Electricity comes from your external grid.

The collection covers obtainable Nauvis recipes whose research needs only red
and green science. This includes the machinery and ingredients for making blue
and military science, but excludes recipes unlocked with those later science
packs. Five barrel recipes are deferred because their fluids require later
research or other planets. Technologies that only improve stats do not need a
new production module. The exact coverage and exclusions are in `research.json`.

## Build the mall in stages

1. Establish power and obtain the initial construction supplies. These upgraded
   layouts use **assembling machine 2** after **Automation 2**, and **steel
   furnaces** after **Advanced material processing**. Every module uses **big
   and medium electric poles**, requiring **Electric energy distribution 1**.
   These upgrades require red and green science. Some layouts also need Logistics for crossings
   and ingredient splitters; each card lists every required research branch.
2. Select **Early game · no robots** in the local blueprint library. Open
   **Choose a research unlock** to filter modules or download that research pack.
3. Build a module's ghosts by hand. Use its displayed footprint to leave room
   for adjoining modules and raw supply lines. Connect external power to the
   **big electric pole marked P**; medium poles distribute it inside the module.
4. Match the item/fluid icon on each display to its entrance directly below.
   Feed the belt or pipe from the left; both belt lanes take the shown material.
   Press **Alt** to show the labels. No plates, circuits, gears, belts, inserters,
   or other manufactured items are operating inputs.
5. Collect the finished product from **OUT**. Solid outputs use a wooden chest
   limited to one stack; empty it or add an output belt to resume production.
   Fluid products have an accessible output pipe; attach storage or consumption.
6. After the next unlock, add the corresponding independent modules. Research
   branches can be taken in any order once each module's listed requirements are
   met. Existing modules do not need to supply intermediates to the new ones.

The full starter book contains the same tested modules in nested research packs.
The power, mining and belt-balancer designs from the earlier collection remain
available under **Community starter references**; they are separate from these
raw-only production modules.

## Standard connections

The left edge follows the same A–G input order. Port spacing varies between
modules to save space; follow each module's labeled preview and input displays.
Unused entrances are omitted. Each solid has its own yellow input belt; fluids
have separate pipes. Connect external power at the big pole marked **P**.

| Marker | Raw input |
| --- | --- |
| A | Iron ore |
| B | Copper ore |
| C | Coal, including furnace fuel |
| D | Stone |
| E | Wood |
| F | Water |
| G | Crude oil |

Only the inputs required by that product are shown. Wooden products need raw
wood from trees. Oil-stage modules need raw crude oil and contain their own
basic refinery. Electricity is always external. These are compact independent
cells rather than throughput-balanced factory lines; duplicated smelting is
intentional so each module can run by itself. Larger recipes need larger cells,
and each card shows its actual tile footprint.

All 104 modules include input display panels (299 in total). Each sign sits in
the free tile directly above its entrance. The website preview connects item
icons and names to the corresponding entrances. Use the current preview when
replacing an older layout: compaction moves some ports and machines.

**The signs are optional.** Display panels unlock with **Circuit network**.
Before that research, leave their ghosts unbuilt and follow the website's input
diagram; every production module still works at its listed unlock. Static signs
need no circuit wires or power. Their first text line is always visible in Alt
mode, with full instructions on hover. See the [official display-panel guide](https://factorio.com/blog/post/fff-419).

Construction uses normal-quality yellow belts, ordinary inserters, steel
furnaces, assembling machine 2, big and medium electric poles, and wooden output chests.
Steel furnaces burn coal from the existing labeled fuel feed. Fluid recipes use
the necessary chemical plant or refinery after the corresponding research.
No robot network, logistics chests, beacons or installed modules are
required. Some outputs are upgrade modules, but no upgrade modules are needed
to run the layouts.

The compaction pass shortens transport-only rows and columns while preserving
inserter targets, belt connections, underground pairs and separate fluid
networks. It then places a connected big/medium pole grid. Compared with the
previous layouts, 100 modules are smaller and four keep the same footprint;
their combined bounding area falls from 58,324 to 50,378 tiles (13.6%). The pole
count falls from 1,809 to 726. For example, iron plates shrink from 11×9 to 8×8
tiles, and sulfur from 20×21 to 16×13. These are independent production cells;
the layouts are not claimed to have the minimum possible area.

## Verification

`tests/early-game.mjs` imports each exact saved string into isolated Factorio
2.0.77 with Space Age. It enables only the declared production research and
checks that production construction items and configured recipes are unlocked.
Optional static signs are revived even before their Circuit network unlock;
the native test verifies their exact saved icons, text and Alt-mode settings.
This exception applies only to the display assigned to each raw input. No
additional production research is enabled. The test supplies only the
listed raw inputs at exterior ports and electricity at P; it does not inject
anything into assemblers or furnaces.

The native test also verifies that every saved electric pole and every electric
crafting machine and inserter is connected to the same network as P. All modules
contain exactly one big connection pole and at least one medium distribution pole.

The test runner uses isolated parallel game instances. Belt fixtures supply up
to two raw items per second per entrance; fluid supply is continuous. This is a
functional production test, not a belt-capacity benchmark.

The test runs 45 simulated minutes. Every internal crafting machine must finish
a craft, and every advertised output must reach its saved collection point.
Output chests fill naturally, are emptied halfway through, and must replenish
if they had already produced stock. Fluid outputs are collected continuously.
Outputs are sampled once per second. Reported solid counts are peak chest stock,
not total throughput.

The exact blueprint string and connection/research configuration are hashed in
`validation.json`. Indexing refuses any module without matching successful
native evidence. These checks establish importability, research availability,
transport and production with continuous raw supplies; they do not certify a
maximum production rate or a mathematically minimum footprint.

```sh
npm run prepare:early-game
npm run test:early-game
npm run index:atlas
npm test
npm run test:early-game-browser
npm run build
```

## Original designs and community references

The 104 raw-input modules are original Factorio Command Center layouts generated
from the installed vanilla recipes and research tree. Their generator is
`scripts/raw-starter-layout.mjs`; `scripts/prepare-early-game.mjs` resolves all
intermediate recipes and research requirements. `scripts/starter-input-displays.mjs`
adds the input signs without rerouting production. To update only signs on
existing layouts, run `node scripts/label-early-game.mjs`, then rerun native
verification and indexing before using the revised strings on the website.

`scripts/starter-machines.mjs` selects assembling machine 2 and steel furnaces
for future layouts. `node scripts/upgrade-early-game-machines.mjs` applies those
upgrades to saved layouts without moving entities, routes or input displays,
and updates their research prerequisites and pack grouping. Native tests and
indexing must follow any upgrade; indexing removes obsolete research downloads.

`scripts/compact-starter-layout.mjs` compacts future generated layouts and
replaces their power grid. To apply this to existing saved layouts, run
`node scripts/compact-early-game.mjs`, then rerun `npm run test:early-game` and
`npm run index:atlas`. This also updates port coordinates, construction research,
previews, crates and research downloads.

The 14 earlier community-derived references retain their authors, source
strings, changes and separate native evidence in `community-manifest.json`,
`community-validation.json` and `originals/`. Their earlier five-minute test
results apply to those reference strings, not to the new raw-only designs.

| Community reference | Credited original source |
| --- | --- |
| Mining and smelting | [Nilaus — Basic Mining and Smelting](https://www.factorio.school/view/-KoluN5jvWgI0egykK_W) |
| Green circuits | [Nilaus — Modular Green Circuits](https://www.factorio.school/view/-KoqgcmWqjJGLf6csjL4) |
| Steam power | [Nilaus design, Yoyo Ma power-book collection](https://www.factorio.school/view/-Kn2afLokZdBO-uHcIAF) |
| Tiny workshop | [Calabash Squash — belts and inserters](https://www.factorio.school/view/-P-ShwxYSOz41YwznHuq) |
| Starter mall | [Calabash Squash — staples (early game)](https://www.factorio.school/view/-P-XpDkqICZ1p_PIJFLH) |
| Red and green science | [Christoffer Ramqvist — Tileable Science](https://www.factorio.school/view/-KnQ865j-qQ21WoUPbd3) |
| Belt helpers | [Durabys — Complete Belt Series: Yellow](https://www.factorio.school/view/-KjZ0Rk_VXbdnxJ9jmUj) |
