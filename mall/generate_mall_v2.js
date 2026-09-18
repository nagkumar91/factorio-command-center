const fs = require('fs');
const zlib = require('zlib');

let spatialGrid = new Map();
let entities = [];
let entity_number = 1;

function place(name, x, y, dir = 0, recipe = null, extra = {}) {
    let ent = { entity_number: entity_number++, name, position: {x, y}, direction: dir };
    if (recipe) ent.recipe = recipe;
    Object.assign(ent, extra);
    
    if (['fast-transport-belt', 'pipe', 'fast-underground-belt'].includes(name)) {
        spatialGrid.set(`${x},${y}`, ent);
    } else {
        entities.push(ent);
    }
    return ent;
}

function placeSplitter(x, topY) {
    let ent = { entity_number: entity_number++, name: 'fast-splitter', position: {x: x, y: topY + 0.5}, direction: 2 };
    spatialGrid.set(`${x},${topY}`, ent);
    spatialGrid.set(`${x},${topY+1}`, ent);
}

function removeSpatial(x, y) {
    spatialGrid.delete(`${x},${y}`);
}

const BUS_LANES = {
    'iron-plate': 0,
    'iron-gear-wheel': 1,
    'steel-plate': 2,
    'copper-plate': 3,
    'copper-cable': 4,
    'electronic-circuit': 5,
    'advanced-circuit': 6,
    'battery': 7,
    'engine-unit': 8,
    'electric-engine-unit': 9
};
const FLUID_LANES = {
    'lubricant': 10,
    'sulfuric-acid': 11
};

// Draw Bus
for (let x = -10; x <= 130; x++) {
    for (let lane in BUS_LANES) {
        place('fast-transport-belt', x, BUS_LANES[lane], 2);
    }
    for (let lane in FLUID_LANES) {
        place('pipe', x, FLUID_LANES[lane]);
    }
}

// Bus Heads (Requester Chests)
for (let item in BUS_LANES) {
    let y = BUS_LANES[item];
    let req = place('logistic-chest-requester', -7, y);
    req.control_behavior = {
        logistic_parameters: {
            request_filters: [{index: 1, name: item, count: 200}]
        }
    };
    place('fast-inserter', -6, y, 2); // East onto bus
}

function routeBelt(startX, startY, endX, endY, bendY) {
    let currY = startY + 1;
    while (currY < bendY) {
        place('fast-transport-belt', startX, currY, 4);
        currY++;
    }
    let step = startX < endX ? 1 : -1;
    let dir = startX < endX ? 2 : 6;
    let currX = startX;
    if (startX !== endX) {
        while (currX !== endX) {
            place('fast-transport-belt', currX, currY, dir);
            currX += step;
        }
    }
    place('fast-transport-belt', endX, currY, 4);
    currY++;
    while (currY <= endY) {
        place('fast-transport-belt', endX, currY, 4);
        currY++;
    }
}

function tapBus(tapX, item, targetX, targetY, bendY) {
    if (BUS_LANES[item] !== undefined) {
        let L = BUS_LANES[item];
        
        removeSpatial(tapX, L);
        removeSpatial(tapX, L+1);
        removeSpatial(tapX+1, L+1);
        
        placeSplitter(tapX, L);
        
        removeSpatial(tapX-1, L+1);
        removeSpatial(tapX+2, L+1);
        place('fast-underground-belt', tapX-1, L+1, 2, null, {type: 'input'});
        place('fast-underground-belt', tapX+2, L+1, 2, null, {type: 'output'});
        
        place('fast-underground-belt', tapX+1, L+1, 4, null, {type: 'input'});
        place('fast-underground-belt', tapX+1, 12, 4, null, {type: 'output'});
        
        for (let otherL = L+2; otherL <= 9; otherL++) {
            removeSpatial(tapX, otherL);
            removeSpatial(tapX+1, otherL);
            removeSpatial(tapX+2, otherL);
            place('fast-underground-belt', tapX, otherL, 2, null, {type: 'input'});
            place('fast-underground-belt', tapX+2, otherL, 2, null, {type: 'output'});
        }
        
        routeBelt(tapX+1, 12, targetX, targetY, bendY);
    } else if (FLUID_LANES[item] !== undefined) {
        let L = FLUID_LANES[item];
        place('pipe', tapX, L);
        for(let y = L+1; y <= bendY; y++) {
            place('pipe', tapX, y);
        }
        let step = tapX < targetX ? 1 : -1;
        if (tapX !== targetX) {
            for(let currX = tapX; currX !== targetX; currX += step) {
                place('pipe', currX, bendY);
            }
        }
        for(let y = bendY; y <= targetY; y++) {
            place('pipe', targetX, y);
        }
    }
}

function pullFromBelt(px, assemblerY, beltX, yOffset) {
    let isLong = Math.abs(px - beltX) > 2;
    let insName = isLong ? 'long-handed-inserter' : 'fast-inserter';
    let insX = beltX < px ? beltX + 1 : beltX - 1;
    let dir = beltX < px ? 2 : 6;
    place(insName, insX, assemblerY + yOffset, dir);
}

// --- Pod Definitions ---
let pods = [
    {
        px: 20,
        items: ['transport-belt', 'fast-transport-belt', 'express-transport-belt'],
        inputs: [
            {item: 'iron-plate', targetX: 18, tapX: 10, bendY: 13, yOffsets: [-1, -1, -1]},
            {item: 'iron-gear-wheel', targetX: 22, tapX: 14, bendY: 14, yOffsets: [0, 0, 0]},
            {item: 'lubricant', targetX: 17, tapX: 18, bendY: 15, isFluid: true}
        ]
    },
    {
        px: 34,
        items: ['underground-belt', 'fast-underground-belt', 'express-underground-belt'],
        inputs: [
            {item: 'iron-plate', targetX: 32, tapX: 22, bendY: 13, yOffsets: [-1, -1, -1]},
            {item: 'iron-gear-wheel', targetX: 36, tapX: 26, bendY: 14, yOffsets: [0, 0, 0]},
            {item: 'lubricant', targetX: 31, tapX: 30, bendY: 15, isFluid: true}
        ]
    },
    {
        px: 48,
        items: ['splitter', 'fast-splitter', 'express-splitter'],
        inputs: [
            {item: 'iron-plate', targetX: 46, tapX: 34, bendY: 13, yOffsets: [-1, -1, -1]},
            {item: 'iron-gear-wheel', targetX: 50, tapX: 38, bendY: 14, yOffsets: [0, 0, 0]},
            {item: 'electronic-circuit', targetX: 45, tapX: 42, bendY: 15, yOffsets: [1, 1, 1]},
            {item: 'advanced-circuit', targetX: 51, tapX: 46, bendY: 16, yOffsets: [1, 1, 1]},
            {item: 'lubricant', targetX: 45, tapX: 50, bendY: 17, isFluid: true} // Fluid at 45
        ]
    },
    {
        px: 62,
        items: ['inserter', 'fast-inserter', 'bulk-inserter'],
        inputs: [
            {item: 'iron-plate', targetX: 60, tapX: 54, bendY: 13, yOffsets: [-1, -1, -1]},
            {item: 'iron-gear-wheel', targetX: 64, tapX: 58, bendY: 14, yOffsets: [0, 0, 0]},
            {item: 'electronic-circuit', targetX: 59, tapX: 62, bendY: 15, yOffsets: [1, 1, 1]},
            {item: 'advanced-circuit', targetX: 65, tapX: 66, bendY: 16, yOffsets: [1, 1, 1]}
        ]
    },
    {
        px: 76,
        items: ['medium-electric-pole', 'big-electric-pole', 'substation'],
        inputs: [
            {item: 'steel-plate', targetX: 74, tapX: 70, bendY: 13, yOffsets: [-1, -1, -1]},
            {item: 'copper-plate', targetX: 78, tapX: 74, bendY: 14, yOffsets: [0, 0, 0]},
            {item: 'advanced-circuit', targetX: 73, tapX: 78, bendY: 15, yOffsets: [1, 1, 1]}
        ]
    },
    {
        px: 90,
        items: ['pipe', 'pipe-to-ground', 'storage-tank'],
        inputs: [
            {item: 'iron-plate', targetX: 88, tapX: 82, bendY: 13, yOffsets: [-1, -1, -1]},
            {item: 'steel-plate', targetX: 92, tapX: 86, bendY: 14, yOffsets: [0, 0, 0]}
        ]
    },
    {
        px: 104,
        items: ['flying-robot-frame', 'logistic-robot', 'construction-robot'],
        inputs: [
            {item: 'steel-plate', targetX: 102, tapX: 90, bendY: 13, yOffsets: [-1, -1, -1]},
            {item: 'battery', targetX: 106, tapX: 94, bendY: 14, yOffsets: [0, 0, 0]},
            {item: 'electronic-circuit', targetX: 101, tapX: 98, bendY: 15, yOffsets: [1, 1, 1]},
            {item: 'electric-engine-unit', targetX: 107, tapX: 102, bendY: 16, yOffsets: [1, 1, 1]},
            {item: 'advanced-circuit', targetX: 100, tapX: 106, bendY: 17, yOffsets: [0, 0, 0]}
        ]
    },
    {
        px: 118,
        items: ['small-lamp'],
        inputs: [
            {item: 'iron-plate', targetX: 116, tapX: 110, bendY: 13, yOffsets: [-1]},
            {item: 'copper-cable', targetX: 120, tapX: 114, bendY: 14, yOffsets: [0]},
            {item: 'electronic-circuit', targetX: 115, tapX: 118, bendY: 15, yOffsets: [1]}
        ]
    }
];

// Build Pods
for (let pod of pods) {
    let startY = 25;
    
    // Tap inputs
    for (let input of pod.inputs) {
        tapBus(input.tapX, input.item, input.targetX, 45, input.bendY);
    }
    
    for (let i = 0; i < pod.items.length; i++) {
        let item = pod.items[i];
        let y = startY + i * 6;
        
        place('assembling-machine-3', pod.px, y, 0, item);
        
        // Pull inputs
        for (let input of pod.inputs) {
            if (input.isFluid) {
                // Connect pipe to assembler
                place('pipe', input.targetX, y);
                place('pipe', input.targetX + 1, y);
            } else {
                pullFromBelt(pod.px, y, input.targetX, input.yOffsets[i] || 0);
            }
        }
        
        // Output to chest
        place('fast-inserter', pod.px, y + 2, 4); // South
        place('logistic-chest-passive-provider', pod.px, y + 3);
        
        // Pull from chest for next tier
        if (i < pod.items.length - 1) {
            place('fast-inserter', pod.px, y + 4, 4); // South
        }
    }
}

// Top Zone Producers
let tx = 0;
function addProducer(name, recipe, reqItems, outItem) {
    place(name, tx, -15, 0, recipe);
    if (reqItems.length > 0) {
        let req = place('logistic-chest-requester', tx, -17);
        req.control_behavior = {
            logistic_parameters: {
                request_filters: reqItems.map((item, i) => ({index: i+1, name: item, count: 100}))
            }
        };
        place('fast-inserter', tx, -16, 4);
    }
    if (outItem) {
        place('fast-inserter', tx, -13, 4);
        place('logistic-chest-active-provider', tx, -12);
    }
    tx += 7;
}

addProducer('foundry', 'casting-iron', [], 'iron-plate');
addProducer('foundry', 'casting-iron-gear-wheel', [], 'iron-gear-wheel');
addProducer('foundry', 'casting-steel', [], 'steel-plate');
addProducer('foundry', 'casting-copper', [], 'copper-plate');
addProducer('foundry', 'casting-copper-cable', [], 'copper-cable');

addProducer('assembling-machine-3', 'electronic-circuit', ['iron-plate', 'copper-cable'], 'electronic-circuit');
addProducer('assembling-machine-3', 'advanced-circuit', ['electronic-circuit', 'plastic-bar', 'copper-cable'], 'advanced-circuit');
addProducer('assembling-machine-3', 'engine-unit', ['steel-plate', 'iron-gear-wheel', 'pipe'], 'engine-unit');
addProducer('assembling-machine-3', 'electric-engine-unit', ['engine-unit', 'electronic-circuit'], 'electric-engine-unit');

addProducer('chemical-plant', 'plastic-bar', ['coal'], 'plastic-bar');
addProducer('chemical-plant', 'sulfur', [], 'sulfur');
addProducer('chemical-plant', 'battery', ['iron-plate', 'copper-plate'], 'battery');

// Substations
for (let x = 0; x <= 120; x += 16) {
    place('substation', x, -5);
    place('substation', x, 15);
    place('substation', x, 35);
}

// Combine entities
for (let [key, ent] of spatialGrid.entries()) {
    entities.push(ent);
}

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

fs.writeFileSync('./mall/mall_blueprint_v2.txt', finalString);
console.log("Blueprint generated successfully at mall/mall_blueprint_v2.txt");
