// The summary block of a native report, computed from the run reports (never typed in): per scenario and phase, what every exit gave and
// every entrance took per minute over the measured window, and the recovery times. Used by validate.mjs and by the generators.
export function summarize(report, manifest) {
  const outputs = manifest.outputPorts, inputs = manifest.inputPorts;
  const round = (v, d = 2) => v === undefined ? undefined : Math.round(v * 10 ** d) / 10 ** d;
  const phases = {};
  for (const [mode, run] of Object.entries(report.runs)) {
    phases[mode] = {};
    for (const ph of run.phases) {
      phases[mode][ph.name] = {
        measuredMinutes: ph.measuredMinutes,
        outputsPerMinute: Object.fromEntries(outputs.map(o => [o.item, round(ph.drawnPerMinute[o.id]?.measured ?? 0)])),
        inputsPerMinute: Object.fromEntries(inputs.map(i => [i.item, round(ph.fedPerMinute[i.id]?.measured ?? 0, 1)])),
        consumedPerMinute: Object.fromEntries(inputs.map(i => [i.item, round(ph.consumedPerMinute[i.id] ?? 0, 1)])),
        ...(ph.recovery ? { recoverySeconds: Object.fromEntries(outputs.filter(o => ph.recovery[o.id]).map(o => [o.item, ph.recovery[o.id].secondsToReach])) } : {}),
      };
    }
  }
  const steady = {};
  // (a scenario without a "steady" phase, such as a shortened build or placement run, has no entry here)
  for (const mode of Object.keys(phases)) if (phases[mode].steady) steady[mode] = { outputsPerMinute: phases[mode].steady.outputsPerMinute, inputsPerMinute: phases[mode].steady.inputsPerMinute };
  // The published draw is the throttled run's own (the entrances took exactly the panel figure); the generous run shows what the blueprint takes when offered more.
  return { phases, steady, outputsPerMinute: steady.throttled?.outputsPerMinute ?? Object.values(steady)[0]?.outputsPerMinute, inputsPerMinute: steady.throttled?.inputsPerMinute ?? Object.values(steady)[0]?.inputsPerMinute };
}
