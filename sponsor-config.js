// Sponsorship slots — placeholder-only for now. To bring on a real sponsor,
// just fill in the fields for the relevant slot and flip `active` to true.
// No code changes needed: app.js reads this file and swaps the placeholder
// for the real name/logo/link automatically.
//
// Fields (per slot):
//   active          — false shows the "sponsor this spot" placeholder (linking to
//                     inquiryContact below); true shows the real sponsor instead.
//   name            — sponsor's display name.
//   logoUrl         — small square-ish logo, ~32x32 works best (svg/png).
//   link            — where the badge links to once active (opened in a new tab).
//   placeholderText — shown while active is false.
//
// inquiryContact — where the placeholder's "Your brand here" link points, for
// anyone who clicks it wanting to become the sponsor. Swap for a real inbox or
// a dedicated inquiry page whenever one exists — it's just a URL either way.

export const sponsorConfig = {
  inquiryContact: "mailto:sponsor@clickwiththeworld.fun",

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
