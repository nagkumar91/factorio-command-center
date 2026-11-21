# Compact expansion workshop

21 × 15 tiles (315), 14 assembling machine 2s, no modules. Supply **iron plates, copper plates, steel plates, stone bricks and plastic bars** on the five west entrances, top to bottom in that order, plus external electricity at P. Each feed has one entrance belt tile; the iron entrance turns south so both iron admission arms share it. The five input labels stand in a column above the entrances (IN 1 at the top), the five output labels in a column above the chests (OUT 1 at the top).

Collect **fast inserters (blue), fast transport belts (red), fast underground belts, fast splitters and electric furnaces** from five individual passive-provider chests on the east side. Each chest is limited to one stack. The blueprint makes all gears, copper cable, green/red circuits and yellow transport components internally. It needs no fluids or raw-ore smelting.

Three machine rows share one stock-controlled red-belt loop. The middle row outputs onto the return belt. Both copper-cable assemblers have two output arms; advanced circuits get cable before green circuits. Three arithmetic combinators assign transport ingredient pickups alternating ten-second windows, preventing underground-belt gears from monopolizing the shared production. Keep all filters, red wires, the whole-belt reader, stock limits and chest bars. The ring stock limits sum to 148 items, under 85% of one lane of the 44-tile ring.

This is a compact on-demand building mall. Its measured simultaneous delivery rates are in `native-report.json` and the workshop page: 9.85 fast inserters, 5.78 fast transport belts, 1.5 fast underground belts, 1.33 fast splitters and 1.5 electric furnaces a minute over one hour (30-minute recovery after full storage: 9.93 / 5.77 / 1.53 / 1.37 / 1.5). Fast underground belts are limited mainly by their third of the transport clock and electric furnaces by the single advanced-circuit assembler (busy about 99% of the time); fast inserters, fast transport belts and fast splitters share the one gear assembler (busy about 94%). Saturated outputs stop independently, freeing shared intermediates for other products. Stock-limited circulating finished goods consume some loop capacity while an output is blocked. The native test checks all five outputs and every recipe from empty external belt feeds, plus recovery after five minutes with output chests deliberately filled. Since 21 November the steady window is one hour and the recovery window 30 minutes (10-minute warmup, 5-minute block and 5-minute settle unchanged); the earlier 10-minute windows could not tell 1.4 from 1.6 for the slow products. No machine inputs are seeded. The source report identifies the exact published blueprint SHA-256 and native game version. Earlier development candidates and their failing reports remain in `history/` rather than being promoted.

Research all production recipes and construction equipment before building: Automation 2, Logistics 2, Fast inserters, Advanced electronics, Advanced material processing 2, Circuit network, Electric energy distribution 1 and Logistic robotics for the passive providers, with their prerequisite technologies. Ordinary belts and inserters supply the workshop; requester chests and the Logistic system technology are not required.

Reproduce with a private vanilla Factorio 2.1.24 Space Age raw prototype dump: `FACTORIO_RAW=/absolute/path/to/data-raw-dump.json node scripts/compact-expansion-workshop/generate.mjs`, then `node scripts/compact-expansion-workshop/validate.mjs`, then `node scripts/compact-expansion-workshop/preview.mjs`. The private native profile and temporary saves live only in `.cache/compact-expansion-workshop/`; none of the user's saves or running game configuration is modified.

Origin: original layout derived from the Command Center's controlled-loop science/transport design, using a denser inside-row placement. It is not a proof of a global minimum; footprint, construction count and delivered rates are reported directly.

## Accepted density improvement

The qualified 13-machine revision is preserved under `history/v3-qualified-13-machines/`. A second cable assembler and repacked clock occupy previously unused space, keeping the complete 24 × 15 footprint and 59 red belts. In the same declared-feed/native measurement protocol, simultaneous outputs improved from 6.5 / 5.4 / 1.2 / 1.1 / 1.5 per minute to 8.4 / 5.7 / 1.6 / 1.4 / 1.5 (fast inserters / red belts / red undergrounds / red splitters / electric furnaces). These figures are measured shared-workshop output, not individual recipe capacity.

Those were 10-minute figures for the 24 × 15 version, now preserved under `history/wide-ring-04b0f44a/` (see the next section).

## Smaller ring (21 November)

The 24 × 15 (360-tile) version is preserved under `history/wide-ring-04b0f44a/`, with its original 10-minute report and `native-report-one-hour.json`, the same string under the one-hour protocol. The ring is now two columns shorter (44 belts instead of 48), the machines sit one column further west, each entrance is one belt tile instead of two, and the labels moved from inside the ring to the two label columns. That is 315 tiles (12.5% fewer) and 50 red belts instead of 59; machines, inserters, poles, combinators and chests are unchanged. Because the shorter ring changes how the shared gears and circuits are split, seven ring limits changed: gears 16 to 28, copper cable 24 to 22, iron plates 40 to 29, and the circulating finished fast inserters, fast transport belts and fast underground belts 4 to 2 and electric furnaces 2 to 1.

Same one-hour protocol, per minute (fast inserters / fast transport belts / fast underground belts / fast splitters / electric furnaces):

| Version | Steady, 60 min | Recovery, 30 min |
| --- | --- | --- |
| 24 × 15, SHA 04b0f44a | 9.07 / 5.35 / 1.5 / 1.32 / 1.5 | 9.23 / 5.63 / 1.47 / 1.23 / 1.5 |
| 21 × 15, current | 9.85 / 5.78 / 1.5 / 1.33 / 1.5 | 9.93 / 5.77 / 1.53 / 1.37 / 1.5 |

Over a three-hour window the old version gave 9.13 / 5.4 / 1.5 / 1.29 / 1.5 and the new one 9.82 / 5.81 / 1.5 / 1.34 / 1.5. A 30-minute deliberate output block followed by recovery also passes (recovery 10.13 / 5.7 / 1.53 / 1.33 / 1.5). Under the old 10-minute protocol the new string also passes (9.8 / 6.2 / 1.4 / 1.3 / 1.5).
