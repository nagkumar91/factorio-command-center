# White-pack receiver · landing pad to chest

**Status: qualified.** It was qualified by the white-platform end-to-end run, together with the published platform (`blueprint-sources/white-platform/`). The harness built the real platform in Nauvis orbit and this receiver on Nauvis, and packs travelled down by the game's own cargo pods with no scripted transfer. `native-report.json` here is the same report as the platform's and records both SHA-256 values. Receiver string SHA-256: `00456afec81e22b0e1201e6780fe04c27634a2f77dbbd723d2448e86a17e87ae`.

A tiny ground blueprint with four entities:

- one cargo landing pad that already requests 1,000 space science packs;
- one fast inserter;
- one passive provider chest limited to 10 stacks (2,000 packs);
- one substation.

Build it on Nauvis under a platform that holds packs, and the platform drops a cargo pod every 30 seconds carrying whatever the pad still lacks. You do not need to click anything. The request travels in the blueprint string.

It crafts nothing (`products: []`, `targets: {}`). It delivers space science packs, and the end-to-end run measures them against 60 per minute.

## Layout

Footprint 10 x 8 = 80 tiles, which meets the goal (fallback 96).

- pad on tiles x -4..3, y -4..3;
- fast inserter at tile (4, -1), picking from the pad on its west and dropping east (hand 1, no filter);
- passive provider chest at tile (5, -1), with `bar` 10. This is the declared output, on the east side, with nothing on the three tiles east of it;
- substation on tiles (4..5, 0..1). Supply electricity here (the `power` port).

There is no belt or fluid entrance, so there is no display panel.

## Caps

| Stage | Setting | Value |
| --- | --- | ---: |
| Landing pad request | space science pack, minimum | 1,000 |
| Output chest | bar 10 (10 stacks of 200) | 2,000 |
| Platform hub (the platform's own cap) | science stops at | 2,000 |

When nobody takes packs from the chest, it fills to exactly 2,000 and stops. The pad then fills to its 1,000 and pods stop. The platform hub fills to its cap and its science machines stop. When robots take packs again, everything resumes by itself. The request count is a buffer, not a rate: lowering it does not slow delivery.

## Measured (`native-report.json`, map seed 12345)

| Check | Result |
| --- | --- |
| Import (ghosts revived): geometry, arm hand 1, chest bar (game value 11 = first blocked slot), three clear tiles east, one power network with the arm powered | passed |
| Pad request read back from the built pad | one active section: space science pack, minimum 1,000 |
| Cargo landing pads | limit 1 per planet; this is the only one on Nauvis |
| First pod after the platform finished building | 67 s (limit 5 min) |
| Packs collected from the chest, 120-minute measurement | 60.00 per minute (floor 57) |
| Packs collected, last 45 minutes of recovery | 96.3 per minute (includes the backlog draining from pad and hub) |
| Blocked phase (chest not emptied for 105 min) | chest ends at exactly 2,000 and never above; pad ends at 1,000 |
| Feed policy | no scripted transfer: packs leave the hub only in the game's own cargo pods; the harness only empties the chest, once per second, outside the blocked phase |

One fast inserter is plenty: the planner measured 150 packs per minute through one arm from pad to chest.

## Setup notes

- **One landing pad per planet.** A force may have only one cargo landing pad on Nauvis. In a save that already has one, this blueprint's pad cannot be built. Instead, add a request for 1,000 space science packs to your existing pad, and build only the inserter, chest and substation next to it.
- Robots taking packs from the passive provider chest are the only consumer the blueprint knows about. If you want the packs on a belt, replace the chest with a belt yourself; that variant was not qualified in this round.
- It links to `white-platform`. Any platform in Nauvis orbit holding space science packs supplies the pad.

Bill of materials: 1 cargo landing pad, 1 fast inserter, 1 passive provider chest, 1 substation. All four are kit items.

## Reproduce

```
node scripts/white-pack-receiver/generate.mjs
node scripts/white-pack-receiver/validate.mjs   # runs the white-platform end-to-end harness, then checks this report
node scripts/white-platform/generate.mjs && node scripts/white-pack-receiver/generate.mjs
node --test tests/white-pack-receiver.test.mjs
```

The harness is `scripts/white-platform/control.lua` and `validate.mjs`; this folder's `validate.mjs` is a thin wrapper around them.
