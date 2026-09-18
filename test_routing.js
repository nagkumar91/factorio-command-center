function routeToBus(x, startY, targetY) {
  let currentY = startY;
  while (currentY < targetY - 1) {
    if (targetY - 1 - currentY >= 7) {
      console.log(`add('fast-underground-belt', ${x}, ${currentY}, input)`);
      console.log(`add('fast-underground-belt', ${x}, ${currentY + 7}, output)`);
      currentY += 7;
    } else {
      const dist = targetY - 1 - currentY;
      if (dist > 1) {
        console.log(`add('fast-underground-belt', ${x}, ${currentY}, input)`);
        console.log(`add('fast-underground-belt', ${x}, ${currentY + dist}, output)`);
        currentY += dist;
      } else {
        console.log(`add('fast-transport-belt', ${x}, ${currentY})`);
        currentY++;
      }
    }
  }
}
routeToBus(5, 8, 30);
