const fs = require('fs');
const zlib = require('zlib');

let spatialGrid = new Map();
let entities = [];
let entity_number = 1;

function place(name, x, y, dir = 0, recipe = null, extra = {}) {
    let ent = { entity_number: entity_number++, name, position: {x, y}, direction: dir };
    if (recipe) ent.recipe = recipe;
    Object.assign(ent, extra);
    
    if (['fast-transport-belt', 'pipe', 'fast-underground-belt', 'pipe-to-ground'].includes(name)) {
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
    'iron-gear-wheel': 2,
    'steel-plate': 4,
    'copper-plate': 6,
    'copper-cable': 8,
    'electronic-circuit': 10,
    'advanced-circuit': 12,
    'battery': 14,
    'engine-unit': 16,
    'electric-engine-unit': 18
};
const FLUID_LANES = {
    'lubricant': 20,
    'sulfuric-acid': 22
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
    let req = place('requester-chest', -7, y);
    req.control_behavior = {
        logistic_parameters: {
            request_filters: [{index: 1, name: item, count: 200}]
        }
    };
    place('fast-inserter', -6, y, 2); // East onto bus
}

function routeBelt(startX, startY, endX, endY, bendY) {
    let currY = startY;
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
        removeSpatial(tapX+1, L);
        removeSpatial(tapX+2, L);
        
        placeSplitter(tapX, L);
        
        place('fast-transport-belt', tapX+1, L, 2);
        place('fast-transport-belt', tapX+2, L, 2);
        
        place('fast-transport-belt', tapX+1, L+1, 4);
        
        for (let otherItem in BUS_LANES) {
            let otherL = BUS_LANES[otherItem];
            if (otherL > L) {
                removeSpatial(tapX, otherL);
                removeSpatial(tapX+1, otherL);
                removeSpatial(tapX+2, otherL);
                
                place('fast-underground-belt', tapX, otherL, 2, null, {type: 'input'});
                place('fast-underground-belt', tapX+2, otherL, 2, null, {type: 'output'});
                
                place('fast-transport-belt', tapX+1, otherL, 4);
            }
        }
        
        for (let otherItem in FLUID_LANES) {
            let otherL = FLUID_LANES[otherItem];
            if (otherL > L) {
                removeSpatial(tapX, otherL);
                removeSpatial(tapX+1, otherL);
                removeSpatial(tapX+2, otherL);
                
                place('pipe-to-ground', tapX, otherL, 2);
                place('pipe-to-ground', tapX+2, otherL, 6);
                
                place('fast-transport-belt', tapX+1, otherL, 4);
            }
        }
        
        for (let y = L + 2; y <= 23; y++) {
            if (y % 2 !== 0) {
                place('fast-transport-belt', tapX+1, y, 4);
            }
        }
        
        routeBelt(tapX+1, 24, targetX, targetY, bendY);
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
    let isLong = Math.abs(px - beltX) > 3;
    let insName = isLong ? 'long-handed-inserter' : 'fast-inserter';
    let insX = beltX < px ? px - 2 : px + 2;
    let dir = beltX < px ? 2 : 6;
    place(insName, insX, assemblerY + yOffset, dir);
}

let pods = [
    {
        px: 20,
        items: ['transport-belt', 'fast-transport-belt', 'express-transport-belt'],
        inputs: [
            {item: 'iron-plate', targetX: 17, tapX: 10, bendY: 25, yOffsets: [-1, undefined, undefined]},
            {item: 'iron-gear-wheel', targetX: 23, tapX: 14, bendY: 26, yOffsets: [0, 0, 0]},
            {item: 'lubricant', targetX: 14, tapX: 18, bendY: 27, isFluid: true}
        ]
    },
    {
        px: 34,
        items: ['underground-belt', 'fast-underground-belt', 'express-underground-belt'],
        inputs: [
            {item: 'iron-plate', targetX: 31, tapX: 22, bendY: 25, yOffsets: [-1, undefined, undefined]},
            {item: 'iron-gear-wheel', targetX: 37, tapX: 26, bendY: 26, yOffsets: [undefined, 0, 0]},
            {item: 'lubricant', targetX: 28, tapX: 30, bendY: 27, isFluid: true}
        ]
    },
    {
        px: 48,
        items: ['splitter', 'fast-splitter', 'express-splitter'],
        inputs: [
            {item: 'iron-plate', targetX: 45, tapX: 34, bendY: 25, yOffsets: [-1, undefined, undefined]},
            {item: 'iron-gear-wheel', targetX: 51, tapX: 38, bendY: 26, yOffsets: [undefined, 0, 0]},
            {item: 'electronic-circuit', targetX: 44, tapX: 42, bendY: 27, yOffsets: [1, 1, undefined]},
            {item: 'advanced-circuit', targetX: 52, tapX: 46, bendY: 28, yOffsets: [undefined, undefined, 1]},
            {item: 'lubricant', targetX: 42, tapX: 50, bendY: 29, isFluid: true}
        ]
    },
    {
        px: 62,
        items: ['inserter', 'fast-inserter', 'bulk-inserter'],
        inputs: [
            {item: 'iron-plate', targetX: 59, tapX: 54, bendY: 25, yOffsets: [-1, -1, undefined]},
            {item: 'iron-gear-wheel', targetX: 65, tapX: 58, bendY: 26, yOffsets: [0, undefined, 0]},
            {item: 'electronic-circuit', targetX: 58, tapX: 62, bendY: 27, yOffsets: [1, 1, 1]},
            {item: 'advanced-circuit', targetX: 66, tapX: 66, bendY: 28, yOffsets: [undefined, undefined, 1]}
        ]
    },
    {
        px: 76,
        items: ['medium-electric-pole', 'big-electric-pole', 'substation'],
        inputs: [
            {item: 'steel-plate', targetX: 73, tapX: 70, bendY: 25, yOffsets: [-1, -1, -1]},
            {item: 'copper-plate', targetX: 79, tapX: 74, bendY: 26, yOffsets: [0, 0, 0]},
            {item: 'advanced-circuit', targetX: 72, tapX: 78, bendY: 27, yOffsets: [undefined, undefined, 1]}
        ]
    },
    {
        px: 90,
        items: ['pipe', 'pipe-to-ground', 'storage-tank'],
        inputs: [
            {item: 'iron-plate', targetX: 87, tapX: 82, bendY: 25, yOffsets: [-1, -1, -1]},
            {item: 'steel-plate', targetX: 93, tapX: 86, bendY: 26, yOffsets: [undefined, undefined, 0]}
        ]
    },
    {
        px: 104,
        items: ['flying-robot-frame', 'logistic-robot', 'construction-robot'],
        inputs: [
            {item: 'steel-plate', targetX: 101, tapX: 90, bendY: 25, yOffsets: [-1, undefined, undefined]},
            {item: 'battery', targetX: 107, tapX: 94, bendY: 26, yOffsets: [0, undefined, undefined]},
            {item: 'electronic-circuit', targetX: 100, tapX: 98, bendY: 27, yOffsets: [1, undefined, 1]},
            {item: 'electric-engine-unit', targetX: 108, tapX: 102, bendY: 28, yOffsets: [1, undefined, undefined], endY: 40},
            {item: 'advanced-circuit', targetX: 109, tapX: 106, bendY: 29, yOffsets: [undefined, 1, undefined]}
        ]
    },
    {
        px: 118,
        items: ['small-lamp'],
        inputs: [
            {item: 'iron-plate', targetX: 115, tapX: 110, bendY: 25, yOffsets: [-1]},
            {item: 'copper-cable', targetX: 121, tapX: 114, bendY: 26, yOffsets: [0]},
            {item: 'electronic-circuit', targetX: 114, tapX: 118, bendY: 27, yOffsets: [1]}
        ]
    }
];

for (let pod of pods) {
    let startY = 35;
    
    for (let input of pod.inputs) {
        let targetY = input.endY || 60;
        tapBus(input.tapX, input.item, input.targetX, targetY, input.bendY);
    }
    
    if (pod.px === 104) {
        place('fast-transport-belt', 109, 41, 6);
        for (let y = 41; y <= 60; y++) {
            place('fast-transport-belt', 108, y, 4);
        }
    }
    
    if (pod.px === 34 || pod.px === 48) {
        let belts = ['transport-belt', 'fast-transport-belt', 'express-transport-belt'];
        for (let i = 0; i < 3; i++) {
            let y = startY + i * 6;
            let req = place('requester-chest', pod.px + 1, y - 3);
            req.control_behavior = {
                logistic_parameters: {
                    request_filters: [{index: 1, name: belts[i], count: 100}]
                }
            };
            place('fast-inserter', pod.px + 1, y - 2, 4);
        }
    }
    
    for (let i = 0; i < pod.items.length; i++) {
        let item = pod.items[i];
        let y = startY + i * 6;
        
        place('assembling-machine-3', pod.px, y, 2, item);
        
        for (let input of pod.inputs) {
            if (input.isFluid) {
                let isLeft = input.targetX < pod.px;
                let ptgX1 = isLeft ? pod.px - 5 : pod.px + 5;
                let ptgX2 = isLeft ? pod.px - 2 : pod.px + 2;
                let dir1 = isLeft ? 2 : 6;
                let dir2 = isLeft ? 6 : 2;
                
                place('pipe', input.targetX, y);
                place('pipe-to-ground', ptgX1, y, dir1);
                place('pipe-to-ground', ptgX2, y, dir2);
                
                if (Math.abs(input.targetX - ptgX1) > 1) {
                    let step = input.targetX < ptgX1 ? 1 : -1;
                    for (let currX = input.targetX + step; currX !== ptgX1; currX += step) {
                        place('pipe', currX, y);
                    }
                }
            } else {
                let actualBeltX = input.targetX;
                if (pod.px === 104 && input.item === 'advanced-circuit') actualBeltX = 108;
                
                if (input.yOffsets[i] !== undefined) {
                    pullFromBelt(pod.px, y, actualBeltX, input.yOffsets[i]);
                }
            }
        }
        
        place('fast-inserter', pod.px, y + 2, 4);
        place('passive-provider-chest', pod.px, y + 3);
        
        if (i < pod.items.length - 1) {
            place('fast-inserter', pod.px, y + 4, 4);
        }
    }
}

let tx = 0;
function addProducer(name, recipe, reqItems, outItem, fluidInput) {
    place(name, tx, -15, 0, recipe);
    
    let is5x5 = name === 'foundry';
    let inY = is5x5 ? -18 : -17;
    let reqY = is5x5 ? -19 : -18;
    let outY = is5x5 ? -12 : -13;
    let chestY = is5x5 ? -11 : -12;

    if (reqItems.length > 0) {
        let req = place('requester-chest', tx, reqY);
        req.control_behavior = {
            logistic_parameters: {
                request_filters: reqItems.map((item, i) => ({index: i+1, name: item, count: 100}))
            }
        };
        place('fast-inserter', tx, inY, 4);
    } else if (is5x5 && fluidInput) {
        if (fluidInput === 'molten-iron') {
            place('pipe', tx, -18);
            place('pipe', tx, -19);
        } else if (fluidInput === 'molten-copper') {
            place('pipe', tx, -18);
            place('pipe', tx, -19);
            place('pipe', tx, -20);
        }
    }
    
    if (outItem) {
        place('fast-inserter', tx, outY, 4);
        place('active-provider-chest', tx, chestY);
    }
    tx += 7;
}

addProducer('foundry', 'casting-iron', [], 'iron-plate', 'molten-iron');
addProducer('foundry', 'casting-iron-gear-wheel', [], 'iron-gear-wheel', 'molten-iron');
addProducer('foundry', 'casting-steel', [], 'steel-plate', 'molten-iron');
addProducer('foundry', 'casting-copper', [], 'copper-plate', 'molten-copper');
addProducer('foundry', 'casting-copper-cable', [], 'copper-cable', 'molten-copper');

addProducer('assembling-machine-3', 'electronic-circuit', ['iron-plate', 'copper-cable'], 'electronic-circuit');
addProducer('assembling-machine-3', 'advanced-circuit', ['electronic-circuit', 'plastic-bar', 'copper-cable'], 'advanced-circuit');
addProducer('assembling-machine-3', 'engine-unit', ['steel-plate', 'iron-gear-wheel', 'pipe'], 'engine-unit');
addProducer('assembling-machine-3', 'electric-engine-unit', ['engine-unit', 'electronic-circuit'], 'electric-engine-unit');

function drawPipeLine(x1, y1, x2, y2) {
    let stepX = x1 < x2 ? 1 : -1;
    let stepY = y1 < y2 ? 1 : -1;
    if (x1 !== x2) {
        for (let x = x1; x !== x2 + stepX; x += stepX) place('pipe', x, y1);
    } else {
        place('pipe', x1, y1);
    }
    if (y1 !== y2) {
        for (let y = y1 + stepY; y !== y2 + stepY; y += stepY) place('pipe', x2, y);
    }
}

// Fluid Zone
place('pipe', -33, 2); place('pipe', -33, 1); // Molten Iron
place('pipe', -35, 2); place('pipe', -35, 1); // Molten Copper

drawPipeLine(-33, 1, -33, -19);
drawPipeLine(-33, -19, 14, -19); // Molten Iron bus

drawPipeLine(-35, 1, -35, -20);
drawPipeLine(-35, -20, 28, -20); // Molten Copper bus

place('oil-refinery', -30, 5, 0, 'advanced-oil-processing');
place('pipe', -31, 2); place('pipe', -31, 1); // Crude Oil
place('pipe', -29, 2); place('pipe', -29, 1); // Water

place('chemical-plant', -33, 14, 0, 'lubricant');
drawPipeLine(-31, 8, -34, 11);
place('pipe', -34, 12);
drawPipeLine(-32, 16, -10, 20);

place('storage-tank', -30, 13);
drawPipeLine(-30, 8, -30, 11);

place('chemical-plant', -25, 14, 0, 'sulfur');
drawPipeLine(-29, 8, -26, 11);
place('pipe', -26, 12);
drawPipeLine(-24, 5, -24, 11);
place('pipe', -24, 12);
place('fast-inserter', -25, 16, 4);
place('active-provider-chest', -25, 17);

place('chemical-plant', -19, 14, 0, 'plastic-bar');
drawPipeLine(-26, 8, -20, 11);
place('pipe', -20, 12);
let reqPlast = place('requester-chest', -19, 11);
reqPlast.control_behavior = { logistic_parameters: { request_filters: [{index: 1, name: 'coal', count: 100}] } };
place('fast-inserter', -19, 12, 4);
place('fast-inserter', -19, 16, 4);
place('active-provider-chest', -19, 17);

place('chemical-plant', -25, 22, 0, 'sulfuric-acid');
drawPipeLine(-24, 11, -24, 19);
place('pipe', -24, 20);
let reqAcid = place('requester-chest', -25, 19);
reqAcid.control_behavior = { logistic_parameters: { request_filters: [{index: 1, name: 'sulfur', count: 100}, {index: 2, name: 'iron-plate', count: 100}] } };
place('fast-inserter', -25, 20, 4);
drawPipeLine(-24, 24, -10, 22);

place('chemical-plant', -19, 22, 0, 'battery');
drawPipeLine(-24, 24, -20, 19);
place('pipe', -20, 20);
let reqBatt = place('requester-chest', -19, 19);
reqBatt.control_behavior = { logistic_parameters: { request_filters: [{index: 1, name: 'iron-plate', count: 100}, {index: 2, name: 'copper-plate', count: 100}] } };
place('fast-inserter', -19, 20, 4);
place('fast-inserter', -19, 24, 4);
place('active-provider-chest', -19, 25);

for (let x = -40; x <= 130; x += 16) {
    place('substation', x, -5);
    place('substation', x, 15);
    place('substation', x, 35);
    place('substation', x, 55);
}

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

fs.writeFileSync('./mall/mall_blueprint_v4.txt', finalString);
console.log("Blueprint generated successfully at mall/mall_blueprint_v4.txt");
