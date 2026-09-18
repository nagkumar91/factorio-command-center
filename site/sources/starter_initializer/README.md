# Starter Initializer (Factorio 2.0)

This mod gives players a configurable startup inventory. It can:

- give every producible item and fluid (`all-producible`)
- give only a custom list of item/fluid entries (`custom-only`)
- give both (`all-and-custom`)

Version 0.2.6 uses manual grants by default. It does not create starter chests or
fluid tanks automatically. Upgrading from an older version also disables the
saved automatic-grant setting once. Restart Factorio and load your save to apply
the upgrade. Existing chests and tanks are preserved.

New maps explicitly start with automatic grants off, including installations
that saved `true` as a global preference in an older version. If wanted later,
you can enable automatic grants under Per map settings after the map loads.

## Files

- `info.json`
- `settings.lua`
- `control.lua`
- `locale/en/starter_initializer.cfg`

## Install

1. Copy the `starter_initializer` folder into your Factorio mods directory:
   - macOS: `~/Library/Application Support/factorio/mods/`
2. Zip the folder as `starter_initializer_0.2.6.zip` (or keep as unpacked folder for development).
3. Start Factorio and enable the mod.

## Configure

In game:

1. Open `Settings -> Mod settings -> Per map`.
2. Set `Initialization mode` to one of:
   - `all-producible`
   - `custom-only`
   - `all-and-custom`
3. Set `Count per all-producible item`.
4. Set `Amount per all-producible fluid`.
5. Optionally set `Custom starter entries`:
   - Format: `item-name=count,item-name=count`
   - Count is optional (uses `Default amount for custom entries` if omitted).
   - Works for both item names and fluid names.
   - Example: `iron-plate=1000,copper-plate=1000,assembling-machine-1=20,water=25000`

Notes:

- Items are placed into nearby `steel-chest` entities.
- Fluids are spawned into `storage-tank` entities placed near the player.
- If the amount is larger than one tank capacity, the mod places multiple tanks for that fluid.

## Commands

- `/starter_init_grant` -> grant starter entries to yourself (or all players when run from server console)
- `/starter_init_grant <player-name>` -> grant starter entries to a specific player

Use this command after changing settings if you want to re-apply immediately.
