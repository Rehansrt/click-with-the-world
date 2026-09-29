import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken,
  onTokenChanged,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import {
  getDatabase,
  ref,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { firebaseConfig, recaptchaSiteKey } from "./firebase-config.js";
import { sponsorConfig } from "./sponsor-config.js";
import { resolveCountryName } from "./country-utils.js";
import { reportAppCheckError } from "./appcheck-logger.js";
import { MILESTONE_LADDER } from "./milestone-ladder.js";

// Read-only page: same Firebase + App Check setup as Home (app.js) so every
// request carries a token, but it never writes clicks and stores no cww_* keys.
const app = initializeApp(firebaseConfig);

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
  isTokenAutoRefreshEnabled: true,
});

// Wait for the first token so the database connection doesn't open without
// one; fail open if App Check is unavailable (enforcement is off).
try {
  await getToken(appCheck);
} catch (err) {
  console.error("[AppCheck] getToken threw:", { code: err && err.code, message: err && err.message });
  reportAppCheckError(app, err);
}

onTokenChanged(appCheck, {
  next: () => {},
  error: (err) => {
    console.error("[AppCheck] background refresh failed:", { code: err && err.code, message: err && err.message });
    reportAppCheckError(app, err);
  },
});

const db = getDatabase(app);

// --- milestone logic -------------------------------------------------------
// Must stay in sync with app.js milestoneStep.
function milestoneStep(total) {
  if (total < 1000) return 100;
  if (total < 10000) return 1000;
  if (total < 100000) return 10000;
  if (total < 1000000) return 100000;
  return 1000000;
}

const BIG_STEP = 1000000; // milestone sponsor slot only applies to 1,000,000 multiples

const el = (id) => document.getElementById(id);
const gaugeFill = el("gaugeFill");
const msTarget = el("msTarget");
const msStart = el("msStart");
const msEnd = el("msEnd");
const msNote = el("msNote");
const msPct = el("msPct");
const totalDisplay = el("totalDisplay");
const statCountries = el("statCountries");
const statToday = el("statToday");
const rows = [...document.querySelectorAll("#ladder .j-row")];

// Rows are static HTML (crawlable), not generated from MILESTONE_LADDER — this
// just checks they still match so the two can't silently drift apart again.
{
  const htmlValues = rows.map((r) => Number(r.dataset.m));
  const ladderValues = MILESTONE_LADDER.slice();
  const inSync =
    htmlValues.length === ladderValues.length &&
    htmlValues.every((v, i) => v === ladderValues[i]);
  if (!inSync) {
    console.warn("[milestones] HTML rows out of sync with MILESTONE_LADDER", {
      html: htmlValues,
      ladder: ladderValues,
    });
  }
}

const fmt = (n) => n.toLocaleString("en-US");

// Orbitron's "0" glyph renders as a broken box in this weight when the whole
// run is zeros (same bug already fixed in api/og-image.js) — .num-safe swaps
// to a font proven safe for that case. Never true once a real click lands.
function setNumText(el, text) {
  el.textContent = text;
  el.classList.toggle("num-safe", /^0+$/.test(text));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "27 Sep 2026", always UTC, date only.
function formatUtcDate(ms) {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// stats/milestones/<value> = when that milestone was first recorded (written by
// Home and the embed widget; this page only reads it).
let milestoneTimes = {};
let lastTotal = null;
const utcDate = () => new Date().toISOString().slice(0, 10);

const ICONS = {
  reached:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  progress: '<span class="j-dot" aria-hidden="true"></span>',
  locked:
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
};
const LABELS = { reached: "Reached", progress: "In progress", locked: "Locked" };

function buildSponsorLine(active) {
  const box = document.createElement("div");
  box.className = "j-sponsor";
  const tag = document.createElement("span");
  tag.className = "sp-tag";

  const cfg = sponsorConfig.milestone;
  if (active && cfg.active) {
    tag.textContent = "sponsored";
    box.append(tag);
    if (cfg.logoUrl) {
      const img = document.createElement("img");
      img.src = cfg.logoUrl;
      img.alt = "";
      img.className = "sp-logo";
      box.append(img);
    }
    const label = cfg.name || cfg.placeholderText;
    if (cfg.link) {
      const a = document.createElement("a");
      a.href = cfg.link;
      a.textContent = label;
      a.target = "_blank";
      a.rel = "noopener sponsored";
      box.append(a);
    } else {
      const s = document.createElement("span");
      s.textContent = label;
      box.append(s);
    }
    return box;
  }

  tag.textContent = "sponsor spot";
  const msg = document.createElement("span");
  msg.textContent = "Coming later — available as we approach 1,000,000";
  const link = document.createElement("a");
  link.href = "/sponsor"; // internal: same tab
  link.textContent = "Register interest →";
  box.append(tag, msg, link);
  return box;
}

function renderLadder(total) {
  const firstUnreached = rows.find((r) => total < Number(r.dataset.m));
  // With the sponsor slot active it shows on the next 1,000,000-multiple row only.
  const nextBigRow = rows.find((r) => Number(r.dataset.m) % BIG_STEP === 0 && total < Number(r.dataset.m));

  rows.forEach((row) => {
    const m = Number(row.dataset.m);
    const state = total >= m ? "reached" : row === firstUnreached ? "progress" : "locked";
    row.className = "j-row is-" + state;
    row.querySelector(".j-mark").innerHTML = ICONS[state];
    row.querySelector(".j-chip").textContent = LABELS[state];

    // "Reached on <date>" only when a recorded time exists; otherwise nothing.
    const oldDate = row.querySelector(".j-date");
    if (oldDate) oldDate.remove();
    const ts = milestoneTimes[String(m)];
    if (state === "reached" && typeof ts === "number") {
      const small = document.createElement("small");
      small.className = "j-date";
      small.textContent = "Reached on " + formatUtcDate(ts);
      row.querySelector(".j-num").append(small);
    }

    const old = row.querySelector(".j-sponsor");
    if (old) old.remove();
    if (m % BIG_STEP === 0) {
      const isActiveRow = row === nextBigRow;
      if (sponsorConfig.milestone.active) {
        if (isActiveRow) row.append(buildSponsorLine(true));
      } else if (state !== "reached") {
        row.append(buildSponsorLine(false));
      }
    }
  });
}

function render(total) {
  const step = milestoneStep(total);
  const target = Math.floor(total / step) * step + step;
  const start = target - step;
  const progress = Math.max(0, Math.min(100, ((total - start) / step) * 100));

  lastTotal = total;
  setNumText(totalDisplay, fmt(total));
  msTarget.textContent = fmt(target);
  msStart.textContent = fmt(start);
  msEnd.textContent = fmt(target);
  msNote.textContent = fmt(target - total) + " clicks to go";
  msPct.textContent = Math.floor(progress) + "%";
  gaugeFill.style.width = progress + "%";
  renderLadder(total);
}

onValue(ref(db, "stats/total"), (snap) => {
  const total = snap.val();
  if (typeof total !== "number") return; // keep "—" until real data arrives
  render(total);
});

onValue(ref(db, "stats/milestones"), (snap) => {
  milestoneTimes = snap.val() || {};
  if (lastTotal !== null) renderLadder(lastTotal);
});

onValue(ref(db, "stats/countries"), (snap) => {
  const countries = snap.val() || {};
  // Same resolved-name count as Leaderboard and Home (a made-up code that
  // passes the rules but isn't a real country doesn't count here either).
  statCountries.textContent = fmt(
    Object.keys(countries).filter((c) => resolveCountryName(c)).length
  );
});

// Clicks Today (UTC): stats/daily/<date>, re-subscribed when the UTC date rolls over.
let dailyDate = null;
let dailyUnsub = null;
function watchDaily() {
  const d = utcDate();
  if (d === dailyDate) return;
  dailyDate = d;
  if (dailyUnsub) dailyUnsub();
  dailyUnsub = onValue(ref(db, `stats/daily/${d}`), (snap) => {
    statToday.textContent = fmt(snap.val() || 0);
  });
}
watchDaily();
setInterval(watchDaily, 30000);
