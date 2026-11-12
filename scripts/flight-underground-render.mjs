// Render only explicitly planned pairs, resolving geometry from the exact blueprint.
// Dashed paths are schematic underground connections, not surface belt entities.
export function undergroundTunnelSvg(blueprint, pairs = []) {
  const byId = new Map(blueprint.entities.map(e => [e.entity_number, e]));
  return pairs.map(pair => {
    const a = byId.get(pair.inputEntityNumber), b = byId.get(pair.outputEntityNumber);
    if (!a || !b || a.name !== 'fast-underground-belt' || b.name !== a.name || a.type !== 'input' || b.type !== 'output') throw Error('Underground rendering pair does not match blueprint');
    const {x: ax, y: ay} = a.position, {x: bx, y: by} = b.position;
    if (![ax, ay, bx, by].every(Number.isFinite)) throw Error('Invalid underground rendering coordinates');
    return `<path class="underground-tunnel" d="M${ax} ${ay}L${bx} ${by}" fill="none" stroke="#bc8ba6" stroke-width=".12" stroke-dasharray=".25 .3" opacity=".65"><title>Underground connection: entities ${a.entity_number} → ${b.entity_number}</title></path>`;
  }).join('');
}
