// Deterministic one-module rebuild. The generator is shared with the bounded
// search, but this entry point fixes the tested Military attempt and output
// directory so publication cannot silently select a different layout.
process.env.STARTER_ATTEMPTS=process.env.STARTER_ATTEMPTS||'186';
process.env.OUT_ROOT=process.env.OUT_ROOT||'.cache/military-iron-priority';
await import('./generate-military-layout-candidates.mjs');
