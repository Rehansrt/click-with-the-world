// Shared by Home (app.js), Leaderboard (leaderboard.js) and Milestones
// (milestones.js). Pure extraction from leaderboard.js — no behavior change.

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

// Returns the country's name, or null when the code isn't a real country.
// The database rules accept any two capital letters, so made-up codes can
// exist; those (and "XX" = undetected) resolve to null here, display-side
// only — the underlying data and writes are unaffected.
export function resolveCountryName(code) {
  if (typeof code !== "string" || !/^[A-Z]{2}$/.test(code) || code === "XX") return null;
  if (!regionNames) return null;
  try {
    const name = regionNames.of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

export function flagImg(code, cls = "flag") {
  const c = /^[A-Z]{2}$/.test(code || "") ? code.toLowerCase() : "xx";
  return `<img class="${cls}" src="/flags/${c}.svg" alt="" width="28" height="21" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/flags/xx.svg'">`;
}

// Assigns 1-based ranks to rows already sorted by count descending; tied
// counts share the same rank (1, 1, 3), matching Leaderboard's original logic.
export function assignRanks(rows) {
  rows.forEach((r, i) => {
    r.rank = i > 0 && r.count === rows[i - 1].count ? rows[i - 1].rank : i + 1;
  });
  return rows;
}
