// Milestone inventory for /sponsor's "Milestone Inventory" section.
// Static and manually maintained — values are a subset of MILESTONE_LADDER
// (milestone-ladder.js); keep them in sync by hand, same as milestones.html's
// ladder rows. No fake sponsor entries: sponsor stays null until a real
// partner signs on.
//
// status: "Available" | "Reserved" | "Active" | "Completed"
export const PARTNER_INVENTORY = [
  { milestone: 100000, status: "Available", sponsor: null },
  { milestone: 500000, status: "Available", sponsor: null },
  { milestone: 1000000, status: "Available", sponsor: null },
  { milestone: 5000000, status: "Available", sponsor: null },
  { milestone: 10000000, status: "Available", sponsor: null },
  { milestone: 100000000, status: "Available", sponsor: null },
];
