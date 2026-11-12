const mirrorDirection = direction => direction === 0 ? 8 : direction === 8 ? 0 : direction;
const mirrorGrid = grid => grid ? { ...grid, y: -grid.y } : grid;
const mirrorPosition = position => position ? { ...position, y: 1 - position.y } : position;
const mirrorArm = arm => arm ? { ...arm, grid: mirrorGrid(arm.grid), pickup: mirrorGrid(arm.pickup), drop: mirrorGrid(arm.drop), direction: mirrorDirection(arm.direction) } : arm;
const mirrorDescriptor = belt => belt ? { ...belt, grid: mirrorGrid(belt.grid), position: mirrorPosition(belt.position), direction: mirrorDirection(belt.direction) } : belt;
export const mirrorBlock = original => {
  const block = JSON.parse(JSON.stringify(original));
  block.mirrored = true;
  block.entities = block.entities.map(entity => ({ ...entity, position: mirrorPosition(entity.position), direction: mirrorDirection(entity.direction) }));
  block.belts = block.belts.map(mirrorDescriptor);
  block.rows = block.rows.map(row => ({
    ...row,
    row: -row.row,
    machine: {
      ...row.machine,
      centre: mirrorPosition(row.machine.centre),
      inputArms: row.machine.inputArms.map(mirrorArm),
      outputArms: row.machine.outputArms.map(mirrorArm), outputTransferArms: row.machine.outputTransferArms?.map(mirrorArm)
    },
    output: row.output ? {
      ...row.output,
      gridY: -row.output.gridY,
      horizontal: row.output.horizontal.map(mirrorDescriptor),
      tunnel: row.output.tunnel ? { ...row.output.tunnel, input: mirrorDescriptor(row.output.tunnel.input), output: mirrorDescriptor(row.output.tunnel.output) } : null,
      sideLoad: row.output.sideLoad ? { ...row.output.sideLoad, from: mirrorGrid(row.output.sideLoad.from), to: mirrorGrid(row.output.sideLoad.to), direction: mirrorDirection(row.output.sideLoad.direction) } : row.output.sideLoad
    } : row.output
  }));
  block.inputs = block.inputs.map(input => ({
    ...input,
    routeTarget: {
      ...input.routeTarget,
      grid: mirrorGrid(input.routeTarget.grid),
      direction: mirrorDirection(input.routeTarget.direction),
      sideLoad: input.routeTarget.sideLoad ? { ...input.routeTarget.sideLoad, grid: mirrorGrid(input.routeTarget.sideLoad.grid), direction: mirrorDirection(input.routeTarget.sideLoad.direction) } : input.routeTarget.sideLoad
    }
  }));
  block.outputs = {
    ...block.outputs,
    collector: { ...block.outputs.collector, top: -block.outputs.collector.bottom, bottom: -block.outputs.collector.top },
    producerPort: { ...block.outputs.producerPort, grid: mirrorGrid(block.outputs.producerPort.grid), direction: mirrorDirection(block.outputs.producerPort.direction) }
  };
  block.footprint = { ...block.footprint, top: -original.footprint.bottom, bottom: -original.footprint.top };
  if (block.constraints?.portClearances) block.constraints = { ...block.constraints, portClearances: block.constraints.portClearances.map(port => ({ ...port, routeTarget: mirrorGrid(port.routeTarget), sideLoad: mirrorGrid(port.sideLoad) })) };
  return block;
};
