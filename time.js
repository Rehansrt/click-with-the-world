// /time — world calendars, birthday in every calendar, festival countdowns.
// Everything is computed in the browser with the built-in Intl API. The page
// talks to no service of ours or anyone else's: no Firebase, no fetch.
import { FESTIVALS } from "./festivals-config.js";
import { SITE_START } from "./site-config.js";

const el = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const fmtInt = (n) => n.toLocaleString("en-US");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

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
const NANAKSHAHI_NAMES = NANAKSHAHI_MONTHS.map(([name]) => name);
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
// `tradition` is the label shown under the calendar's name everywhere: on the
// cards, in the birthday results, and in the birthday share text and image.
// kind: "intl" (Intl calendar), "offset" (year derived from another Intl
// calendar, year number only) or "nanakshahi".
const CALENDAR_DEFS = [
  { id: "gregory", kind: "intl", intl: "gregory", name: "Gregorian", short: "Gregorian", tradition: "Christian · Global civil", suffix: "CE",
    started: "1 CE", origin: "traditional count from the birth of Jesus (Anno Domini); Gregorian reform 1582" },
  { id: "islamic", kind: "intl", intl: "islamic-umalqura", name: "Islamic Hijri", short: "Hijri", tradition: "Islamic", suffix: "AH",
    started: "622 CE", origin: "the Hijra (Prophet Muhammad's migration from Mecca to Medina)", solarFrom: 622,
    note: "Based on Umm al-Qura; local moon sighting may differ by ±1 day." },
  { id: "hebrew", kind: "intl", intl: "hebrew", name: "Hebrew", short: "Hebrew", tradition: "Jewish", suffix: "",
    started: "3761 BCE", origin: "traditional count from Creation (Anno Mundi)" },
  { id: "persian", kind: "intl", intl: "persian", name: "Persian (Solar Hijri)", short: "Persian", tradition: "Iranian", suffix: "AP",
    started: "622 CE", origin: "the Hijra, counted in solar years from Nowruz" },
  { id: "shaka", kind: "intl", intl: "indian", name: "Shaka", short: "Shaka", tradition: "Hindu · Indian national", suffix: "Saka", expired: true,
    started: "78 CE", origin: "Shaka era; adopted as India's national calendar in 1957" },
  { id: "vikram", kind: "offset", intl: "indian", offset: 135, name: "Vikram Samvat", short: "Vikram Samvat", tradition: "Hindu", expired: true,
    started: "57 BCE", origin: "traditionally linked to King Vikramaditya", note: SHAKA_NOTE },
  { id: "kali", kind: "offset", intl: "indian", offset: 3179, name: "Kali Yuga", short: "Kali Yuga", tradition: "Hindu", expired: true,
    started: "3102 BCE", origin: "traditional start of the Kali Yuga", note: SHAKA_NOTE },
  { id: "buddhist", kind: "intl", intl: "buddhist", name: "Buddhist", short: "Buddhist", tradition: "Buddhist (Thai)", suffix: "BE",
    started: "543 BCE", origin: "traditional year of the Buddha's Parinirvana (Thai reckoning)",
    note: "Thai reckoning; Sri Lanka/Myanmar count differs by 1 year." },
  { id: "nanakshahi", kind: "nanakshahi", name: "Nanakshahi", short: "Nanakshahi", tradition: "Sikh", suffix: "NS",
    started: "1469 CE", origin: "birth of Guru Nanak Dev Ji; calendar introduced 2003",
    note: "Fixed dates of the original (2003) Nanakshahi calendar." },
  { id: "ethiopic", kind: "intl", intl: "ethiopic", name: "Ethiopian", short: "Ethiopian", tradition: "Ethiopian Orthodox", suffix: "",
    started: "8 CE", origin: "Ethiopian Incarnation era" },
  { id: "chinese", kind: "intl", intl: "chinese", name: "Chinese", short: "Chinese", tradition: "Chinese · East Asian", suffix: "",
    cycle: "Counted in 60-year cycles; no single starting year" },
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

// Completed months since the calendar's own new year: the number of times
// the month changes between the first day of the year and today.
function monthsCompleted(cal, start, today) {
  if (cal.kind === "nanakshahi") return NANAKSHAHI_NAMES.indexOf(cal.parts(today).month);
  let count = 0;
  let prev = cal.parts(start).month;
  for (let d = addDays(start, 1); d <= today; d = addDays(d, 1)) {
    const m = cal.parts(d).month;
    if (m !== prev) {
      count++;
      prev = m;
    }
  }
  return count;
}

// How long the calendar has been counting, in its own years and months.
// Most eras number the year in progress, so the completed years are one fewer
// than the year number; the Indian eras count years already expired. The two
// year-only calendars get years and days, from the approximate year start.
function ageText(cal, today, start) {
  if (cal.cycle) return "";
  const p = cal.parts(today);
  const year = p.year + (cal.offset || 0);
  const years = cal.expired ? year : year - 1;
  if (cal.kind === "offset") return `Age: ${plural(years, "year")}, ${plural(daysBetween(start, today), "day")} (approximate)`;
  return `Age: ${plural(years, "year")}, ${plural(monthsCompleted(cal, start, today), "month")}, ${plural(p.day - 1, "day")}`;
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
      <p class="t-origin">${cal.cycle ? cal.cycle : `<b>Started:</b> ${cal.started} — ${cal.origin}`}</p>
      ${cal.cycle ? "" : '<p class="t-ageline"></p>'}
      ${cal.solarFrom ? '<p class="t-ageline t-solar"></p>' : ""}
      ${cal.id === "chinese" ? '<p class="t-note t-cycle"></p>' : ""}
      ${cal.note ? `<p class="t-note">${cal.note}</p>` : ""}`;
    grid.append(card);
    return {
      cal,
      dateEl: card.querySelector(".t-date"),
      numEl: card.querySelector(".t-num"),
      ageEl: card.querySelector(".t-ageline"),
      solarEl: card.querySelector(".t-solar"),
      cycleEl: card.querySelector(".t-cycle"),
      start: null,
    };
  });

  tickers.push((now) => {
    // Dates, year starts and ages only change when the local day does.
    if (!today || dayKey(today) !== dayKey(now)) {
      today = startOfDay(now);
      for (const c of cards) {
        c.dateEl.textContent = dateText(c.cal, today);
        c.start = yearStart(c.cal, today);
        if (c.ageEl) c.ageEl.textContent = ageText(c.cal, today, c.start);
        if (c.solarEl) c.solarEl.textContent = `≈ ${today.getFullYear() - c.cal.solarFrom} solar years`;
        if (c.cycleEl) {
          const p = c.cal.parts(today);
          c.cycleEl.textContent = `Cycle name ${p.yearName}; the year began in ${p.year} CE.`;
        }
      }
    }
    for (const c of cards) c.numEl.textContent = durationText(now - c.start);
  });
}

// ---------- this website's age ----------
const SITE_START_DATE = new Date(SITE_START);
// Day 1 is the first 24 hours after the start.
const siteDay = (now) => Math.floor((now - SITE_START_DATE) / 86400000) + 1;

function setupSiteAge() {
  const out = el("siteAge");
  const since = el("siteSince");
  if (!out || Number.isNaN(SITE_START_DATE.getTime())) return;
  // The start date is written as it reads in India, where the counter began.
  const startText = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(SITE_START_DATE);
  since.textContent = `Counting since ${startText} — the day the world counter started from zero.`;
  tickers.push((now) => {
    if (now < SITE_START_DATE) {
      out.textContent = "—";
      return;
    }
    const [y, mo, d, h, mi, s] = ageParts(SITE_START_DATE, now);
    const bits = [];
    if (y) bits.push(plural(y, "year"));
    if (mo) bits.push(plural(mo, "month"));
    bits.push(plural(d, "day"));
    out.textContent = `${bits.join(", ")}, ${pad(h)}:${pad(mi)}:${pad(s)}`;
  });
}

// ---------- sharing ----------
// Share text and images are built here, in the browser. The link is always
// the plain page address: nothing about the visitor is ever put in a URL of
// this site.
const SHARE_URL = "https://www.clickwiththeworld.fun/time";
const IMG_W = 1080;
const IMG_H = 1350;

// The canvas uses the site's own fonts; wait briefly for them, then draw anyway.
function fontsReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const wanted = ['700 64px "Space Grotesk"', '600 34px "Inter"', '400 30px "Inter"'];
  return Promise.race([
    Promise.all(wanted.map((f) => document.fonts.load(f))).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}

// Right-to-left scripts (Arabic, Urdu, Persian, Hebrew...).
const RTL_TEXT = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;

// Draws one 1080x1350 share card: a title, an optional subtitle, an optional
// highlighted line, a list of rows, and the site name with the page address.
// A row is [label, value] or [label, value, sublabel]; the sublabel is drawn
// smaller and dimmer under the label. The title can be a visitor's name in
// any script.
function drawCard(canvas, { title, subtitle, highlight, rows }) {
  canvas.width = IMG_W;
  canvas.height = IMG_H;
  const ctx = canvas.getContext("2d");
  // The site's heading font first; names in other scripts fall through to
  // whatever system font has the glyphs.
  const HEAD = '"Space Grotesk", "Inter", system-ui, "Segoe UI", "Nirmala UI", "Noto Sans", "Noto Sans Devanagari", "Noto Naskh Arabic", "Noto Nastaliq Urdu", Tahoma, Arial, sans-serif';
  const BODY = '"Inter", system-ui, sans-serif';
  const M = 84;

  const bg = ctx.createLinearGradient(0, 0, 0, IMG_H);
  bg.addColorStop(0, "#09183e");
  bg.addColorStop(1, "#040c24");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, IMG_W, IMG_H);
  const glow = ctx.createRadialGradient(IMG_W * 0.8, 120, 0, IMG_W * 0.8, 120, 620);
  glow.addColorStop(0, "rgba(39, 211, 255, 0.22)");
  glow.addColorStop(1, "rgba(39, 211, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, IMG_W, IMG_H);

  ctx.save();
  ctx.shadowColor = "rgba(39, 211, 255, 0.55)";
  ctx.shadowBlur = 34;
  ctx.strokeStyle = "rgba(39, 211, 255, 0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(36, 36, IMG_W - 72, IMG_H - 72, 36);
  else ctx.rect(36, 36, IMG_W - 72, IMG_H - 72);
  ctx.stroke();
  ctx.restore();

  // Shrinks a font until the text fits the given width.
  const fit = (text, weight, size, family, maxWidth, min = 20) => {
    let px = size;
    do {
      ctx.font = `${weight} ${px}px ${family}`;
      if (ctx.measureText(text).width <= maxWidth) break;
      px -= 2;
    } while (px > min);
    return px;
  };

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#9fb6d9";
  ctx.font = `600 26px ${BODY}`;
  ctx.fillText("CLICK WITH THE WORLD", M, 132);

  // The title is shrunk to fit on one line; a right-to-left name is drawn
  // with the canvas direction set to match.
  ctx.fillStyle = "#eaf6ff";
  ctx.textAlign = "left";
  ctx.direction = RTL_TEXT.test(title) ? "rtl" : "ltr";
  let titlePx = fit(title, 700, 70, HEAD, IMG_W - 2 * M);
  let y = subtitle ? 226 : 218;
  if (subtitle) {
    // A name can be in a script that stands taller or hangs lower than Latin
    // letters; shrink it until it clears the label above and the subtitle below.
    for (;;) {
      const m = ctx.measureText(title);
      if (titlePx <= 28 || ((m.actualBoundingBoxAscent || 0) <= 70 && (m.actualBoundingBoxDescent || 0) <= 20)) break;
      titlePx -= 2;
      ctx.font = `700 ${titlePx}px ${HEAD}`;
    }
  }
  ctx.fillText(title, M, y);
  ctx.direction = "ltr";

  if (subtitle) {
    y += 50;
    ctx.fillStyle = "#d3e3f8";
    ctx.font = `600 34px ${BODY}`;
    ctx.fillText(subtitle, M, y);
  }
  let top = y + (subtitle ? 40 : 44);
  if (highlight) {
    y += subtitle ? 48 : 72;
    ctx.fillStyle = "#27d3ff";
    fit(highlight, 600, 36, BODY, IMG_W - 2 * M);
    ctx.fillText(highlight, M, y);
    top = y + (subtitle ? 38 : 40);
  }

  const bottom = IMG_H - 220;
  const rowH = Math.min(96, (bottom - top) / rows.length);
  rows.forEach(([label, value, sub], i) => {
    const y = top + rowH * i;
    ctx.strokeStyle = "rgba(39, 211, 255, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(IMG_W - M, y);
    ctx.stroke();
    const base = y + rowH / 2 + 12;
    ctx.textAlign = "left";
    ctx.fillStyle = "#9fb6d9";
    ctx.font = `400 30px ${BODY}`;
    // With a sublabel the label moves up and the two lines share the row.
    ctx.fillText(label, M, sub ? base - 16 : base);
    let labelWidth = ctx.measureText(label).width;
    if (sub) {
      ctx.fillStyle = "rgba(159, 182, 217, 0.72)";
      ctx.font = `400 22px ${BODY}`;
      ctx.fillText(sub, M, base + 16);
      labelWidth = Math.max(labelWidth, ctx.measureText(sub).width);
    }
    // The value is shrunk to whatever room the label column leaves.
    ctx.textAlign = "right";
    ctx.fillStyle = "#eaf6ff";
    fit(value, 600, 34, BODY, IMG_W - 2 * M - labelWidth - 36);
    ctx.fillText(value, IMG_W - M, base);
  });
  ctx.textAlign = "left";

  ctx.fillStyle = "#eaf6ff";
  ctx.font = `700 40px ${HEAD}`;
  ctx.fillText("Click With The World", M, IMG_H - 132);
  ctx.fillStyle = "#27d3ff";
  ctx.font = `600 32px ${BODY}`;
  ctx.fillText("clickwiththeworld.fun/time", M, IMG_H - 84);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.append(box);
      box.select();
      const ok = document.execCommand("copy");
      box.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// Wires one share panel: a text preview, an image preview, and the three
// buttons. `build()` returns { text, card, fileName } for the current state;
// the preview always shows exactly that text and that image.
function setupSharePanel(root, build) {
  const pre = root.querySelector(".t-preview");
  const canvas = root.querySelector("canvas");
  const status = root.querySelector(".t-share-status");
  let current = null;
  let drawn = 0;

  const say = (message) => {
    status.textContent = message;
    if (message) setTimeout(() => { if (status.textContent === message) status.textContent = ""; }, 2500);
  };

  async function refresh() {
    current = build();
    if (!current) return;
    pre.textContent = current.text;
    const mine = ++drawn;
    await fontsReady();
    if (mine === drawn) drawCard(canvas, current.card);
  }

  root.querySelector('[data-share="native"]').addEventListener("click", async () => {
    if (!current) return;
    if (navigator.share) {
      try {
        await navigator.share({ text: current.text });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // the visitor closed the share sheet
      }
    }
    say((await copyText(current.text)) ? "Copied!" : "Couldn't copy. Select the text above instead.");
  });

  root.querySelector('[data-share="whatsapp"]').addEventListener("click", () => {
    if (!current) return;
    window.open("https://wa.me/?text=" + encodeURIComponent(current.text), "_blank", "noopener");
  });

  root.querySelector('[data-share="image"]').addEventListener("click", async () => {
    if (!current) return;
    await refresh();
    canvas.toBlob((blob) => {
      if (!blob) return say("Couldn't create the image.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = current.fileName;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      say("Image saved.");
    }, "image/png");
  });

  return refresh;
}

function setupTodayShare() {
  const button = el("todayShareBtn");
  const panel = el("todayShare");
  const count = CALENDARS.length;
  button.textContent = `Share today in ${count} calendars`;

  const refresh = setupSharePanel(panel, () => {
    const now = new Date();
    const today = startOfDay(now);
    const rows = CALENDARS.map((cal) => [cal.short, dateText(cal, today)]);
    rows.push(["Click With The World", `Day ${siteDay(now)}`]);
    return {
      text: [`Today in ${count} calendars 🌍`, ...rows.map(([k, v]) => `${k}: ${v}`), `See yours: ${SHARE_URL}`].join("\n"),
      card: { title: "Today around the world", rows },
      fileName: "today-around-the-world.png",
    };
  });

  let shownFor = null;
  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) {
      shownFor = dayKey(new Date());
      refresh();
    }
  });
  // Keep an open panel right when the day rolls over.
  tickers.push((now) => {
    if (!panel.hidden && shownFor !== dayKey(now)) {
      shownFor = dayKey(now);
      refresh();
    }
  });
}

// ---------- section 3: your birthday ----------
// One entry holds everything the birthday tool remembers: { d, t, n } =
// date of birth, time of birth and the optional name.
const DOB_KEY = "cww_time_dob";
const NAME_MAX = 30;
// Trimmed and cut to 30 characters (counted as whole characters, so a name in
// any script is never cut in the middle of one).
const cleanName = (value) => [...String(value || "").trim()].slice(0, NAME_MAX).join("").trim();
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
  const hideYear = el("hideYear");
  const nameInput = el("uname");
  const shareCount = BIRTHDAY_CALENDARS.length;
  let name = "";

  // What the Share row sends: the birth date in each Intl calendar. With
  // "Hide my birth year" on, the year and the age are left out of both the
  // text and the image.
  const refreshShare = setupSharePanel(el("bdayShare"), () => {
    if (!birth) return null;
    const hide = hideYear.checked;
    const rows = BIRTHDAY_CALENDARS.map((cal) => {
      const p = cal.parts(birth);
      return [cal.short, hide ? `${p.day} ${tidyMonth(p.month)}` : dateText(cal, birth), cal.tradition];
    });
    const [y, mo, d] = ageParts(birth, new Date());
    const heading = name ? `${name} — birthday in ${shareCount} calendars` : `My birthday in ${shareCount} calendars`;
    return {
      text: [`${heading} 🌍`, ...rows.map(([k, v, sub]) => `${k} (${sub}): ${v}`), `Find yours: ${SHARE_URL}`].join("\n"),
      card: {
        // With a name, the name is the big title and the rest moves to a subtitle.
        title: name || `My birthday in ${shareCount} calendars`,
        subtitle: name ? `Birthday in ${shareCount} calendars` : "",
        highlight: hide ? "" : `Age: ${plural(y, "year")}, ${plural(mo, "month")}, ${plural(d, "day")}`,
        rows,
      },
      fileName: `my-birthday-in-${shareCount}-calendars.png`,
    };
  });
  hideYear.addEventListener("change", refreshShare);

  // The name can be typed or changed after the results are showing; the share
  // preview follows it, and it is remembered with the date of birth.
  nameInput.addEventListener("input", () => {
    name = cleanName(nameInput.value);
    if (!birth) return;
    saveDob({ d: dobInput.value, t: tobInput.value, n: name });
    refreshShare();
  });

  const todayIso = () => {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  };
  dobInput.max = todayIso();

  function renderStatic(now) {
    const today = startOfDay(now);
    renderedDay = dayKey(today);

    el("bornRows").innerHTML = CALENDARS.map(
      (cal) => `<li><span class="t-k">${cal.short}<small>${cal.tradition}</small></span><span class="t-v">${dateText(cal, birth)}</span></li>`
    ).join("");

    el("nextRows").innerHTML = BIRTHDAY_CALENDARS.map((cal) => {
      const n = nextBirthday(cal, birth, today);
      if (!n) return "";
      const inDays = daysBetween(today, n.date);
      const when = inDays === 0 ? "today" : inDays === 1 ? "tomorrow" : `in ${fmtInt(inDays)} days`;
      return `<li>
        <span class="t-k">${cal.short}<small>${cal.tradition}</small></span>
        <span class="t-v">${GREG_LONG.format(n.date)} <em>${when}</em>
          <small>${dateText(cal, n.date)}${n.turning > 0 ? ` · turning ${fmtInt(n.turning)}` : ""}</small>
          ${n.note ? `<small class="t-warn">${n.note}</small>` : ""}
        </span>
      </li>`;
    }).join("");

    refreshShare();
  }

  function show(v) {
    name = cleanName(v.n);
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
    const v = { d: dobInput.value, t: tobInput.value, n: cleanName(nameInput.value) };
    nameInput.value = v.n;
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
    name = "";
    hideYear.checked = false;
    form.reset();
    errorEl.hidden = true;
    out.hidden = true;
  });

  const saved = loadDob();
  if (saved) {
    nameInput.value = cleanName(saved.n);
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

setupSiteAge();
buildCalendarCards();
setupTodayShare();
setupBirthday();
setupFestivals();
tick(); // fill everything in once, even if the tab starts out hidden
if (document.visibilityState !== "hidden") startTicking();
