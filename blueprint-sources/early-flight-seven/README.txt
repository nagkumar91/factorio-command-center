Seven independent raw-input blueprints. Import seven-workshops-book.txt for all seven, or import any numbered file individually.
All use AM1, steel furnaces, yellow belts/undergrounds/splitters, and external electricity. Feed every labeled west inlet with its indicated raw material. No manufactured operating inputs. Red/green science remain together so lab feeds are close.
Outputs: red+green science; red belts; red undergrounds; red splitters; AM2; medium poles; big poles.
Native production test (Factorio 2.1.24, native-report.json, exact SHA-256 of each string): 240 min warm-up, 60 min measured with every inlet on a full yellow belt, 180 min with the output chest full (every inlet must have stopped and no machine may craft in its last 5 min), 10 min settle, 60 min recovery. Measured per minute:
  01-red-green-science.txt: 31 x 52, 6.00/min automation-science-pack, 5.00/min logistic-science-pack
  02-red-belts.txt: 17 x 16, 3.27/min fast-transport-belt
  03-red-undergrounds.txt: 14 x 31, 0.80/min fast-underground-belt
  04-red-splitters.txt: 24 x 34, 0.80/min fast-splitter
  05-assembling-machine-2.txt: 18 x 55, 0.82/min assembling-machine-2
  06-medium-poles.txt: 24 x 19, 3.12/min medium-electric-pole
  07-big-poles.txt: 24 x 19, 1.30/min big-electric-pole
What sets each rate: in 02 to 07 the one iron steel furnace works all the time (37.5 iron ore per minute) while every other machine waits on plates or on its full output; in 01 each cell's science assembler works all the time and the furnaces have spare time.
Version history: the strings published on 2026-11-16 (kept in history/) imported with no working pole wires, so nothing in them was powered; the red + green science string also had its power trunk half a tile off the grid. These versions carry their own pole wires. Rows and columns that held only straight pass-through belts are cut out, and in the science workshop the green cell sits against the red one (the gap held only the broken trunk). Old sizes: 37 x 57, 18 x 16, 14 x 32, 24 x 34, 18 x 60, 25 x 19, 25 x 19.
