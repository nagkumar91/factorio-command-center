// Lane feeds: build the west end of an east-facing belt so that each lane
// receives exactly one material. A side-load needs a straight target belt
// (a stub behind it); a curve keeps both lanes of its feeder.
import {N, E, S, W} from './grid.mjs';

// Straight run of an east-facing lane belt from xs to xe on row y, with the
// west end built according to `mode`:
//   'north+south'  stub xs, target xs+1; north lane from above, south lane from below
//   'south-curve'  south lane: curve from a southbound feeder whose west lane is loaded at (xs, y-2);
//                  north lane: side-load from above at xs+1
//   'south-curve-short' as 'south-curve' without the drop tile (stub at y-2, target at y-1)
//   'north-curve'  north lane: curve from a northbound feeder whose west lane is loaded at (xs, y+2);
//                  south lane: side-load from below at xs+1
// Returns feed points {item, entry, approach, lane}.
export function laneBelt(L, id, xs, xe, y, lanes, mode = 'north+south', tags = {}, gaps = []) {
  const t = extra => ({tags: {block: id, ...tags, ...extra}});
  const feeds = [];
  if (mode === 'north+south') {
    L.belt(xs, y, E, t({lane: 'stub'}));
    const target = L.belt(xs + 1, y, E, t({lane: 'target'}));
    if (lanes.north) feeds.push({item: lanes.north, entry: target, approach: S, lane: 'north', block: id});
    if (lanes.south) feeds.push({item: lanes.south, entry: target, approach: N, lane: 'south', block: id});
  } else if (mode === 'south-curve') {
    L.belt(xs, y - 3, S, t({lane: 'stub'}));
    const target = L.belt(xs, y - 2, S, t({lane: 'target'}));
    L.belt(xs, y - 1, S, t({lane: 'drop'}));
    L.belt(xs, y, E, t({lane: 'curve'}));
    const second = L.belt(xs + 1, y, E, t({lane: 'target'}));
    feeds.push({item: lanes.south, entry: target, approach: E, lane: 'south', block: id});
    if (lanes.north) feeds.push({item: lanes.north, entry: second, approach: S, lane: 'north', block: id});
  } else if (mode === 'south-curve-short') {
    L.belt(xs, y - 2, S, t({lane: 'stub'}));
    const target = L.belt(xs, y - 1, S, t({lane: 'target'}));
    L.belt(xs, y, E, t({lane: 'curve'}));
    const second = L.belt(xs + 1, y, E, t({lane: 'target'}));
    feeds.push({item: lanes.south, entry: target, approach: E, lane: 'south', block: id});
    if (lanes.north) feeds.push({item: lanes.north, entry: second, approach: S, lane: 'north', block: id});
  } else if (mode === 'north-curve') {
    L.belt(xs, y + 3, N, t({lane: 'stub'}));
    const target = L.belt(xs, y + 2, N, t({lane: 'target'}));
    L.belt(xs, y + 1, N, t({lane: 'drop'}));
    L.belt(xs, y, E, t({lane: 'curve'}));
    const second = L.belt(xs + 1, y, E, t({lane: 'target'}));
    feeds.push({item: lanes.north, entry: target, approach: E, lane: 'north', block: id});
    if (lanes.south) feeds.push({item: lanes.south, entry: second, approach: N, lane: 'south', block: id});
  } else throw Error('mode ' + mode);
  // Gaps: two tiles (g, g+1) left open for a substation; the belt passes underneath.
  const skip = new Set(gaps.flatMap(g => [g, g + 1]));
  for (let x = xs + 2; x <= xe; x++) {
    if (skip.has(x)) continue;
    if (gaps.includes(x + 1)) L.underground(x, y, E, 'input', t({lane: 'gap'}));
    else if (gaps.includes(x - 2)) L.underground(x, y, E, 'output', t({lane: 'gap'}));
    else L.belt(x, y, E, t({lane: 'run'}));
  }
  return feeds;
}
