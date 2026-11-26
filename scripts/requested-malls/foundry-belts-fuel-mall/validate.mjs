// Native qualification of the foundry belts and fuel mall: the foundry mall's validator and harness, pointed at this
// folder (its lib.mjs, bill.mjs, audit.mjs and scenarios.mjs). Same options as the foundry mall's validate.mjs.
//   node scripts/requested-malls/foundry-belts-fuel-mall/validate.mjs [--explore --scenario fill,fuel:idle ...]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
process.env.FOUNDRY_FAMILY = path.dirname(fileURLToPath(import.meta.url));
await import('../foundry-mall/validate.mjs');
