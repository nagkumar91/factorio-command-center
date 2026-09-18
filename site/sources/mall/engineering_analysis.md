# Factorio 2.0 Mall: Engineering Analysis & Dependency Tree

## 1. The End Goal (Final Products)
The objective is to produce a comprehensive logistics and infrastructure mall. All final products will be output into **Passive Provider Chests**.

**Logistics (Belts):**
*   Transport Belt, Fast Transport Belt, Express Transport Belt
*   Underground Belt, Fast Underground Belt, Express Underground Belt
*   Splitter, Fast Splitter, Express Splitter

**Logistics (Inserters):**
*   Inserter, Long-handed Inserter, Fast Inserter, Bulk Inserter

**Power & Infrastructure:**
*   Medium Electric Pole, Big Electric Pole, Substation, Lamp

**Fluids:**
*   Pipe, Pipe-to-ground, Storage Tank

**Robotics:**
*   Logistic Robot, Construction Robot

---

## 2. Raw Inputs & Primary Processing Entities
The system is constrained to the following raw inputs:
*   **Molten Iron** -> Processed in `Foundry`
*   **Molten Copper** -> Processed in `Foundry`
*   **Crude Oil** -> Processed in `Oil Refinery`
*   **Water** -> Used in `Chemical Plant` / `Oil Refinery`
*   **Coal** -> Used in `Chemical Plant`

### Primary Entities (Level 1)
*   **Foundry (Iron):** Iron Plate, Iron Gear Wheel, Steel Plate, Pipe
*   **Foundry (Copper):** Copper Plate, Copper Cable
*   **Oil Refinery:** Heavy Oil, Light Oil, Petroleum Gas

---

## 3. Dependency Tree (The Engineering Breakdown)

This tree illustrates the flow from raw materials to final products, identifying common dependencies.

```text
[Level 0: Raw Inputs]
 ├── Molten Iron
 ├── Molten Copper
 ├── Crude Oil
 ├── Water
 └── Coal

[Level 1: Primary Processing]
 ├── Iron Plate (Molten Iron)
 ├── Iron Gear Wheel (Molten Iron)
 ├── Steel Plate (Molten Iron)
 ├── Pipe (Molten Iron)
 ├── Copper Plate (Molten Copper)
 ├── Copper Cable (Molten Copper)
 └── Petroleum Gas, Heavy Oil, Light Oil (Crude Oil + Water)

[Level 2: Basic Intermediates]
 ├── Electronic Circuit [Green Chip] (Iron Plate + Copper Cable)
 ├── Plastic Bar (Petroleum Gas + Coal)
 ├── Sulfur (Petroleum Gas + Water)
 └── Lubricant (Heavy Oil)

[Level 3: Advanced Intermediates]
 ├── Sulfuric Acid (Sulfur + Iron Plate + Water)
 ├── Advanced Circuit [Red Chip] (Electronic Circuit + Plastic Bar + Copper Cable)
 └── Engine Unit (Steel Plate + Iron Gear Wheel + Pipe)

[Level 4: Complex Intermediates]
 ├── Battery (Sulfuric Acid + Iron Plate + Copper Plate)
 └── Electric Engine Unit (Engine Unit + Lubricant + Electronic Circuit)

[Level 5: Robotics Core]
 └── Flying Robot Frame (Electric Engine Unit + Battery + Steel Plate + Electronic Circuit)
```

---

## 4. Final Product Input Mapping (Quantitative Analysis)

To properly design the mall, we must analyze the exact crafting yields, input requirements, and crafting times. This reveals the mathematical constraints of the factory.

| Final Product | Craft Time | Inputs Required | Output Yield |
| :--- | :--- | :--- | :--- |
| **Belts** | | | |
| Transport Belt | 0.5s | 1x Iron Plate, 1x Iron Gear Wheel | **2x** Transport Belt |
| Fast Transport Belt | 0.5s | 1x Transport Belt, 5x Iron Gear Wheel | 1x Fast Transport Belt |
| Express Transport Belt | 0.5s | 1x Fast Transport Belt, 10x Iron Gear Wheel, 20x Lubricant | 1x Express Transport Belt |
| Underground Belt | 1.0s | 10x Iron Plate, 5x Transport Belt | **2x** Underground Belt |
| Fast Underground Belt | 2.0s | 20x Iron Gear Wheel, 2x Underground Belt | **2x** Fast Underground Belt |
| Express Underground Belt | 2.0s | 80x Iron Gear Wheel, 2x Fast Underground Belt, 40x Lubricant | **2x** Express Underground Belt |
| Splitter | 1.0s | 5x Electronic Circuit, 5x Iron Plate, 4x Transport Belt | 1x Splitter |
| Fast Splitter | 2.0s | 10x Electronic Circuit, 10x Iron Gear Wheel, 1x Splitter | 1x Fast Splitter |
| Express Splitter | 2.0s | 10x Advanced Circuit, 10x Iron Gear Wheel, 1x Fast Splitter, 80x Lubricant | 1x Express Splitter |
| **Inserters** | | | |
| Inserter | 0.5s | 1x Electronic Circuit, 1x Iron Gear Wheel, 1x Iron Plate | 1x Inserter |
| Long-handed Inserter | 0.5s | 1x Inserter, 1x Iron Gear Wheel, 1x Iron Plate | 1x Long-handed Inserter |
| Fast Inserter | 0.5s | 2x Electronic Circuit, 2x Iron Plate, 1x Inserter | 1x Fast Inserter |
| Bulk Inserter | 0.5s | 1x Advanced Circuit, 1x Electronic Circuit, 1x Fast Inserter, 15x Iron Gear Wheel | 1x Bulk Inserter |
| **Power & Misc** | | | |
| Medium Electric Pole | 0.5s | 2x Copper Plate, 2x Steel Plate | 1x Medium Electric Pole |
| Big Electric Pole | 0.5s | 5x Copper Plate, 5x Steel Plate | 1x Big Electric Pole |
| Substation | 0.5s | 5x Advanced Circuit, 5x Copper Plate, 10x Steel Plate | 1x Substation |
| Lamp | 0.5s | 3x Copper Cable, 1x Electronic Circuit, 1x Iron Plate | 1x Lamp |
| **Fluids** | | | |
| Pipe | 0.5s | 1x Iron Plate | 1x Pipe |
| Pipe-to-ground | 0.5s | 5x Iron Plate, 10x Pipe | **2x** Pipe-to-ground |
| Storage Tank | 3.0s | 20x Iron Plate, 5x Steel Plate | 1x Storage Tank |
| **Robotics** | | | |
| Logistic Robot | 0.5s | 2x Advanced Circuit, 1x Flying Robot Frame | 1x Logistic Robot |
| Construction Robot | 0.5s | 2x Electronic Circuit, 1x Flying Robot Frame | 1x Construction Robot |

---

## 5. Optimization & Blueprint Design Strategy (Revised)

Based on the quantitative analysis above, the previous "Direct Insertion" strategy is fundamentally flawed for a logistics mall. 

### A. Why Direct Insertion Fails Here
1.  **Yield Mismatches:** A single craft of a `Transport Belt` yields **2** belts. However, a `Fast Transport Belt` only consumes **1** `Transport Belt`. If we directly insert from the basic belt assembler to the fast belt assembler, the second basic belt is trapped, breaking the ratio and clogging the machine.
2.  **The Logistics Network Requirement:** The primary goal is to have *all* items available in the logistics network. If an `Inserter` is directly passed into a `Fast Inserter` assembler, the basic `Inserter` never enters a Passive Provider Chest, meaning the player/bots can never request basic inserters.
3.  **Throughput Bottlenecks:** `Express Underground Belts` require 80 Iron Gear Wheels per craft. Direct insertion cannot supply gears fast enough without massive beacon setups, requiring dedicated high-throughput belt feeds instead.

### B. The "Chest-Buffered Daisy Chain" Architecture
Instead of direct machine-to-machine insertion, we must use a **Chest-Buffered** approach for all tiered items.

1.  **The Buffer Strategy:** 
    *   Assembler 1 (e.g., Transport Belt) outputs into a **Passive Provider Chest**.
    *   Assembler 2 (e.g., Fast Transport Belt) pulls its required `Transport Belts` *out* of that same Passive Provider Chest using a fast/bulk inserter.
    *   This solves the yield mismatch (the chest absorbs the extra belt) AND fulfills the requirement that every tier is available to the logistics network.
2.  **High-Volume Inputs:** Items like Iron Gear Wheels (needed in massive quantities for Express logistics) and Iron Plates must be delivered via dedicated, high-throughput belts running parallel to the assemblers, not direct-inserted.

### C. Layout Topology (The Engineering Flow)
1.  **The Main Artery (Bus):** A central bus carrying the highest-volume solids: Iron Plate, Iron Gear Wheel, Electronic Circuit, Advanced Circuit, Steel Plate, and Copper Plate.
2.  **Fluid Lines:** Lubricant and Sulfuric Acid piped alongside the main artery.
3.  **Perpendicular Production Pods:** Assemblers are arranged in columns moving away from the bus.
    *   *Example Belt Pod:* Bus -> [Transport Belt Assembler] -> (Chest) -> [Fast Belt Assembler] -> (Chest) -> [Express Belt Assembler] -> (Chest).
    *   Each assembler pulls raw materials (Gears, Plates) from the bus, and pulls its tiered prerequisite from the chest directly behind it.
4.  **Circuit & Gear Dedicated Production:** Because Gears and Circuits are consumed in such extreme quantities, they should be produced in dedicated, highly-optimized blocks at the start of the mall and belted down the artery, rather than locally crafted on-site.
