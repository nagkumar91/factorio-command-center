// Phases and rules of the Early Flight mall native protocol, shared by the validator, the generator and the unit tests.
// They are the early-flight-seven protocol (written for the same production cells), unchanged:
// the blocked hold is three hours because the assembling-machine-2 cell keeps making AM1 onto its long AM1 belt for two
// to three hours after its chest fills, and the hold must last until every inlet has stopped; recovery after the hold
// must reach recoveryShare of each floor. The warm-up is four hours because the red-splitter cell is still filling its
// circuit and splitter buffers after 30 minutes.
export const protocol = {warmupMinutes: 240, measureMinutes: 60, blockedMinutes: 180, blockedTailMinutes: 5, settleMinutes: 10, recoveryMinutes: 60, recoveryShare: 0.95};
