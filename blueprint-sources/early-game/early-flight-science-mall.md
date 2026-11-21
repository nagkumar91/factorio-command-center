# Early Flight science and red-belt mall

Blueprint import string: [`early-flight-science-mall.txt`](early-flight-science-mall.txt)

One narrow stamp composes eight raw-input cells from the Early Game library:

- Automation and logistic science packs, with their output chests on the same row for lab feeds.
- Fast (red) transport belt, fast underground belt and fast splitter.
- Assembling machine 2, medium electric pole and big electric pole.

The cells use assembling machine 1, steel furnaces, yellow belts, yellow underground belts and yellow splitters. No modules are installed. Steel furnaces use the coal feed. Raw operating inputs are iron ore, copper ore and coal; power is external. Each labeled inlet is on the west edge. Several cells have their own labeled inlet for the same raw resource, so feed every matching inlet. A short set of yellow belts carries the logistic-science feeds from the west edge.

Connect external power to the big pole beside the top `P` panel. The pole wires in the string connect every production cell. Each output chest stands just east of its product assembler and is limited to one stack; empty them or belt the products out to resume crafting. Display panels can be skipped until Circuit network is researched.

Build the complete stamp after researching Automation, Logistics, Automation 2, Logistics 2, Advanced material processing, and Electric energy distribution 1. Earlier in the run, place only the ghosts for entities already unlocked.

## Size and composition

The blueprint covers 32 × 235 tiles (7520 tiles). The cells are stacked directly below one another (no cell's inserters, belts or undergrounds reach into another) and do not share smelters or intermediate-production machines. The two science outputs sit on the same row, 16 tiles apart. The other six finished-item chests are in columns 8 to 10 from the west edge, each just east of its own cell's product assembler.

It contains 32 assembling machine 1s, 17 steel furnaces, 1357 yellow belts, 152 underground-belt endpoints, 30 yellow splitters, 142 inserters and 8 one-stack wooden output chests. Power is 9 big and 53 medium electric poles joined by 61 copper wires in the string (one big pole only links cells that are out of wire reach of each other). The blueprint has 22 labeled raw-material inlets across the independent cells.

## Native test

This exact string (SHA-256 `47a21a9d2b512160…`) passed a native Factorio 2.1.24 production test ([report](early-flight-science-mall-native-report.json)): 240 minutes of warm-up, 60 minutes measured with every inlet on a full yellow belt, then 180 minutes with every output chest full (every inlet must stop and no machine may craft in the last 5), 10 minutes to settle and 60 minutes of recovery. Measured per minute:

- assembling machine 2: 0.82 (after the blocked hold 0.82)
- automation science: 6.00 (after the blocked hold 6.00)
- big electric pole: 1.30 (after the blocked hold 1.28)
- fast splitter: 0.80 (after the blocked hold 0.82)
- fast transport belt: 3.27 (after the blocked hold 3.27)
- fast underground belt: 0.77 (after the blocked hold 0.77)
- logistic science: 5.00 (after the blocked hold 5.00)
- medium electric pole: 3.12 (after the blocked hold 3.38)

In each science cell the science assembler works all the time and sets the rate; in each item cell the one iron furnace works all the time (37.5 iron ore per minute) and every other machine waits on plates or on its full output.

## Version history

The string published on 2026-11-16 (kept in [`history/unwired-tall-b5051d53/`](history/unwired-tall-b5051d53/)) imported unpowered: it had no 2.0 pole wires, and its 23 power-trunk big poles and its P panel were half a tile off the tile grid, so the game moved them and the top one landed on an inlet belt. It covered 37 × 277 tiles (10249). This version keeps every production entity of every cell where it was inside its cell (only the logistic-science feed belts are 5 tiles shorter), carries its own pole wires, stacks the cells directly below one another instead of six or seven empty rows apart and moves the logistic-science cell 5 tiles west beside the automation cell, so it covers 27% fewer tiles.
