// Festival dates for the countdown cards on /time. Static and manually
// maintained, same idea as sponsor-config.js: edit this file to add years or
// correct a date, no code changes needed.
//
// Fields (per festival):
//   name      — display name.
//   tradition — shown under the name.
//   note      — optional one-line note shown on the card.
//   dates     — one entry per year: { date: "YYYY-MM-DD", expected?: true }.
//               `expected: true` marks a date that is tentative (shown as
//               "expected" on the card). Every Islamic date is expected,
//               because the month starts with the sighting of the new moon.
//   expectedLabel — optional wording for the "expected" tag on this festival.
//
// Every date carries a source comment. All sources were read on 11 Oct 2026.
// T&D = timeanddate.com/holidays/<country>/... ; "(Tentative Date)" is
// timeanddate's own label and is why those entries are marked expected.
// The countdown runs to local midnight at the start of the date. Several
// traditions begin the day at sunset the evening before.

export const EXPECTED_ISLAMIC = "expected (subject to moon sighting)";

export const FESTIVALS = [
  {
    name: "Eid al-Fitr",
    tradition: "Islam",
    expectedLabel: EXPECTED_ISLAMIC,
    note: "Date for Saudi Arabia; it can fall a day later elsewhere.",
    dates: [
      { date: "2026-03-20", expected: true }, // T&D saudi-arabia/eid-al-fitr: Fri 20 Mar 2026
      { date: "2027-03-10", expected: true }, // T&D saudi-arabia/eid-al-fitr: Wed 10 Mar 2027 (Tentative Date). The Umm al-Qura calendar computes 9 Mar.
      { date: "2028-02-27", expected: true }, // T&D saudi-arabia/eid-al-fitr: Sun 27 Feb 2028 (Tentative Date). The Umm al-Qura calendar computes 26 Feb.
    ],
  },
  {
    name: "Eid al-Adha",
    tradition: "Islam",
    expectedLabel: EXPECTED_ISLAMIC,
    note: "Date for Saudi Arabia; it can fall a day later elsewhere.",
    dates: [
      { date: "2026-05-27", expected: true }, // T&D saudi-arabia/eid-al-adha: Wed 27 May 2026
      { date: "2027-05-16", expected: true }, // T&D saudi-arabia/eid-al-adha: Sun 16 May 2027 (Tentative Date)
      { date: "2028-05-05", expected: true }, // T&D saudi-arabia/eid-al-adha: Fri 5 May 2028 (Tentative Date)
    ],
  },
  {
    name: "Islamic New Year",
    tradition: "Islam",
    expectedLabel: EXPECTED_ISLAMIC,
    note: "1 Muharram.",
    dates: [
      { date: "2026-06-17", expected: true }, // T&D malaysia/muharram-new-year and indonesia/muharram-new-year: Wed 17 Jun 2026. The Umm al-Qura calendar computes 16 Jun.
      { date: "2027-06-06", expected: true }, // T&D malaysia/muharram-new-year: Sun 6 Jun 2027 (Tentative Date)
      { date: "2028-05-25", expected: true }, // T&D malaysia/muharram-new-year: Thu 25 May 2028 (Tentative Date)
    ],
  },
  {
    name: "Diwali",
    tradition: "Hindu · Jain · Sikh",
    dates: [
      { date: "2026-11-08" }, // T&D india/diwali: Sun 8 Nov 2026
      { date: "2027-10-29" }, // T&D india/diwali: Fri 29 Oct 2027
      { date: "2028-10-17" }, // T&D india/diwali: Tue 17 Oct 2028
    ],
  },
  {
    name: "Holi",
    tradition: "Hindu",
    dates: [
      { date: "2026-03-04" }, // T&D india/holi: Wed 4 Mar 2026
      { date: "2027-03-22" }, // T&D india/holi: Mon 22 Mar 2027
      { date: "2028-03-11" }, // T&D india/holi: Sat 11 Mar 2028
    ],
  },
  {
    name: "Sharad Navratri begins",
    tradition: "Hindu",
    note: "First day of Sharad Navratri.",
    dates: [
      { date: "2026-10-11" }, // T&D india/2026: Sun 11 Oct, First Day of Sharad Navratri
      { date: "2027-09-30" }, // T&D india/2027: Thu 30 Sep, First Day of Sharad Navratri
      { date: "2028-09-19" }, // T&D india/2028: Tue 19 Sep, First Day of Sharad Navratri
    ],
  },
  {
    name: "Christmas",
    tradition: "Christian",
    note: "25 December; churches that follow the Julian calendar keep it on 7 January.",
    dates: [
      { date: "2026-12-25" }, // Fixed date in the Gregorian calendar
      { date: "2027-12-25" }, // Fixed date in the Gregorian calendar
      { date: "2028-12-25" }, // Fixed date in the Gregorian calendar
    ],
  },
  {
    name: "Easter",
    tradition: "Christian",
    note: "Western date; Orthodox Easter is often on a different Sunday.",
    dates: [
      { date: "2026-04-05" }, // T&D us/easter-sunday: Sun 5 Apr 2026
      { date: "2027-03-28" }, // T&D us/easter-sunday: Sun 28 Mar 2027
      { date: "2028-04-16" }, // T&D us/easter-sunday: Sun 16 Apr 2028
    ],
  },
  {
    name: "Rosh Hashanah",
    tradition: "Jewish",
    note: "First day; it begins at sunset the evening before.",
    dates: [
      { date: "2026-09-12" }, // T&D us/rosh-hashana: Sat 12 Sep 2026
      { date: "2027-10-02" }, // T&D us/rosh-hashana: Sat 2 Oct 2027
      { date: "2028-09-21" }, // T&D us/rosh-hashana: Thu 21 Sep 2028
    ],
  },
  {
    name: "Hanukkah",
    tradition: "Jewish",
    note: "First day; it begins at sunset the evening before.",
    dates: [
      { date: "2026-12-05" }, // T&D us/chanukah (first day): Sat 5 Dec 2026
      { date: "2027-12-25" }, // T&D us/chanukah (first day): Sat 25 Dec 2027
      { date: "2028-12-13" }, // T&D us/chanukah (first day): Wed 13 Dec 2028
    ],
  },
  {
    name: "Vaisakhi",
    tradition: "Sikh · Hindu",
    dates: [
      { date: "2026-04-14" }, // T&D india/vaisakhi: Tue 14 Apr 2026
      { date: "2027-04-14" }, // T&D india/vaisakhi: Wed 14 Apr 2027
      { date: "2028-04-13", expected: true }, // drikpanchang.com Mesha Sankranti 2028: Thu 13 Apr 2028 (T&D has no 2028 row yet)
    ],
  },
  {
    name: "Guru Nanak Jayanti",
    tradition: "Sikh",
    dates: [
      { date: "2026-11-24" }, // T&D india/guru-nanak-jayanti: Tue 24 Nov 2026
      { date: "2027-11-14" }, // T&D india/guru-nanak-jayanti: Sun 14 Nov 2027
      { date: "2028-11-02", expected: true }, // dekhopanchang.com Guru Nanak Jayanti / Kartik Purnima 2028: Thu 2 Nov 2028 (T&D has no 2028 row yet; drikpanchang page not reachable)
    ],
  },
  {
    name: "Buddha Purnima / Vesak",
    tradition: "Buddhist",
    note: "Date observed in India; Vesak is kept on other days in some countries.",
    dates: [
      { date: "2026-05-01" }, // T&D india/buddha-purnima: Fri 1 May 2026
      { date: "2027-05-20" }, // T&D india/buddha-purnima: Thu 20 May 2027
      { date: "2028-05-08", expected: true }, // drikpanchang.com Buddha Purnima 2028: Mon 8 May 2028 (T&D has no 2028 row yet)
    ],
  },
  {
    name: "Chinese New Year",
    tradition: "Chinese",
    note: "Also the Lunar New Year in several other countries.",
    dates: [
      { date: "2026-02-17" }, // T&D china/spring-festival: Tue 17 Feb 2026
      { date: "2027-02-06" }, // T&D china/spring-festival: Sat 6 Feb 2027
      { date: "2028-01-26" }, // T&D china/spring-festival: Wed 26 Jan 2028
    ],
  },
  {
    name: "Nowruz",
    tradition: "Persian · Parsi · Central Asian",
    note: "Date in Iran (1 Farvardin); many places mark it on the March equinox.",
    dates: [
      { date: "2026-03-21" }, // T&D iran/norooz: Sat 21 Mar 2026
      { date: "2027-03-21", expected: true }, // Computed: 1 Farvardin 1406 in the Solar Hijri calendar (Intl "persian"); T&D has no 2027 row yet
      { date: "2028-03-20", expected: true }, // Computed: 1 Farvardin 1407 in the Solar Hijri calendar (Intl "persian"); T&D has no 2028 row yet
    ],
  },
];
