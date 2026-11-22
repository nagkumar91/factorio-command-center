// Native qualification of electric-furnace-supply (see ../electric-furnace-supply/qualify.mjs for the protocol and pass rules).
// Usage: node scripts/flight-science-sided/heavy-supplies/electric-furnace-supply/validate.mjs   (HEAVY_EXPLORE=1 for a short trial)
import {qualify} from '../electric-furnace-supply/qualify.mjs';
const report=await qualify('electric-furnace-supply');
process.exitCode=report.passed?0:1;
