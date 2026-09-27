// Milestones whose first-reached time is recorded at stats/milestones/<value>.
// The database rules hard-code exactly these keys (a rules formula can't
// compare a key string to the numeric total), so keep the two in sync:
// adding a milestone means editing this list AND database.rules.json.
export const MILESTONE_LADDER = [
  1000,
  10000,
  100000,
  500000,
  1000000,
  5000000,
  10000000,
  100000000,
];
