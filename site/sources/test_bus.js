const verticalBelts = [
  { x: 5, startY: 8, targetY: 12 }, // Iron
  { x: 15, startY: 8, targetY: 13 }, // Gear
  { x: 25, startY: 8, targetY: 14 }, // Steel
  { x: 35, startY: 8, targetY: 15 }, // Copper
  { x: 45, startY: 8, targetY: 16 }, // Copper cable
  { x: 55, startY: 8, targetY: 17 }, // Pipe
  { x: 105, startY: 9, targetY: 18 }, // Plastic
  { x: 114, startY: 9, targetY: 19 }, // Battery
  { x: 125, startY: 9, targetY: 20 }, // EC
  { x: 138, startY: 5, targetY: 21 }  // AC
];

function crosses(x, y) {
  return verticalBelts.some(vb => vb.x === x && y > vb.startY && y < vb.targetY);
}

function drawBusLane(y, startX, endX) {
  let x = startX;
  while (x <= endX) {
    if (crosses(x + 1, y)) {
      console.log(`add('fast-underground-belt', ${x}, ${y}, input)`);
      let jumpEnd = x + 1;
      while (crosses(jumpEnd + 1, y)) {
        jumpEnd++;
      }
      console.log(`add('fast-underground-belt', ${jumpEnd + 1}, ${y}, output)`);
      x = jumpEnd + 2;
    } else {
      console.log(`add('fast-transport-belt', ${x}, ${y})`);
      x++;
    }
  }
}

drawBusLane(12, 5, 20);
