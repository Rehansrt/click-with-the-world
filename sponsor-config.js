// Sponsorship slots — placeholder-only for now. To bring on a real sponsor,
// just fill in the fields for the relevant slot and flip `active` to true.
// No code changes needed: app.js reads this file and swaps the placeholder
// for the real name/logo/link automatically.
//
// Fields:
//   active          — false shows the "sponsor this spot" placeholder; true shows the sponsor.
//   name            — sponsor's display name.
//   logoUrl         — small square-ish logo, ~32x32 works best (svg/png).
//   link            — where the badge links to (opened in a new tab).
//   placeholderText — shown while active is false.

export const sponsorConfig = {
  milestone: {
    active: false,
    name: "",
    logoUrl: "",
    link: "",
    placeholderText: "Your brand here — Sponsor this milestone",
  },
  leaderboard: {
    active: false,
    name: "",
    logoUrl: "",
    link: "",
    placeholderText: "Your brand here — Sponsor the leaderboard",
  },
};
