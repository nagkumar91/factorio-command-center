// Native qualification of productivity-module-supply (see ../electric-furnace-supply/qualify.mjs for the protocol and pass rules).
// Usage: node scripts/flight-science-sided/heavy-supplies/productivity-module-supply/validate.mjs   (HEAVY_EXPLORE=1 for a short trial)
import {qualify} from '../electric-furnace-supply/qualify.mjs';
const report=await qualify('productivity-module-supply');
process.exitCode=report.passed?0:1;
