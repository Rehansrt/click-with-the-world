// /time — world calendars, birthday in every calendar, festival countdowns.
// Everything is computed in the browser with the built-in Intl API. The page
// talks to no service of ours or anyone else's: no Firebase, no fetch.
import { FESTIVALS } from "./festivals-config.js";

const el = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const fmtInt = (n) => n.toLocaleString("en-US");

// ---------- date helpers (local time; calendar days start at local midnight) ----------
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Dates are formatted at local noon so a daylight-saving shift can't tip them
// into the neighbouring day.
const atNoon = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);

function splitDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    clock: `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`,
  };
}
const durationText = (ms) => {
  const { days, clock } = splitDuration(ms);
  return `${fmtInt(days)} ${days === 1 ? "day" : "days"} ${clock}`;
};

const GREG_LONG = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

// ---------- calendars ----------
const SUPPORTED = (() => {
  try {
    return new Set(Intl.supportedValuesOf("calendar"));
  } catch {
    return null; // very old browser: fall back to checking each formatter
  }
})();

function makeIntl(calendar) {
  if (SUPPORTED && !SUPPORTED.has(calendar)) return null;
  try {
    const fmt = new Intl.DateTimeFormat(`en-u-ca-${calendar}-nu-latn`, { day: "numeric", month: "long", year: "numeric" });
    if (fmt.resolvedOptions().calendar !== calendar) return null;
    return fmt;
  } catch {
    return null;
  }
}

// { day, month, year } for a date in one Intl calendar. The Chinese calendar
// has no year number of its own in Intl; it reports the related Gregorian
// year plus the name of the year in the sixty-year cycle.
function intlParts(fmt, date) {
  const o = {};
  for (const p of fmt.formatToParts(atNoon(date))) if (p.type !== "literal") o[p.type] = p.value;
  return { day: Number(o.day), month: o.month, year: Number(o.year ?? o.relatedYear), yearName: o.yearName || "" };
}

const ZODIAC = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
const ELEMENTS = ["Wood", "Fire", "Earth", "Metal", "Water"];
function chineseYearName(relatedYear) {
  const n = (((relatedYear - 4) % 60) + 60) % 60;
  return `${ELEMENTS[Math.floor((n % 10) / 2)]} ${ZODIAC[n % 12]}`;
}
// Intl marks a leap month as e.g. "Sixth Monthbis".
const tidyMonth = (m) => (/bis$/.test(m) ? "Leap " + m.replace(/bis$/, "") : m);

// Nanakshahi (original 2003 version): fixed month starts in the Gregorian
// calendar, year 1 = 1469 CE, new year on 14 March.
// Source: en.wikipedia.org/wiki/Nanakshahi_calendar (read 11 Oct 2026).
const NANAKSHAHI_MONTHS = [
  ["Chet", 2, 14], ["Vaisakh", 3, 14], ["Jeth", 4, 15], ["Harh", 5, 15],
  ["Sawan", 6, 16], ["Bhadon", 7, 16], ["Assu", 8, 15], ["Katak", 9, 15],
  ["Maghar", 10, 14], ["Poh", 11, 14], ["Magh", 0, 13], ["Phagun", 1, 12],
];
function nanakshahiParts(date) {
  const d = startOfDay(date);
  const gy = d.getFullYear();
  const afterNewYear = d >= new Date(gy, 2, 14);
  let best = null;
  for (const [name, m, day] of NANAKSHAHI_MONTHS) {
    for (const y of [gy - 1, gy]) {
      const start = new Date(y, m, day);
      if (start <= d && (!best || start > best.start)) best = { name, start };
    }
  }
  return { day: daysBetween(best.start, d) + 1, month: best.name, year: afterNewYear ? gy - 1468 : gy - 1469, yearName: "" };
}

const SHAKA_NOTE = "Approximate year change; the traditional new year (Chaitra Shukla Pratipada) follows the lunar calendar.";

// One entry per card. All cards share one design; the order is not a ranking.
// kind: "intl" (Intl calendar), "offset" (year derived from another Intl
// calendar, year number only) or "nanakshahi".
const CALENDAR_DEFS = [
  { id: "gregory", kind: "intl", intl: "gregory", name: "Gregorian", tradition: "Common Era · Christian", suffix: "CE" },
  { id: "islamic", kind: "intl", intl: "islamic-umalqura", name: "Islamic Hijri", tradition: "Islam", suffix: "AH", note: "Based on Umm al-Qura; local moon sighting may differ by ±1 day." },
  { id: "hebrew", kind: "intl", intl: "hebrew", name: "Hebrew", tradition: "Jewish", suffix: "" },
  { id: "persian", kind: "intl", intl: "persian", name: "Persian (Solar Hijri)", tradition: "Iran · Afghanistan", suffix: "AP" },
  { id: "shaka", kind: "intl", intl: "indian", name: "Shaka", tradition: "Hindu · Indian National Calendar", suffix: "Saka" },
  { id: "vikram", kind: "offset", intl: "indian", offset: 135, name: "Vikram Samvat", tradition: "Hindu", note: SHAKA_NOTE },
  { id: "kali", kind: "offset", intl: "indian", offset: 3179, name: "Kali Yuga", tradition: "Hindu", note: SHAKA_NOTE },
  { id: "buddhist", kind: "intl", intl: "buddhist", name: "Buddhist", tradition: "Buddhism", suffix: "BE", note: "Thai reckoning; Sri Lanka/Myanmar count differs by 1 year." },
  { id: "nanakshahi", kind: "nanakshahi", name: "Nanakshahi", tradition: "Sikh", suffix: "NS", note: "Fixed dates of the original (2003) Nanakshahi calendar." },
  { id: "ethiopic", kind: "intl", intl: "ethiopic", name: "Ethiopian", tradition: "Ethiopia · Eritrea", suffix: "" },
  { id: "chinese", kind: "intl", intl: "chinese", name: "Chinese", tradition: "Chinese lunisolar", suffix: "" },
];

// Calendars the browser can't do are dropped here, so their cards never render.
const CALENDARS = CALENDAR_DEFS.map((def) => {
  if (def.kind === "nanakshahi") return { ...def, parts: nanakshahiParts };
  const fmt = makeIntl(def.intl);
  if (!fmt) return null;
  return { ...def, fmt, parts: (date) => intlParts(fmt, date) };
}).filter(Boolean);

function yearOf(cal, date) {
  return cal.parts(date).year + (cal.offset || 0);
}

function dateText(cal, date) {
  const p = cal.parts(date);
  if (cal.kind === "offset") return `Year ${p.year + cal.offset}`;
  if (cal.id === "chinese") return `${p.day} ${tidyMonth(p.month)}, Year of the ${chineseYearName(p.year)}`;
  return `${p.day} ${p.month} ${p.year}${cal.suffix ? " " + cal.suffix : ""}`;
}

// Step back one day at a time until the year number changes.
function yearStart(cal, today) {
  const year = yearOf(cal, today);
  let d = startOfDay(today);
  for (let i = 0; i < 400; i++) {
    const prev = addDays(d, -1);
    if (yearOf(cal, prev) !== year) break;
    d = prev;
  }
  return d;
}

// ---------- one shared ticker ----------
// Every live number on the page registers a function here; a single
// 1-second interval runs them all, and it stops while the tab is hidden.
const tickers = [];
let timerId = null;
function tick() {
  const now = new Date();
  for (const fn of tickers) fn(now);
}
function startTicking() {
  if (timerId !== null) return;
  tick();
  timerId = setInterval(tick, 1000);
}
function stopTicking() {
  if (timerId === null) return;
  clearInterval(timerId);
  timerId = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") stopTicking();
  else startTicking();
});

// ---------- section 2: the year right now ----------
function buildCalendarCards() {
  const grid = el("calGrid");
  let today = null;
  const cards = CALENDARS.map((cal) => {
    const card = document.createElement("article");
    card.className = "t-card";
    card.innerHTML = `
      <h3>${cal.name}</h3>
      <p class="t-trad">${cal.tradition}</p>
      <p class="t-date"></p>
      <p class="t-timer"><span class="t-num"></span><small>into this year</small></p>
      ${cal.id === "chinese" ? '<p class="t-note t-cycle"></p>' : ""}
      ${cal.note ? `<p class="t-note">${cal.note}</p>` : ""}`;
    grid.append(card);
    return { cal, dateEl: card.querySelector(".t-date"), numEl: card.querySelector(".t-num"), cycleEl: card.querySelector(".t-cycle"), start: null };
  });

  tickers.push((now) => {
    // Dates and year starts only change when the local day does.
    if (!today || dayKey(today) !== dayKey(now)) {
      today = startOfDay(now);
      for (const c of cards) {
        c.dateEl.textContent = dateText(c.cal, today);
        c.start = yearStart(c.cal, today);
        if (c.cycleEl) {
          const p = c.cal.parts(today);
          c.cycleEl.textContent = `Cycle name ${p.yearName}; the year began in ${p.year} CE.`;
        }
      }
    }
    for (const c of cards) c.numEl.textContent = durationText(now - c.start);
  });
}

// ---------- section 3: your birthday ----------
const DOB_KEY = "cww_time_dob";
const BIRTHDAY_CALENDARS = CALENDARS.filter((c) => c.kind === "intl");

function loadDob() {
  try {
    const raw = localStorage.getItem(DOB_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.d === "string" ? v : null;
  } catch {
    return null;
  }
}
function saveDob(v) {
  try {
    localStorage.setItem(DOB_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable: the page still works, it just won't remember */
  }
}
function clearDob() {
  try {
    localStorage.removeItem(DOB_KEY);
  } catch {
    /* ignore */
  }
}

function parseBirth(d, t) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
  if (!m) return null;
  const tm = /^(\d{2}):(\d{2})$/.exec(t || "");
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), tm ? Number(tm[1]) : 0, tm ? Number(tm[2]) : 0);
  date.setFullYear(Number(m[1])); // years below 100 would otherwise be read as 19xx
  if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(m[2]) - 1) return null;
  return date;
}

function ageParts(birth, now) {
  let y = now.getFullYear() - birth.getFullYear();
  let mo = now.getMonth() - birth.getMonth();
  let d = now.getDate() - birth.getDate();
  let h = now.getHours() - birth.getHours();
  let mi = now.getMinutes() - birth.getMinutes();
  let s = now.getSeconds() - birth.getSeconds();
  if (s < 0) { s += 60; mi--; }
  if (mi < 0) { mi += 60; h--; }
  if (h < 0) { h += 24; d--; }
  if (d < 0) { d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); mo--; }
  if (mo < 0) { mo += 12; y--; }
  return [y, mo, d, h, mi, s];
}

// Month names with the leap marker removed, so a leap month can stand in for
// the regular one ("Sixth Monthbis" / "Sixth Month") and, in the Hebrew
// calendar only, "Adar I" / "Adar II" / "Adar" can stand in for one another.
function plainMonth(cal, m) {
  const base = m.replace(/bis$/, "");
  return cal.id === "hebrew" ? base.replace(/ I{1,2}$/, "") : base;
}

// The next birthday in one calendar: the next day whose month and day match
// the birth date. Looks through the coming 420 days, which always covers a
// full year of any of these calendars. When the exact day or month doesn't
// occur that year, the nearest valid day is used and a note says so.
function nextBirthday(cal, birth, today) {
  const b = cal.parts(birth);
  // Runs of consecutive days in one month, in date order.
  const runs = [];
  for (let i = 0; i < 420; i++) {
    const date = addDays(today, i);
    const x = { date, ...cal.parts(date) };
    const last = runs[runs.length - 1];
    if (last && last[0].month === x.month && last[0].year === x.year) last.push(x);
    else runs.push([x]);
  }
  // The birthday inside one month: the exact day, or the month's last day
  // when that month is too short. Nothing if the day has already gone by.
  const dayIn = (run) => {
    const exact = run.find((x) => x.day === b.day);
    if (exact) return { hit: exact, exact: true };
    const end = run[run.length - 1];
    return end.day < b.day ? { hit: end, exact: false } : null;
  };
  const done = (hit, note) => ({ date: hit.date, note, turning: hit.year - b.year });

  const sameMonth = runs.filter((run) => run[0].month === b.month);
  for (const run of sameMonth) {
    const r = dayIn(run);
    if (r) return done(r.hit, r.exact ? "" : `No day ${b.day} in ${tidyMonth(b.month)} that year; the nearest day is shown.`);
  }
  if (sameMonth.length) return null;

  // The month itself doesn't occur (a leap-month birthday, or Adar in a
  // Hebrew leap year, where birthdays are kept in Adar II).
  let candidates = runs.filter((run) => plainMonth(cal, run[0].month) === plainMonth(cal, b.month));
  if (cal.id === "hebrew" && b.month === "Adar") {
    const second = candidates.filter((run) => run[0].month === "Adar II");
    if (second.length) candidates = second;
  }
  for (const run of candidates) {
    const r = dayIn(run);
    if (r) return done(r.hit, `No ${tidyMonth(b.month)} that year; ${tidyMonth(r.hit.month)} is used.`);
  }
  return null;
}

function setupBirthday() {
  const form = el("dobForm");
  const dobInput = el("dob");
  const tobInput = el("tob");
  const errorEl = el("dobError");
  const out = el("bdayOut");
  const ageNums = [...document.querySelectorAll("#ageGrid strong")];
  const ageUnits = [...document.querySelectorAll("#ageGrid span")];
  const UNIT_NAMES = ["year", "month", "day", "hour", "minute", "second"];
  let birth = null;
  let renderedDay = null;

  const todayIso = () => {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  };
  dobInput.max = todayIso();

  function renderStatic(now) {
    const today = startOfDay(now);
    renderedDay = dayKey(today);

    el("bornRows").innerHTML = CALENDARS.map(
      (cal) => `<li><span class="t-k">${cal.name}</span><span class="t-v">${dateText(cal, birth)}</span></li>`
    ).join("");

    el("nextRows").innerHTML = BIRTHDAY_CALENDARS.map((cal) => {
      const n = nextBirthday(cal, birth, today);
      if (!n) return "";
      const inDays = daysBetween(today, n.date);
      const when = inDays === 0 ? "today" : inDays === 1 ? "tomorrow" : `in ${fmtInt(inDays)} days`;
      return `<li>
        <span class="t-k">${cal.name}</span>
        <span class="t-v">${GREG_LONG.format(n.date)} <em>${when}</em>
          <small>${dateText(cal, n.date)}${n.turning > 0 ? ` · turning ${fmtInt(n.turning)}` : ""}</small>
          ${n.note ? `<small class="t-warn">${n.note}</small>` : ""}
        </span>
      </li>`;
    }).join("");
  }

  function show(v) {
    birth = parseBirth(v.d, v.t);
    if (!birth || birth > new Date()) {
      birth = null;
      out.hidden = true;
      return false;
    }
    out.hidden = false;
    renderStatic(new Date());
    tick();
    return true;
  }

  tickers.push((now) => {
    if (!birth) return;
    if (renderedDay !== dayKey(now)) renderStatic(now);
    ageParts(birth, now).forEach((n, i) => {
      ageNums[i].textContent = i > 2 ? pad(n) : String(n);
      ageUnits[i].textContent = UNIT_NAMES[i] + (n === 1 ? "" : "s");
    });
    const ms = now - birth;
    const days = Math.floor(ms / 86400000);
    el("livedDays").textContent = fmtInt(days);
    el("livedSeconds").textContent = fmtInt(Math.floor(ms / 1000));
    el("marsYears").textContent = (ms / 86400000 / 687).toFixed(2);
    el("jupiterYears").textContent = (ms / 86400000 / 4333).toFixed(2);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = { d: dobInput.value, t: tobInput.value };
    if (!show(v)) {
      errorEl.textContent = "Enter a date of birth that is not in the future.";
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    saveDob(v);
  });

  el("dobClear").addEventListener("click", () => {
    clearDob();
    birth = null;
    form.reset();
    errorEl.hidden = true;
    out.hidden = true;
  });

  const saved = loadDob();
  if (saved) {
    dobInput.value = saved.d;
    tobInput.value = saved.t || "";
    if (!show(saved)) clearDob();
  }
}

// ---------- section 4: festival countdowns ----------
function setupFestivals() {
  const grid = el("festGrid");
  const parse = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const items = FESTIVALS.map((f) => {
    const card = document.createElement("article");
    card.className = "t-card";
    card.innerHTML = `
      <h3>${f.name}</h3>
      <p class="t-trad">${f.tradition}</p>
      <p class="t-date"></p>
      <p class="t-timer"><span class="t-num"></span><small></small></p>
      <p class="t-tag" hidden></p>
      ${f.note ? `<p class="t-note">${f.note}</p>` : ""}`;
    return {
      f,
      card,
      dates: f.dates.map((d) => ({ ...d, at: parse(d.date) })).sort((a, b) => a.at - b.at),
      dateEl: card.querySelector(".t-date"),
      numEl: card.querySelector(".t-num"),
      unitEl: card.querySelector(".t-timer small"),
      tagEl: card.querySelector(".t-tag"),
      next: null,
    };
  });

  let plannedFor = null;
  // Pick each festival's next date (today counts until the day ends) and put
  // the soonest first. Runs at load and again whenever the local day changes.
  function plan(now) {
    const today = startOfDay(now);
    plannedFor = dayKey(today);
    for (const it of items) {
      it.next = it.dates.find((d) => d.at >= today) || null;
      if (it.next) {
        it.dateEl.textContent = GREG_LONG.format(it.next.at);
        it.tagEl.hidden = !it.next.expected;
        it.tagEl.textContent = it.next.expected ? it.f.expectedLabel || "expected" : "";
      } else {
        it.dateEl.textContent = "Next date to be added";
        it.numEl.textContent = "—";
        it.unitEl.textContent = "";
        it.tagEl.hidden = true;
      }
    }
    items.sort((a, b) => (a.next ? a.next.at : Infinity) - (b.next ? b.next.at : Infinity));
    grid.replaceChildren(...items.map((it) => it.card));
  }

  tickers.push((now) => {
    if (plannedFor !== dayKey(now)) plan(now);
    for (const it of items) {
      if (!it.next) continue;
      const ms = it.next.at - now;
      if (ms <= 0) {
        it.numEl.textContent = "Today";
        it.unitEl.textContent = "";
      } else {
        it.numEl.textContent = durationText(ms);
        it.unitEl.textContent = "to go";
      }
    }
  });
}

buildCalendarCards();
setupBirthday();
setupFestivals();
tick(); // fill everything in once, even if the tab starts out hidden
if (document.visibilityState !== "hidden") startTicking();
