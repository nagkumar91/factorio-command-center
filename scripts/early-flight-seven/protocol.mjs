// Phases and rules of the early-flight-seven native protocol, shared by the validator and the unit tests.
// The blocked hold is three hours: the assembling-machine-2 workshop (wired 18 x 60 layout) keeps making AM1 onto its
// long AM1 belt for between two and three hours after its chest fills (screens at 30, 120, 180, 270, 360 and 480 min), and the
// hold must last until every inlet has stopped. Recovery after that hold must reach recoveryShare of each floor.
// The warm-up is four hours: after 30 minutes the red-splitter workshop is still filling its circuit and splitter
// buffers and measures 0.33 per minute, against 0.80 to 0.82 once settled (screen with a 240-minute warm-up).
export const protocol = {warmupMinutes: 240, measureMinutes: 60, blockedMinutes: 180, blockedTailMinutes: 5, settleMinutes: 10, recoveryMinutes: 60, recoveryShare: 0.95};
