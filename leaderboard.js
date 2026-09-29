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
import { resolveCountryName, flagImg, assignRanks } from "./country-utils.js";
import { reportAppCheckError } from "./appcheck-logger.js";

// Read-only page: same Firebase + App Check setup as Home and Milestones. It
// never writes clicks and sets no cww_* keys of its own (it only reads/writes
// the same cww_country session cache Home uses).
const app = initializeApp(firebaseConfig);

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
  isTokenAutoRefreshEnabled: true,
});

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

// --- helpers ---------------------------------------------------------------
const el = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");

// Orbitron's "0" glyph renders as a broken box in this weight when the whole
// run is zeros (same bug already fixed in api/og-image.js) — .num-safe swaps
// to a font proven safe for that case. Never true once a real click lands.
function setNumText(el, text) {
  el.textContent = text;
  el.classList.toggle("num-safe", /^0+$/.test(text));
}
const utcDate = () => new Date().toISOString().slice(0, 10);

function relativeTime(t) {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

// --- state -----------------------------------------------------------------
let countriesData = null; // null until live data arrives
let totalData = null;
let visible = 10;
let myCountry = null;

const statCountries = el("statCountries");
const statTotal = el("statTotal");
const statToday = el("statToday");
const lbList = el("lbList");
const showMoreBtn = el("showMoreBtn");
const youCard = el("youCard");

// Valid countries, sorted by clicks (ties by name), with tied counts sharing a rank (1, 1, 3).
function buildRows() {
  const rows = Object.entries(countriesData || {})
    .filter(([, count]) => typeof count === "number")
    .map(([code, count]) => ({ code, count, name: resolveCountryName(code) }))
    .filter((r) => r.name);
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return assignRanks(rows);
}

function shareText(count) {
  if (!totalData) return "—";
  const pct = Math.min(100, (count / totalData) * 100);
  if (pct >= 10) return pct.toFixed(0) + "%";
  if (pct >= 0.1) return pct.toFixed(1) + "%";
  return "<0.1%";
}

function shareWidth(count) {
  if (!totalData) return 0;
  return Math.max(1, Math.min(100, (count / totalData) * 100));
}

function renderTable(rows) {
  if (countriesData === null) return;
  if (rows.length === 0) {
    lbList.innerHTML = `<li class="tc-empty">No clicks yet. Be the first!</li>`;
    showMoreBtn.hidden = true;
    return;
  }

  lbList.innerHTML = rows
    .slice(0, visible)
    .map(
      (r) => `
      <li class="lb-row">
        <span class="lb-rank${r.rank <= 3 ? " r" + r.rank : ""}">${r.rank}</span>
        ${flagImg(r.code)}
        <span class="lb-name">${r.name}</span>
        <span class="lb-clicks">${fmt(r.count)}</span>
        <span class="lb-bar"><i style="width:${shareWidth(r.count).toFixed(1)}%"></i></span>
        <span class="lb-pct">${shareText(r.count)}</span>
      </li>`
    )
    .join("");

  const remaining = rows.length - visible;
  showMoreBtn.hidden = remaining <= 0;
  showMoreBtn.textContent =
    visible <= 10 ? "Show all countries ↓" : `Show more countries (${Math.max(0, remaining)} more) ↓`;
}

function renderYou(rows) {
  if (!myCountry) return; // country not detected: card stays hidden
  const name = resolveCountryName(myCountry);
  if (!name) return;
  youCard.hidden = false;
  el("youFlag").innerHTML = flagImg(myCountry, "you-flagimg");
  el("youName").textContent = name;
  if (countriesData === null) return; // keep "—" until live data arrives
  const row = rows.find((r) => r.code === myCountry);
  el("youRank").textContent = row ? "#" + row.rank : "—";
  setNumText(el("youClicks"), row ? fmt(row.count) : "0");
}

function renderStats(rows) {
  if (countriesData !== null) statCountries.textContent = fmt(rows.length);
  if (totalData !== null) setNumText(statTotal, fmt(totalData));
}

function renderAll() {
  const rows = buildRows();
  renderStats(rows);
  renderTable(rows);
  renderYou(rows);
}

// Busy periods: the first payload renders immediately, later updates are
// batched to at most one render every 250 ms.
let renderTimer = null;
let firstRenderDone = false;
function scheduleRender() {
  if (!firstRenderDone) {
    firstRenderDone = true;
    renderAll();
    return;
  }
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    renderAll();
  }, 250);
}

onValue(ref(db, "stats/countries"), (snap) => {
  countriesData = snap.val() || {};
  scheduleRender();
});

onValue(ref(db, "stats/total"), (snap) => {
  const v = snap.val();
  if (typeof v !== "number") return;
  totalData = v;
  scheduleRender();
});

showMoreBtn.addEventListener("click", () => {
  visible += 25;
  renderAll();
});

// --- Clicks Today (UTC): stats/daily/<date>, re-subscribed at UTC rollover ---
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

// --- Your Country: /api/geo only (Vercel header) + the same cww_country
// session cache as Home. No ipwho.is here; if it can't be detected the card
// stays hidden. The page writes nothing to Firebase. ---
async function detectCountryGeoOnly() {
  try {
    const cached = sessionStorage.getItem("cww_country");
    if (cached) return cached === "XX" ? null : cached;
  } catch {
    /* storage unavailable */
  }
  try {
    const res = await fetch("/api/geo");
    if (res.ok) {
      const data = await res.json();
      if (data && /^[A-Z]{2}$/.test(data.country || "")) {
        try {
          sessionStorage.setItem("cww_country", data.country);
        } catch {
          /* ignore */
        }
        return data.country;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

detectCountryGeoOnly().then((code) => {
  myCountry = code;
  if (firstRenderDone) renderAll();
  else if (code) renderYou([]);
});

// --- Live Clicks: recentClicks/feed (6-slot ring), newest first ---
const liveList = el("liveList");
let feedEntries = null;
let feedLoaded = false;
const animatedKeys = new Set();

function renderLive() {
  if (feedEntries === null) return;
  if (feedEntries.length === 0) {
    liveList.innerHTML = `<li class="tc-empty">Waiting for the next click…</li>`;
    return;
  }
  liveList.innerHTML = feedEntries
    .map((e) => {
      const isNew = feedLoaded && !animatedKeys.has(e.key);
      animatedKeys.add(e.key);
      const name = resolveCountryName(e.c);
      const who = name ? `Someone in <strong>${name}</strong> just clicked` : "Someone just clicked";
      return `
        <li class="live-row${isNew ? " enter" : ""}">
          <span class="live-dot" aria-hidden="true"></span>
          ${flagImg(name ? e.c : "XX")}
          <span class="live-text">${who}</span>
          <span class="live-time">${relativeTime(e.t)}</span>
        </li>`;
    })
    .join("");
}

onValue(ref(db, "recentClicks/feed"), (snap) => {
  const v = snap.val() || {};
  feedEntries = Object.entries(v)
    .filter(([, e]) => e && typeof e.t === "number" && /^[A-Z]{2}$/.test(e.c || ""))
    .map(([slot, e]) => ({ key: slot + ":" + e.t, c: e.c, t: e.t }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 6);
  renderLive();
  feedLoaded = true;
});
setInterval(renderLive, 10000);

// --- Leaderboard sponsor slot (copy of Home's renderSponsorSlot behaviour) ---
function renderSponsor() {
  const box = el("lbSponsor");
  const cfg = sponsorConfig.leaderboard;
  const tag = document.createElement("span");
  tag.className = "sp-tag";
  tag.textContent = cfg.active ? "sponsored" : "sponsor spot";
  box.append(tag);

  if (cfg.active && cfg.logoUrl) {
    const img = document.createElement("img");
    img.src = cfg.logoUrl;
    img.alt = "";
    img.className = "sp-logo";
    box.append(img);
  }

  const label = cfg.active && cfg.name ? cfg.name : cfg.placeholderText;
  const href = cfg.active ? cfg.link : sponsorConfig.inquiryContact;
  if (href) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    // Internal links (e.g. /sponsor) stay in the same tab; external open a new one.
    if (!href.startsWith("/")) {
      a.target = "_blank";
      a.rel = cfg.active ? "noopener sponsored" : "noopener";
    }
    box.append(a);
  } else {
    const s = document.createElement("span");
    s.textContent = label;
    box.append(s);
  }
}
renderSponsor();
