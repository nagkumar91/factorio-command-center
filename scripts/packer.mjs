// Node-only adapter: development tools use the same plain JS as the browser.
import '../site/lib/packer.js';
export const { MAX_CHESTS, CHEST_HELP, PRESETS, normalizeEntries, planCrates, crateSlots, generateCrateCommand, generateGiveCommand } = globalThis.FactorioPacker;
