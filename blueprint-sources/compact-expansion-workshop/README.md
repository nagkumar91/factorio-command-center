# Compact expansion workshop

14 assembling machine 2s, no modules. Supply **iron plates, copper plates, steel plates, stone bricks and plastic bars** on the five labeled west entrances, plus external electricity at P. Each feed has one entrance; iron has two admission arms behind that entrance.

Collect **fast inserters (blue), fast transport belts (red), fast underground belts, fast splitters and electric furnaces** from five individual passive-provider chests on the east side. Each chest is limited to one stack. The blueprint makes all gears, copper cable, green/red circuits and yellow transport components internally. It needs no fluids or raw-ore smelting.

Three machine rows share one stock-controlled red-belt loop. The middle row outputs onto the return belt. Both copper-cable assemblers have two output arms; advanced circuits get cable before green circuits. Three arithmetic combinators assign transport ingredient pickups alternating ten-second windows, preventing underground-belt gears from monopolizing the shared production. Keep all filters, red wires, the whole-belt reader, stock limits and chest bars.

This is a compact on-demand building mall. Its measured simultaneous delivery rates are in `native-report.json` and the workshop page. Saturated outputs stop independently, freeing shared intermediates for other products. Stock-limited circulating finished goods consume some loop capacity while an output is blocked. The native test checks all five outputs and every recipe from empty external belt feeds, plus recovery after five minutes with output chests deliberately filled. No machine inputs are seeded. The source report identifies the exact published blueprint SHA-256 and native game version. Earlier development candidates and their failing reports remain in `history/` rather than being promoted.

Research all production recipes and construction equipment before building: Automation 2, Logistics 2, Fast inserters, Advanced electronics, Advanced material processing 2, Circuit network, Electric energy distribution 1 and Logistic robotics for the passive providers, with their prerequisite technologies. Ordinary belts and inserters supply the workshop; requester chests and the Logistic system technology are not required.

Reproduce with a private vanilla Factorio 2.1.24 Space Age raw prototype dump: `FACTORIO_RAW=/absolute/path/to/data-raw-dump.json node scripts/compact-expansion-workshop/generate.mjs`, then `node scripts/compact-expansion-workshop/validate.mjs`, then `node scripts/compact-expansion-workshop/preview.mjs`. The private native profile and temporary saves live only in `.cache/compact-expansion-workshop/`; none of the user's saves or running game configuration is modified.

Origin: original layout derived from the Command Center's controlled-loop science/transport design, using a denser inside-row placement. It is not a proof of a global minimum; footprint, construction count and delivered rates are reported directly.

## Accepted density improvement

The qualified 13-machine revision is preserved under `history/v3-qualified-13-machines/`. A second cable assembler and repacked clock occupy previously unused space, keeping the complete 24 × 15 footprint and 59 red belts. In the same declared-feed/native measurement protocol, simultaneous outputs improved from 6.5 / 5.4 / 1.2 / 1.1 / 1.5 per minute to 8.4 / 5.7 / 1.6 / 1.4 / 1.5 (fast inserters / red belts / red undergrounds / red splitters / electric furnaces). These figures are measured shared-workshop output, not individual recipe capacity.
