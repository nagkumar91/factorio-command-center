// Explicit recipe order and controls selected by native design reviews.
// Re-run functional and throughput tests after changing any option.
export const transportWorkshopConfigs={
  "Yellow": {
    "columns": 4,
    "pitch": 4,
    "recipes": [
      "iron-plate",
      "iron-plate",
      "iron-plate",
      "iron-gear-wheel",
      "transport-belt",
      "underground-belt",
      "copper-plate",
      "copper-cable",
      "electronic-circuit",
      "splitter",
      "iron-plate"
    ]
  },
  "Red": {
    "columns": 5,
    "pitch": 5,
    "recipes": [
      "iron-plate",
      "iron-plate",
      "iron-plate",
      "iron-plate",
      "iron-gear-wheel",
      "iron-gear-wheel",
      "transport-belt",
      "underground-belt",
      "fast-underground-belt",
      "fast-transport-belt",
      "copper-plate",
      "copper-cable",
      "electronic-circuit",
      "splitter",
      "fast-splitter"
    ],
    "splitInputFilters": true,
    "inputGates": {
      "iron-gear-wheel": {
        "item": "iron-plate",
        "constant": 40
      }
    }
  },
  "Blue": {
    "columns": 4,
    "pitch": 6,
    "recipes": [
      "iron-plate",
      "iron-plate",
      "iron-plate",
      "iron-gear-wheel",
      "iron-gear-wheel",
      "transport-belt",
      "fast-transport-belt",
      "underground-belt",
      "fast-underground-belt",
      "copper-plate",
      "copper-plate",
      "copper-cable",
      "electronic-circuit",
      "splitter",
      "fast-splitter",
      "advanced-circuit",
      "express-splitter",
      "advanced-oil-processing",
      "lubricant",
      "express-transport-belt",
      "express-underground-belt",
      "plastic-bar",
      "light-oil-cracking",
      "solid-fuel-from-petroleum-gas"
    ],
    "splitInputFilters": true,
    "minimumStock": 2,
    "inputReserveByRecipe": {
      "iron-gear-wheel": {
        "iron-plate": 40
      },
      "splitter": {
        "electronic-circuit": 8
      },
      "fast-splitter": {
        "electronic-circuit": 8
      },
      "fast-underground-belt": {
        "iron-gear-wheel": 20
      },
      "express-underground-belt": {
        "iron-gear-wheel": 20
      },
      "express-transport-belt": {
        "iron-gear-wheel": 5
      },
      "express-splitter": {
        "iron-gear-wheel": 5
      }
    }
  },
  "Green": {
    "columns": 6,
    "pitch": 8,
    "recipes": [
      "iron-plate",
      "iron-plate",
      "iron-plate",
      "iron-gear-wheel",
      "transport-belt",
      "fast-transport-belt",
      "underground-belt",
      "fast-underground-belt",
      "copper-plate",
      "copper-plate",
      "copper-cable",
      "electronic-circuit",
      "splitter",
      "fast-splitter",
      "advanced-circuit",
      "molten-iron",
      "tungsten-plate",
      "advanced-oil-processing",
      "lubricant",
      "express-transport-belt",
      "turbo-transport-belt",
      "express-underground-belt",
      "turbo-underground-belt",
      "plastic-bar",
      "express-splitter",
      "sulfur",
      "sulfuric-acid",
      "processing-unit",
      "turbo-splitter",
      "light-oil-cracking",
      "solid-fuel-from-petroleum-gas"
    ],
    "publicationStatus": "draft"
  }
};
