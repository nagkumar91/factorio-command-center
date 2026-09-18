const fs = require('fs');
const zlib = require('zlib');

let entities = [];
let entity_number = 1;

function addEntity(name, x, y, dir = 0, recipe = null) {
    let ent = { entity_number: entity_number++, name: name, position: { x: x, y: y } };
    if (dir) ent.direction = dir;
    if (recipe) ent.recipe = recipe;
    entities.push(ent);
    return ent;
}

function addCombinator(x, y, item, isFluid = false) {
    let ent = addEntity('constant-combinator', x, y, 2);
    ent.control_behavior = {
        sections: {
            sections: [{
                index: 1,
                filters: [{ index: 1, name: item, type: isFluid ? "fluid" : "item", comparator: "=", count: 1 }]
            }]
        }
    };
}

function addVerticalBelt(x, startY, endY, item) {
    addCombinator(x, startY - 1, item);
    for (let y = startY; y <= endY; y++) {
        addEntity('fast-transport-belt', x, y, 4); // South
    }
}

function addVerticalPipe(x, startY, endY, fluid) {
    addCombinator(x, startY - 1, fluid, true);
    for (let y = startY; y <= endY; y += 2) {
        addEntity('pipe', x, y);
        if (y + 1 <= endY) addEntity('pipe', x, y + 1);
    }
}

// --- Pod 1: Belts ---
let px = 0;
addVerticalBelt(px + 2, 10, 30, 'iron-plate');
addVerticalBelt(px + 3, 10, 30, 'iron-gear-wheel');
addVerticalPipe(px - 2, 10, 30, 'lubricant');

addEntity('assembling-machine-3', px, 15, 0, 'transport-belt');
addEntity('fast-inserter', px + 1, 14, 6); // from +2
addEntity('long-handed-inserter', px + 1, 15, 6); // from +3
addEntity('fast-inserter', px, 17, 4);
addEntity('logistic-chest-passive-provider', px, 18);

addEntity('fast-inserter', px, 19, 4);
addEntity('assembling-machine-3', px, 21, 0, 'fast-transport-belt');
addEntity('long-handed-inserter', px + 1, 21, 6); // from +3
addEntity('fast-inserter', px, 23, 4);
addEntity('logistic-chest-passive-provider', px, 24);

addEntity('fast-inserter', px, 25, 4);
addEntity('assembling-machine-3', px, 27, 0, 'express-transport-belt');
addEntity('long-handed-inserter', px + 1, 27, 6); // from +3
addEntity('pipe', px - 2, 27); // connect lube
addEntity('fast-inserter', px, 29, 4);
addEntity('logistic-chest-passive-provider', px, 30);

// --- Pod 2: Undergrounds ---
px = 10;
addVerticalBelt(px + 2, 10, 30, 'iron-plate');
addVerticalBelt(px + 3, 10, 30, 'iron-gear-wheel');
addVerticalPipe(px - 2, 10, 30, 'lubricant');

addEntity('assembling-machine-3', px, 15, 0, 'underground-belt');
addEntity('fast-inserter', px + 1, 15, 6); // from +2
addEntity('fast-inserter', px, 17, 4);
addEntity('logistic-chest-passive-provider', px, 18);

addEntity('fast-inserter', px, 19, 4);
addEntity('assembling-machine-3', px, 21, 0, 'fast-underground-belt');
addEntity('long-handed-inserter', px + 1, 21, 6); // from +3
addEntity('fast-inserter', px, 23, 4);
addEntity('logistic-chest-passive-provider', px, 24);

addEntity('fast-inserter', px, 25, 4);
addEntity('assembling-machine-3', px, 27, 0, 'express-underground-belt');
addEntity('long-handed-inserter', px + 1, 27, 6); // from +3
addEntity('pipe', px - 2, 27); // connect lube
addEntity('fast-inserter', px, 29, 4);
addEntity('logistic-chest-passive-provider', px, 30);

// --- Pod 3: Splitters ---
px = 20;
addVerticalBelt(px + 2, 10, 30, 'iron-plate');
addVerticalBelt(px + 3, 10, 30, 'electronic-circuit');
addVerticalBelt(px - 2, 10, 30, 'iron-gear-wheel');
addVerticalBelt(px - 3, 10, 30, 'advanced-circuit');
addVerticalPipe(px - 4, 10, 30, 'lubricant');

addEntity('assembling-machine-3', px, 15, 0, 'splitter');
addEntity('fast-inserter', px + 1, 14, 6); // from +2
addEntity('long-handed-inserter', px + 1, 15, 6); // from +3
addEntity('fast-inserter', px, 17, 4);
addEntity('logistic-chest-passive-provider', px, 18);

addEntity('fast-inserter', px, 19, 4);
addEntity('assembling-machine-3', px, 21, 0, 'fast-splitter');
addEntity('fast-inserter', px - 1, 20, 2); // from -2
addEntity('long-handed-inserter', px + 1, 21, 6); // from +3
addEntity('fast-inserter', px, 23, 4);
addEntity('logistic-chest-passive-provider', px, 24);

addEntity('fast-inserter', px, 25, 4);
addEntity('assembling-machine-3', px, 27, 0, 'express-splitter');
addEntity('fast-inserter', px - 1, 26, 2); // from -2
addEntity('long-handed-inserter', px - 1, 27, 2); // from -3
addEntity('pipe', px - 4, 27); // connect lube
addEntity('fast-inserter', px, 29, 4);
addEntity('logistic-chest-passive-provider', px, 30);

// --- Pod 4: Inserters ---
px = 32;
addVerticalBelt(px + 2, 10, 30, 'iron-plate');
addVerticalBelt(px + 3, 10, 30, 'iron-gear-wheel');
addVerticalBelt(px - 2, 10, 30, 'electronic-circuit');
addVerticalBelt(px - 3, 10, 30, 'advanced-circuit');

addEntity('assembling-machine-3', px, 15, 0, 'inserter');
addEntity('fast-inserter', px + 1, 14, 6); // from +2
addEntity('long-handed-inserter', px + 1, 15, 6); // from +3
addEntity('fast-inserter', px - 1, 15, 2); // from -2
addEntity('fast-inserter', px, 17, 4);
addEntity('logistic-chest-passive-provider', px, 18);

addEntity('fast-inserter', px, 19, 4);
addEntity('assembling-machine-3', px, 21, 0, 'fast-inserter');
addEntity('fast-inserter', px + 1, 21, 6); // from +2
addEntity('fast-inserter', px - 1, 21, 2); // from -2
addEntity('fast-inserter', px, 23, 4);
addEntity('logistic-chest-passive-provider', px, 24);

addEntity('fast-inserter', px, 25, 4);
addEntity('assembling-machine-3', px, 27, 0, 'bulk-inserter');
addEntity('long-handed-inserter', px + 1, 27, 6); // from +3
addEntity('fast-inserter', px - 1, 26, 2); // from -2
addEntity('long-handed-inserter', px - 1, 27, 2); // from -3
addEntity('fast-inserter', px, 29, 4);
addEntity('logistic-chest-passive-provider', px, 30);

// Long-handed branch
addEntity('fast-inserter', px + 1, 18, 2); // East from first chest
addEntity('assembling-machine-3', px + 3, 18, 0, 'long-handed-inserter');
addEntity('fast-inserter', px + 3, 20, 4);
addEntity('logistic-chest-passive-provider', px + 3, 21);
addEntity('fast-inserter', px + 2, 17, 2); // from px+2
addEntity('fast-inserter', px + 3, 16, 4); // from px+3

// --- Pod 5: Power ---
px = 44;
addVerticalBelt(px + 2, 10, 30, 'steel-plate');
addVerticalBelt(px + 3, 10, 30, 'copper-plate');
addVerticalBelt(px - 2, 10, 30, 'advanced-circuit');

addEntity('assembling-machine-3', px, 15, 0, 'medium-electric-pole');
addEntity('fast-inserter', px + 1, 14, 6); // from +2
addEntity('long-handed-inserter', px + 1, 15, 6); // from +3
addEntity('fast-inserter', px, 17, 4);
addEntity('logistic-chest-passive-provider', px, 18);

addEntity('assembling-machine-3', px, 21, 0, 'big-electric-pole');
addEntity('fast-inserter', px + 1, 20, 6); // from +2
addEntity('long-handed-inserter', px + 1, 21, 6); // from +3
addEntity('fast-inserter', px, 23, 4);
addEntity('logistic-chest-passive-provider', px, 24);

addEntity('assembling-machine-3', px, 27, 0, 'substation');
addEntity('fast-inserter', px + 1, 26, 6); // from +2
addEntity('long-handed-inserter', px + 1, 27, 6); // from +3
addEntity('fast-inserter', px - 1, 27, 2); // from -2
addEntity('fast-inserter', px, 29, 4);
addEntity('logistic-chest-passive-provider', px, 30);

// --- Pod 6: Fluids ---
px = 54;
addVerticalBelt(px + 2, 10, 30, 'iron-plate');
addVerticalBelt(px + 3, 10, 30, 'steel-plate');

addEntity('assembling-machine-3', px, 15, 0, 'pipe');
addEntity('fast-inserter', px + 1, 15, 6); // from +2
addEntity('fast-inserter', px, 17, 4);
addEntity('logistic-chest-passive-provider', px, 18);

addEntity('fast-inserter', px, 19, 4);
addEntity('assembling-machine-3', px, 21, 0, 'pipe-to-ground');
addEntity('fast-inserter', px + 1, 21, 6); // from +2
addEntity('fast-inserter', px, 23, 4);
addEntity('logistic-chest-passive-provider', px, 24);

addEntity('assembling-machine-3', px, 27, 0, 'storage-tank');
addEntity('fast-inserter', px + 1, 26, 6); // from +2
addEntity('long-handed-inserter', px + 1, 27, 6); // from +3
addEntity('fast-inserter', px, 29, 4);
addEntity('logistic-chest-passive-provider', px, 30);

// --- Pod 7: Bots ---
px = 64;
addVerticalBelt(px + 2, 10, 30, 'steel-plate');
addVerticalBelt(px + 3, 10, 30, 'battery');
addVerticalBelt(px - 2, 10, 30, 'electronic-circuit');
addVerticalBelt(px - 3, 10, 30, 'electric-engine-unit');
addVerticalBelt(px - 4, 10, 30, 'advanced-circuit');

addEntity('assembling-machine-3', px, 15, 0, 'flying-robot-frame');
addEntity('fast-inserter', px + 1, 14, 6); // from +2
addEntity('long-handed-inserter', px + 1, 15, 6); // from +3
addEntity('fast-inserter', px - 1, 14, 2); // from -2
addEntity('long-handed-inserter', px - 1, 15, 2); // from -3
addEntity('fast-inserter', px, 17, 4);
addEntity('logistic-chest-passive-provider', px, 18);

// Logistic Robot
addEntity('fast-inserter', px - 1, 18, 6); // West from chest
addEntity('assembling-machine-3', px - 3, 18, 0, 'logistic-robot');
addEntity('fast-inserter', px - 3, 20, 4);
addEntity('logistic-chest-passive-provider', px - 3, 21);
addEntity('fast-inserter', px - 4, 18, 2); // from -4 (advanced circuit)

// Construction Robot
addEntity('fast-inserter', px + 1, 18, 2); // East from chest
addEntity('assembling-machine-3', px + 3, 18, 0, 'construction-robot');
addEntity('fast-inserter', px + 3, 20, 4);
addEntity('logistic-chest-passive-provider', px + 3, 21);
addVerticalBelt(px + 5, 10, 20, 'electronic-circuit');
addEntity('fast-inserter', px + 4, 18, 6); // from +5

// --- Pod 8: Misc ---
px = 76;
addVerticalBelt(px + 2, 10, 20, 'iron-plate');
addVerticalBelt(px + 3, 10, 20, 'copper-cable');
addVerticalBelt(px - 2, 10, 20, 'electronic-circuit');

addEntity('assembling-machine-3', px, 15, 0, 'small-lamp');
addEntity('fast-inserter', px + 1, 14, 6); // from +2
addEntity('long-handed-inserter', px + 1, 15, 6); // from +3
addEntity('fast-inserter', px - 1, 15, 2); // from -2
addEntity('fast-inserter', px, 17, 4);
addEntity('logistic-chest-passive-provider', px, 18);

// --- Foundries & Chemical Plants (Top Zone) ---
let fx = 0;
addEntity('foundry', fx, -10, 0, 'iron-plate');
addEntity('foundry', fx + 10, -10, 0, 'iron-gear-wheel');
addEntity('foundry', fx + 20, -10, 0, 'steel-plate');
addEntity('foundry', fx + 30, -10, 0, 'copper-plate');
addEntity('foundry', fx + 40, -10, 0, 'copper-cable');

addEntity('oil-refinery', fx + 50, -10, 0, 'advanced-oil-processing');
addEntity('chemical-plant', fx + 60, -10, 0, 'plastic-bar');
addEntity('chemical-plant', fx + 70, -10, 0, 'sulfur');
addEntity('chemical-plant', fx + 80, -10, 0, 'sulfuric-acid');
addEntity('chemical-plant', fx + 90, -10, 0, 'lubricant');
addEntity('chemical-plant', fx + 100, -10, 0, 'battery');

addEntity('assembling-machine-3', fx + 10, -2, 0, 'electronic-circuit');
addEntity('assembling-machine-3', fx + 20, -2, 0, 'advanced-circuit');
addEntity('assembling-machine-3', fx + 30, -2, 0, 'engine-unit');
addEntity('assembling-machine-3', fx + 40, -2, 0, 'electric-engine-unit');

const blueprint = {
    blueprint: {
        icons: [
            { signal: { type: "item", name: "fast-transport-belt" }, index: 1 },
            { signal: { type: "item", name: "fast-inserter" }, index: 2 }
        ],
        entities: entities,
        item: "blueprint",
        version: 562949953421312
    }
};

const jsonStr = JSON.stringify(blueprint);
const compressed = zlib.deflateSync(jsonStr);
const base64 = Buffer.from(compressed).toString('base64');
const finalString = '0' + base64;

fs.writeFileSync('./mall/mall_blueprint.txt', finalString);
console.log("Blueprint generated successfully at mall/mall_blueprint.txt");
