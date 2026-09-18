# Factorio Command Center

A static Factorio 2.0.77 / Space Age blueprint library, recipe planner, and construction-crate command builder.

- 840 blueprint entries: 50 local builds, 632 Autosaved layouts, 98 additional community layouts, and 60 original recipe cells.
- Coverage index for all 273 craftable inventory items, including rocket parts retained in the silo. Mining-only resources and noncraftable tools are listed separately. Quality variants share recipes.
- Copy an importable blueprint, generate its construction crate, and trace the ingredients needed to operate it.
- All 60 new cells passed native five-minute production tests using saved item transport and fluid connections. Imported community layouts are recipe-reviewed, not individually simulated.

## Open the website

[Live GitHub Pages site](https://nagkumar91.github.io/factorio-command-center/#coverage). Open `site/index.html` for offline use, or run `npm run serve` for a local web server on port 18090. The website has no backend, accounts, analytics, or external runtime dependencies. Saved crate loadouts stay in your browser.

## Development and validation

```
npm ci
npm test
npm run build
npm run test:browser
npm run test:atlas-browser
```

`npm run index:atlas` rebuilds the imported collection index and recipe coverage. `npm run generate:cells` creates the gap-filling cells; `npm run test:cells` runs the installed Factorio executable in an isolated save and writes reports tied to blueprint SHA-256 hashes. Generating cells needs a vanilla Space Age data dump, supplied through `FACTORIO_RAW` or the documented test cache path. Serving and CI builds use the checked-in catalogue and do not need Factorio installed.

Ground cells include robots’ delivery infrastructure and require ingredients and startup robots. The three space-platform cells use turbo belts because robots and containers are unavailable there. Modules still require external power, relevant research, correct surface conditions, and heating on Aquilo. They are individual recipe modules; the production planner explains their upstream supply chain.

See [hosting instructions](deploy/README.md) for GitHub Pages and a separate persistent OpenClaw Pi service.

## Credits

Community collections are credited in the website and in `blueprint-sources/curated/*.source.json`: Autosaved, Nilaus, anonymous manufacturing-hub and fish-breeding authors, and Konage’s Prom Battlecruiser. Blueprint authors retain their authorship. Game graphics and names © Wube Software; this is an unofficial fan toolkit. Bundled font license files remain with the assets. No ownership of third-party blueprints or graphics is claimed.

---

# Factorio Command Center

A local website for this command and blueprint collection, using icons, fonts,
item names, stack sizes, and quality tiers from the installed Factorio game.

New: [Fusion Reactor (1.2GW)](power/fusion_reactor_1_2gw.md) is in the
blueprint library with a **Create construction crate** shortcut for all 152
build items. **Plan operating supplies** starts with the tested stock of 20
fusion power cells and 4,000 cold fluoroketone, with recipes back to raw
resources. The unchanged import and crate command passed native Factorio
2.0.77 checks; the reactor sustained a 1.1 GW load for 10 simulated minutes
after external startup power was removed.

[Robot Expansion Mall import string](mall/robot_expansion_mall.txt),
[factory preview](mall/robot_expansion_mall.png),
[extension overview](mall/robot_expansion_mall.overview.png), and
[setup guide](mall/robot_expansion_mall.md). This robot-fed mall makes roboports,
construction robots, logistic robots and big electric poles from iron ore,
copper ore, coal, water and crude oil. All intermediates are made inside;
there are no belts. Supply electricity and 200 starter logistic robots.
The 98 × 45 tile factory uses 13 substations and fits two adjacent cells of your
original robot grid. All 25 roboports and 85 big poles are preserved; the full
combined import is 252 × 252 tiles.

The previous [belt-fed Tesla mall](mall/compact_turbo_tesla_mall.md) and
[larger robot-fed mall](mall/closed_oil_roboport_mall.md) remain available.

## Open the site

**Double-click [index.html](index.html) to open the site in your browser.**
You can also open `site/index.html` directly.

The site is plain HTML, CSS, and JavaScript, with all game data and assets
included locally. It works offline without npm, Node.js, a server, or a build
step. Keep the `site/` folder together when moving it. To share or host the
website, copy that folder as-is to any static host, or use the `dist/` copy.

If the browser restricts clipboard access for local files, the Copy button
offers selected text that you can copy with Ctrl+C or ⌘C.

## What's inside

- **Command library:** searchable reviewed commands plus clearly labeled original
  history; favorites; generators for any available item or technology.
- **Crate builder:** all 289 visible inventory items, original icons, six supply
  presets, per-item quantities and qualities, six chest types, slot previews,
  automatic overflow, and copyable single-line Lua commands. Passive providers
  are the default for robot construction.
- **Loadouts:** current selection and named loadouts stay in browser storage.
  JSON import/export lets you move them between browsers. Importing or loading a
  saved loadout replaces the current selection; presets and blueprint materials
  add to it. Export is useful before clearing browser data. Browser storage for
  local files is separate from the previous localhost site; use export/import
  to transfer saved loadouts between locations or browsers.
- **Blueprint library:** matching JSON/import strings are grouped. Material lists
  include entities, tiles, modules, inserted-item requests, and qualities. Books
  count **every** contained design, including alternatives. Automatic/unavailable
  entities such as the platform hub are identified and excluded. Recipe inputs
  and operating fluids are not construction materials. **Create construction
  crate** generates an exact blueprint-only command without changing your
  saved loadout; **Pack build** adds the materials to the editable crate builder.
- **Autosaved collection:** 632 layouts from the
  [blueprint page](https://autosaved.org/factorio/blueprints) and its downloadable
  book, alongside your 50 local builds. The import keeps all 546 book entries
  and adds 86 different layouts found on the page. Export-version-only changes
  are matched; real layout variants are retained and labeled. Includes power,
  solar/accumulator/substation factories, robots, science, intermediates,
  transport, defense, and all five planets. Filter by section, purpose, input,
  or output. Copy individual strings or download the original complete book.
- **Blueprint explainers:** outside feeds → products made inside → outputs and
  services, with original game icons, per-craft recipes, saved machine counts,
  and local schematic previews. Power generation, storage, transport, and mining
  are described as services rather than invented crafting outputs. Unconfigured
  machines and recipes unavailable in the installed game are identified.
  Operating supplies have recipes, manufacturing machines, and links to full
  production plans and matching blueprints. Fusion analysis includes the
  reactor/generator fluid cycle, fuel consumption, startup coolant, and
  requester-chest logistics support.
- **Production planner:** set multiple finished quantities, combine shared
  ingredients, and expand recipes to ores and crude oil. Alternatively start
  from plates/refinery products or a selected blueprint's operating inputs.
  Solar, robot-network, and circuit presets are editable. Click any material
  for its recipe and matching blueprints. Export the plan, pack solid inputs,
  or pack finished goods into robot supply chests. Fluids remain listed for
  pipes and tanks and are never inserted into crate commands. Your order is
  saved locally in the browser.
- **Source files:** searchable original documents, scripts, mod archives, and
  blueprint exports, available to open or download.
- **Game setup:** starter-mod status, the manual grant command, chest behavior,
  and a console guide.

The website generates text. Paste the result into Factorio's console to execute
it. `/c` commands disable achievements in that save. Multiplayer use requires
admin access. Robot supply chests must be in a powered logistics network.

Crates themselves are normal quality; each item can have its own quality. A
command creates at most 500 chests. If terrain blocks placement or the active
game lacks a requested item/quality, it reports the problem and stops. Counts
and preview capacity use the indexed game configuration. Re-index after changing
mods; the generator still checks actual insertion counts at runtime.

## Starter Initializer 0.2.6

The update is packaged as `starter_initializer_0.2.6.zip` and installed in the
local Factorio mods folder. **Restart Factorio and load your save** to apply it.

- Automatic grants are off for new maps, even if an older installation saved
  `true` as the default preference.
- A migration switches the saved setting off when upgrading existing maps.
- `/starter_init_grant` and `/starter_init_grant <player-name>` still work.
- Existing supplies remain in the world. Existing mod archives have backups in
  `.cache/mod-backups/`; other mods and game saves are unchanged.
- To disable grants immediately in a running session, copy the command from
  **Game setup → Disable in current session**, or uncheck automatic grants in
  **Settings → Mod settings → Per map**.

See [the mod README](starter_initializer/README.md) for its item/fluid settings.

## Update the index (optional development tools)

These tools need Node.js 20 or newer. They are only needed when updating the
game-data snapshot, re-indexing source files, or running development tests.
Opening and using the website needs none of them.

```sh
npm install
npm run sync-game
npm run index
npm run index:production
npm run index:blueprints
npm run build
```

`sync-game` runs the installed Factorio executable with `--dump-data` in an
isolated `.cache/factorio` directory. It reads enabled installed mods and copies
icons locally; it does not change game settings or saves. The shipped snapshot
is Factorio 2.0.77 with Space Age and the enabled local mods. This matters:
Everything on Nauvis changes asteroid-chunk stack sizes.

Paths default to the macOS Steam installation. Override `FACTORIO_APP`,
`FACTORIO_BIN`, `FACTORIO_DATA`, and `FACTORIO_MODS` as needed. The native game test
currently targets the macOS app layout. `npm run index` scans the original
workspace files, excluding website/development output. `dist/` is a standalone
static site after building; double-click `dist/index.html` to open that copy.
The indexers produce both JSON for development tools and ordinary `.js` data
files loaded by classic script tags. The app uses no module loader or `fetch`.

`index:production` reads the isolated game's prototype dump. `index:blueprints`
uses the cached Autosaved page and book; pass `-- --refresh` to download current
copies. Run both after changing the game snapshot or local blueprint index.
Downloads happen only during this optional maintenance step. Attribution links
are the only reason to leave the offline site.

### Production model and limits

The planner calculates a **normal-quality material budget**, not factory
throughput. Shared demands are combined before rounding to whole recipe batches.
Advanced oil processing supplies heavy oil, light oil, and petroleum gas from
the same crafts; unused products are reported as surplus. It does not optimize
cracking. Supply storage or consumption for every refinery output.

Standard named recipes are preferred; ores and common gathered resources stop
the chain. Sulfuric acid is manufactured for the default Nauvis chain even
though Vulcanus has acid wells. Random-yield, recycling, and unselected alternate
planet routes are listed as outside supplies rather than guessed. Surface and
research requirements still apply. No machine/module/research productivity,
electricity, furnace fuel, spoilage, extraction cost, or travel cost is included.

Blueprint inputs/outputs are derived from configured recipes, without simulating
belts, pipes, circuits, or robot routes. Returned ingredients are identified as
startup/circulating stock. Construction costs are separate and retain requested
qualities and modules. Schematic previews show saved positions, not game renders.
Packing creates console commands for supplies; it does not automate crafting.

The command history is preserved. Repaired commands are separate library entries.
`mall/purple.json` contained 397 trailing commas; those were removed to make it
valid JSON. Its original bytes are backed up at `.cache/file-backups/mall-purple.json`.

## Verification

```sh
npm test
npm run test:browser  # opens local index.html offline in installed Chrome
npm run test:game     # uses disposable maps, never your saves
```

Tests cover packing boundaries, invalid inputs, qualities, blueprint material
counts, asset availability, offline browser search/copy/import/export/persistence,
clipboard fallbacks, and responsive pages. Native tests execute the generated Lua against real Factorio
surfaces and inventories with an adapter for the headless player's context.
They check all six chest types, every catalog item, presets, blocked terrain,
manual grants, and migration of an actual test save's old `true` setting.
Production tests also verify known solar/battery/substation chains, shared oil
outputs, inventory conservation, supplied-intermediate boundaries, cycle and
quantity rejection, blueprint coverage, explainers, and every imported layout's
construction materials. Browser checks run with networking disabled and include
production editing, persistence, export, blueprint-to-plan navigation, fluid
separation, and all six pages at four viewport sizes.

To package/reinstall the starter mod after edits:

```sh
npm run package:mod
npm run install:mod
```

## Files and assets

`site/` contains the frontend; `site/lib/packer.js` contains packing and Lua
generation; `scripts/` indexes game/workspace data; `tests/` contains validation.
There is no backend service or external runtime dependency. Game icons are
© Wube Software; bundled fonts and sprites are taken from this local installation
for this personal toolkit. Factorio API references:
[LuaSurface](https://lua-api.factorio.com/latest/classes/LuaSurface.html),
[LuaSettings](https://lua-api.factorio.com/latest/classes/LuaSettings.html), and
[migrations](https://lua-api.factorio.com/latest/auxiliary/migrations.html).
