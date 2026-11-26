// The summary block of a native report, computed from the scenario reports (never typed in). Used by validate.mjs, the generator,
// the README and the tests.
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
export function summarize(scenarios, manifest) {
  const product = manifest.outputPorts.find(o => o.product), stone = manifest.outputPorts.find(o => o.byproduct);
  const steady = name => {
    const run = scenarios[name]; if (!run) return undefined;
    const ph = run.phases.find(p => p.name === 'steady'); if (!ph) return undefined;
    return {
      productPerMinute: r2(ph.drawnPerMinute[product.id].measured), stonePerMinute: r2(ph.drawnPerMinute[stone.id].measured), measuredMinutes: ph.measuredMinutes,
      drawPerMinute: Object.fromEntries(manifest.inputPorts.map(i => [i.item, r1(ph.fedPerMinute[i.id].measured)])),
      productByMinute: { least: Math.min(...ph.productMinutes), most: Math.max(...ph.productMinutes) },
      groups: Object.fromEntries(Object.entries(ph.groups).map(([g, v]) => [g, { machines: v.machines, craftsPerMinute: r1(v.craftsPerMinute), workingShare: r2((v.statusSeconds.working || 0) / Object.values(v.statusSeconds).reduce((a, b) => a + b, 0)) }])),
      madePerMinute: Object.fromEntries(Object.entries(ph.madePerMinute).map(([k, v]) => [k, r1(v)])),
    };
  };
  const list = Object.entries(scenarios).map(([name, run]) => {
    const phases = Array.isArray(run.phases) ? run.phases : [];
    const reached = phases.filter(p => p.mode === 'until_rate').map(p => ({ phase: p.name, seconds: p.reachedSeconds ?? null }));
    const holdPhase = phases.filter(p => p.name === 'ten measured minutes at the rate').pop();
    return { scenario: name, length: run.length, description: run.description, passed: run.passed === true, gameMinutes: r1(run.actualTicks / 3600), reached,
      holdPerMinute: holdPhase ? r2(holdPhase.drawnPerMinute[product.id].measured) : undefined,
      foreignFluids: (Array.isArray(run.fluidFaults) ? run.fluidFaults : []).length, joinedBoxes: (Array.isArray(run.portJoins) ? run.portJoins : []).length,
      ...(run.construction ? { builtInMinutes: r1(run.construction.ticks / 3600), deferred: run.construction.deferred } : {}),
      stopped: phases.filter(p => p.stoppedCleanly !== undefined).map(p => ({ phase: p.name, stoppedCleanly: p.stoppedCleanly })) };
  });
  return { target: manifest.target, floor: r2(manifest.target * 0.95), generous: steady('rate:generous'), throttled: steady('rate:throttled'), scenarios: list };
}
