// Native probe of arm rates and machine output limits (Factorio 2.1.25, headless, private profile under .cache/vulcanus-science/probe-rates).
//   node scripts/vulcanus-science/production-utility-science/probes/rates.mjs [--write]       --write replaces rates.json
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, PROJECT, prototypes, technologyClosure } from '../lib.mjs';
import { runProbe } from './run-probe.mjs';
const p = await prototypes();
const tech = technologyClosure(p, ['production-science-pack', 'utility-science-pack'], ['foundry', 'assembling-machine-3', 'chemical-plant', 'bulk-inserter', 'pipe-to-ground', 'processing-unit', 'electric-engine-unit', 'battery', 'casting-low-density-structure']);
const arms = await runProbe('rates', path.join(HERE, 'probes/rates.lua'), { technologies: tech.closure }, { ticks: 36010 });
const machines = JSON.parse(await fs.readFile(path.join(PROJECT, '.cache/vulcanus-science/probe-rates/script-output/probe-machines.json'), 'utf8'));
const out = { schema: 1, gameVersion: p.gameVersion, method: 'scripts/vulcanus-science/production-utility-science/probes/rates.mjs: one arm per rig at the pinned hand size, fed and emptied by script, items moved in one minute after ten seconds; machines fed by chests and never emptied, contents after ten minutes.', bonus: arms.bonus, armsPerMinute: arms.arms, blockedMachines: machines.machines };
if (process.argv.includes('--write')) await fs.writeFile(path.join(HERE, 'rates.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
