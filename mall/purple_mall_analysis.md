# Purple Mall Dependency Tree (Factorio 2.0)

This blueprint uses only the following raw inputs:
- molten-iron
- molten-copper
- crude-oil
- water
- coal

All requested outputs are placed in passive provider chests. Some internal base items (transport belt, underground belt, inserter, flying robot frame) are also produced to support chaining.

## Dependency Tree

[Level 0: Raw Inputs]
- molten-iron
- molten-copper
- crude-oil
- water
- coal

[Level 1: Primary Processing]
- iron-plate (molten-iron)
- iron-gear-wheel (molten-iron)
- steel-plate (molten-iron)
- copper-plate (molten-copper)
- copper-cable (molten-copper)
- petroleum-gas, heavy-oil, light-oil (crude-oil + water)

[Level 2: Basic Intermediates]
- electronic-circuit (iron-plate + copper-cable)
- plastic-bar (petroleum-gas + coal)
- sulfur (petroleum-gas + water)
- lubricant (heavy-oil)

[Level 3: Advanced Intermediates]
- sulfuric-acid (sulfur + iron-plate + water)
- advanced-circuit (electronic-circuit + plastic-bar + copper-cable)
- engine-unit (steel-plate + iron-gear-wheel + pipe)

[Level 4: Complex Intermediates]
- battery (sulfuric-acid + iron-plate + copper-plate)
- electric-engine-unit (engine-unit + lubricant + electronic-circuit)
- flying-robot-frame (electric-engine-unit + battery + steel-plate + electronic-circuit)

[Level 5: Final Outputs]
- fast-transport-belt (transport-belt + iron-gear-wheel)
- express-transport-belt (fast-transport-belt + iron-gear-wheel + lubricant)
- fast-underground-belt (underground-belt + iron-gear-wheel)
- express-underground-belt (fast-underground-belt + iron-gear-wheel + lubricant)
- fast-inserter (inserter + electronic-circuit + iron-plate)
- long-handed-inserter (inserter + iron-gear-wheel + iron-plate)
- bulk-inserter (fast-inserter + advanced-circuit + electronic-circuit + iron-gear-wheel)
- medium-electric-pole (steel-plate + copper-plate)
- big-electric-pole (steel-plate + copper-plate)
- substation (steel-plate + copper-plate + advanced-circuit)
- pipe (iron-plate)
- pipe-to-ground (pipe + iron-plate)
- storage-tank (iron-plate + steel-plate)
- logistic-robot (flying-robot-frame + advanced-circuit)
- construction-robot (flying-robot-frame + electronic-circuit)
- small-lamp (iron-plate + copper-cable + electronic-circuit)

## Recipe Speeds (Craft Time, seconds)

These are the base recipe times used for the mall layout. All assemblers are assembling-machine-3 without beacons.

- transport-belt: 0.5 (output 2)
- fast-transport-belt: 0.5
- express-transport-belt: 0.5
- underground-belt: 1.0 (output 2)
- fast-underground-belt: 2.0 (output 2)
- express-underground-belt: 2.0 (output 2)
- inserter: 0.5
- long-handed-inserter: 0.5
- fast-inserter: 0.5
- bulk-inserter: 0.5
- medium-electric-pole: 0.5
- big-electric-pole: 0.5
- substation: 0.5
- pipe: 0.5
- pipe-to-ground: 0.5 (output 2)
- storage-tank: 3.0
- logistic-robot: 0.5
- construction-robot: 0.5
- small-lamp: 0.5

## Notes

- Chain-buffers are used so that tiered items (belt and inserter upgrades) pull from the previous tier chest.
- Lubricant is piped to both express belt and express underground assemblers.
- Flying robot frames are produced internally to feed logistic and construction robots.
