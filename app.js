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
  update,
  increment,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { firebaseConfig, recaptchaSiteKey } from "./firebase-config.js";
import { sponsorConfig } from "./sponsor-config.js";
import { isLive } from "./site-shell.js";
import { resolveCountryName, flagImg, assignRanks } from "./country-utils.js";
import { reportAppCheckError } from "./appcheck-logger.js";

const app = initializeApp(firebaseConfig);

// Must run before any other Firebase service (getDatabase, etc.) is touched —
// App Check attaches itself to the app instance and every subsequent SDK call
// picks up its token automatically. No UI, no user-visible prompt: reCAPTCHA
// Enterprise runs its risk assessment silently in the background.
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
  isTokenAutoRefreshEnabled: true,
});

// initializeAppCheck() returns immediately, but the reCAPTCHA challenge that
// produces the first token is async (real network round trip). getDatabase()
// opens the RTDB WebSocket connection right away too, so without waiting
// here, that connection can be established before a valid token exists —
// showing up as "invalid"/"outdated client" in App Check's metrics for the
// entire page session, even though nothing is actually broken. Waiting here
// closes that race; failing open (no token) rather than blocking the app if
// App Check itself is ever unavailable, since enforcement is off regardless.
console.log("[AppCheck] calling getToken(appCheck)…");
try {
  const result = await getToken(appCheck);
  console.log("[AppCheck] getToken resolved:", {
    tokenLength: result.token ? result.token.length : 0,
    tokenPreview: result.token ? result.token.slice(0, 12) + "…" : null,
  });
} catch (err) {
  console.error("[AppCheck] getToken threw:", {
    code: err && err.code,
    message: err && err.message,
    customData: err && err.customData,
    full: err,
  });
  reportAppCheckError(app, err);
  /* proceed without a pre-fetched token — not a hard dependency */
}

// isTokenAutoRefreshEnabled means the SDK re-runs the whole reCAPTCHA
// challenge periodically in the background (roughly every ~55 min, ahead of
// the token's ~1hr expiry) for as long as the tab stays open — each of those
// is an independent network round trip to Google's reCAPTCHA servers, so any
// one of them can fail for reasons the initial page-load fetch never hits.
// This logs every one of those background attempts, not just the first.
onTokenChanged(appCheck, {
  next: (result) => {
    console.log("[AppCheck] onTokenChanged (background refresh) succeeded:", {
      tokenLength: result.token ? result.token.length : 0,
      time: new Date().toISOString(),
    });
  },
  error: (err) => {
    console.error("[AppCheck] onTokenChanged (background refresh) failed:", {
      code: err && err.code,
      message: err && err.message,
      time: new Date().toISOString(),
    });
    reportAppCheckError(app, err);
  },
});

const db = getDatabase(app);

// Records each milestone's first-reached time (separate observer writes; the
// click update below is untouched). Dynamic import so a failure here can never
// break the page.
import("./milestone-recorder.js")
  .then((m) => m.startMilestoneRecorder(db))
  .catch(() => {});

const totalRef = ref(db, "stats/total");
const countriesRef = ref(db, "stats/countries");
const latestClickRef = ref(db, "recentClicks/latest");

const countDisplay = document.getElementById("countDisplay");
const clickBtn = document.getElementById("clickBtn");
const ticker = document.getElementById("ticker");
const gaugeFill = document.getElementById("gaugeFill");
const milestoneNote = document.getElementById("milestoneNote");
const milestoneTarget = document.getElementById("milestoneTarget");
const leaderboardList = document.getElementById("leaderboardList");
const shareBtn = document.getElementById("shareBtn");
const milestoneSponsor = document.getElementById("milestoneSponsor");
const leaderboardSponsor = document.getElementById("leaderboardSponsor");
const muteBtn = document.getElementById("muteBtn");
const milestoneStart = document.getElementById("milestoneStart");
const milestonePct = document.getElementById("milestonePct");
const statCountries = document.getElementById("statCountries");
const statToday = document.getElementById("statToday");
const liveList = document.getElementById("liveList");
const fullLeaderboardLink = document.getElementById("fullLeaderboardLink");
const sponsorPromoBtn = document.getElementById("sponsorPromoBtn");

// --- interaction-layer state (purely cosmetic — see click handler for why
// none of this ever touches the Firebase write amount) ---
const GOLDEN_CHANCE = 0.02; // ~1-in-50 clicks
const COMBO_WINDOW_MS = 700;
let comboCount = 0;
let lastClickTime = 0;
let isMuted = localStorage.getItem("cww_muted") === "1";
let goldenFoundCount = parseInt(localStorage.getItem("cww_golden_found") || "0", 10) || 0;
let audioCtx = null;

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

function countryName(iso2) {
  if (!iso2 || iso2 === "XX") return "somewhere in the world";
  try {
    return regionNames ? regionNames.of(iso2) : iso2;
  } catch {
    return iso2;
  }
}

function flagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2 || iso2 === "XX") return "\u{1F30D}";
  return String.fromCodePoint(
    ...[...iso2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))
  );
}

function formatCount(n) {
  return n.toLocaleString("en-US");
}

function utcDate() {
  return new Date().toISOString().slice(0, 10);
}

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

// --- mute toggle (persisted) ---
function updateMuteButton() {
  muteBtn.textContent = isMuted ? "🔇" : "🔊";
  muteBtn.setAttribute("aria-label", isMuted ? "Unmute click sound" : "Mute click sound");
  muteBtn.title = isMuted ? "Unmute click sound" : "Mute click sound";
}
updateMuteButton();

muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  localStorage.setItem("cww_muted", isMuted ? "1" : "0");
  updateMuteButton();
});

// --- personal "golden clicks found" stat — local only, never synced ---
const goldenStat = document.createElement("p");
goldenStat.className = "golden-stat";
goldenStat.hidden = true;
ticker.insertAdjacentElement("afterend", goldenStat);

function renderGoldenStat() {
  if (goldenFoundCount <= 0) return;
  goldenStat.hidden = false;
  goldenStat.textContent = `✨ ${goldenFoundCount} golden click${goldenFoundCount === 1 ? "" : "s"} found`;
}
renderGoldenStat();

// --- click sound: short synthesized tone, Web Audio only (no audio files) ---
function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playClickSound(combo, golden) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const baseFreq = golden ? 660 : 440;
  const freq = baseFreq + Math.min(combo, 20) * 14;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = golden ? "triangle" : "sine";
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.16);

  if (golden) {
    // second, higher chime layered on top for a distinct "sparkle" sound
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(freq * 1.5, now + 0.05);
    gain2.gain.setValueAtTime(0.0001, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.14, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.24);
  }
}

// Renders one sponsor slot from sponsor-config.js. Placeholder state links to
// sponsorConfig.inquiryContact (so it reads as an intentional, clickable ad
// slot rather than dead text); active state links to the sponsor's own URL.
// Swapping a slot over never requires touching this code, only
// sponsor-config.js.
function renderSponsorSlot(el, config) {
  const logo = config.active && config.logoUrl
    ? `<img class="sponsor-logo" src="${config.logoUrl}" alt="">`
    : "";
  const tag = config.active ? "sponsored" : "sponsor this spot";
  const label = config.active && config.name ? config.name : config.placeholderText;
  const href = config.active ? config.link : sponsorConfig.inquiryContact;
  // Internal links (e.g. /sponsor) open in the same tab; external ones in a new tab.
  const internal = typeof href === "string" && href.startsWith("/");
  const rel = config.active ? "noopener sponsored" : "noopener";
  const attrs = internal ? "" : ` target="_blank" rel="${rel}"`;
  const text = href
    ? `<a class="sponsor-link" href="${href}"${attrs}>${label}</a>`
    : `<span class="sponsor-text">${label}</span>`;

  el.innerHTML = `<span class="sponsor-tag">${tag}</span>${logo}${text}`;
}

// Resolve the visitor's country once per session. Tries the Vercel edge geo
// endpoint first (works once deployed), then falls back to a keyless IP
// lookup for local development.
async function detectCountry() {
  const cached = sessionStorage.getItem("cww_country");
  if (cached) return cached;

  let code = "XX";
  try {
    const res = await fetch("/api/geo");
    if (res.ok) {
      const data = await res.json();
      if (data.country) code = data.country;
    }
  } catch {
    /* ignore — fall through to backup lookup */
  }

  if (code === "XX") {
    try {
      const res = await fetch("https://ipwho.is/");
      if (res.ok) {
        const data = await res.json();
        if (data.country_code) code = data.country_code;
      }
    } catch {
      /* ignore — stays "XX" (shown as a globe / "somewhere") */
    }
  }

  sessionStorage.setItem("cww_country", code);
  return code;
}

const countryPromise = detectCountry();

// Interim client-side rate-limit stopgap while App Check enforcement stays
// off (blocked on firebase/firebase-js-sdk#10385). Not a security boundary —
// this ID lives in localStorage and anyone can fabricate a fresh one — it
// only needs to persist per browser so the clientCooldowns/$clientId rule
// (see database.rules.json) can reject a second write from the same client
// within COOLDOWN_MS. The real fix is still App Check.
const COOLDOWN_MS = 800;

function getClientId() {
  let id = localStorage.getItem("cww_client_id");
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
    localStorage.setItem("cww_client_id", id);
  }
  return id;
}

const clientId = getClientId();

let currentTotal = null;

function milestoneStep(total) {
  if (total < 1000) return 100;
  if (total < 10000) return 1000;
  if (total < 100000) return 10000;
  if (total < 1000000) return 100000;
  return 1000000;
}

const BIG_MILESTONE_STEP = 1000000;

// Tracks the next milestone boundary as of the last render, so we can detect
// the moment `total` actually crosses it — reuses the exact same thresholds
// the gauge already shows (100, 200, …, 1000, 2000, …), nothing invented.
// Stays null until the first real render so page load never "celebrates" a
// milestone that was already passed before this visitor arrived.
let nextMilestoneTarget = null;

function updateMilestone(total) {
  const step = milestoneStep(total);
  const target = Math.floor(total / step) * step + step;
  const remaining = target - total;
  const progress = ((total - (target - step)) / step) * 100;

  milestoneTarget.textContent = formatCount(target);
  milestoneStart.textContent = formatCount(target - step);
  gaugeFill.style.width = Math.max(0, Math.min(100, progress)) + "%";
  milestonePct.textContent = Math.floor(Math.max(0, Math.min(100, progress))) + "%";
  milestoneNote.textContent = formatCount(remaining) + " clicks to go";

  // Only show the milestone sponsor slot for "big" milestones (every 1M,
  // matching the gauge's own top-tier step size) — not every small one on
  // the way there.
  if (target % BIG_MILESTONE_STEP === 0) {
    milestoneSponsor.hidden = false;
    renderSponsorSlot(milestoneSponsor, sponsorConfig.milestone);
  } else {
    milestoneSponsor.hidden = true;
  }

  if (nextMilestoneTarget !== null) {
    while (total >= nextMilestoneTarget) {
      celebrateMilestone(nextMilestoneTarget);
      nextMilestoneTarget += milestoneStep(nextMilestoneTarget);
    }
  } else {
    nextMilestoneTarget = target;
  }
}

// Animates the visible count from its current value to `target` over ~300ms
// (ease-out) instead of jumping instantly, every time the real-time listener
// reports a new total. Purely cosmetic — the underlying value is already
// correct the instant this starts.
let displayedTotal = 0;
let rollupRaf = null;
let rollupFallbackTimer = null;
let rollupToken = 0;

// Orbitron's "0" glyph renders as a broken box in this weight when the whole
// run is zeros (same bug already fixed in api/og-image.js) — .num-safe swaps
// to a font proven safe for that case. Never true once a real click lands.
function setCountText(text) {
  countDisplay.textContent = text;
  countDisplay.classList.toggle("num-safe", /^0+$/.test(text));
}

function animateCountTo(target) {
  const start = displayedTotal;
  const startTime = performance.now();
  const duration = 300;
  const myToken = ++rollupToken;

  if (rollupRaf) cancelAnimationFrame(rollupRaf);
  if (rollupFallbackTimer) clearTimeout(rollupFallbackTimer);

  function commitFinal() {
    if (myToken !== rollupToken) return; // a newer update superseded this one
    displayedTotal = target;
    setCountText(formatCount(target));
  }

  function step(now) {
    if (myToken !== rollupToken) return;
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(start + (target - start) * eased);
    displayedTotal = value;
    setCountText(formatCount(value));

    if (t < 1) {
      rollupRaf = requestAnimationFrame(step);
    } else {
      commitFinal();
    }
  }

  rollupRaf = requestAnimationFrame(step);

  // Safety net: rAF legitimately pauses on backgrounded tabs (and in some
  // constrained/automated environments doesn't fire at all), which would
  // otherwise leave the displayed count stuck mid-animation indefinitely.
  // setTimeout still fires (if throttled) in the background, so this
  // guarantees the correct final value always lands even if the animation
  // itself never gets to play.
  rollupFallbackTimer = setTimeout(commitFinal, duration + 120);
}

let hasRenderedCount = false;

function renderCount(total) {
  if (!hasRenderedCount) {
    // First render of the page — set instantly, no roll-up from 0.
    hasRenderedCount = true;
    setCountText(formatCount(total));
    displayedTotal = total;
  } else {
    animateCountTo(total);
  }
  updateMilestone(total);
}

// Same resolved-name filter and tie-sharing ranks as Leaderboard (see
// country-utils.js) — a code that can't be resolved to a real country (e.g.
// "XX", or a made-up two-letter code) stays out of both the ranking and the
// Countries count.
function renderLeaderboard(countries) {
  const rows = Object.entries(countries || {})
    .filter(([, count]) => typeof count === "number")
    .map(([code, count]) => ({ code, count, name: resolveCountryName(code) }))
    .filter((r) => r.name);
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  assignRanks(rows);

  statCountries.textContent = formatCount(rows.length);

  const top = rows.slice(0, 5);
  if (top.length === 0) {
    leaderboardList.innerHTML = `<li class="tc-empty">No clicks yet. Be the first!</li>`;
    return;
  }

  leaderboardList.innerHTML = top
    .map(
      (r) => `
        <li class="tc-row">
          <span class="tc-rank">${r.rank}</span>
          ${flagImg(r.code)}
          <span class="tc-name">${r.name}</span>
          <span class="tc-count">${formatCount(r.count)}</span>
        </li>`
    )
    .join("");
}

renderSponsorSlot(leaderboardSponsor, sponsorConfig.leaderboard);

let currentCountries = {};

onValue(totalRef, (snap) => {
  currentTotal = snap.val() || 0;
  renderCount(currentTotal);
});

onValue(countriesRef, (snap) => {
  currentCountries = snap.val() || {};
  renderLeaderboard(currentCountries);
});

onValue(latestClickRef, (snap) => {
  const data = snap.val();
  if (!data) return;
  ticker.textContent = `${flagEmoji(data.country)} someone in ${countryName(data.country)} just clicked`;
});

// --- "Clicks Today (UTC)": one counter per UTC day at stats/daily/<date>.
// Re-subscribes when the UTC date rolls over while the page stays open. ---
let dailyDate = null;
let dailyUnsub = null;
function watchDaily() {
  const d = utcDate();
  if (d === dailyDate) return;
  dailyDate = d;
  if (dailyUnsub) dailyUnsub();
  dailyUnsub = onValue(ref(db, `stats/daily/${d}`), (snap) => {
    statToday.textContent = formatCount(snap.val() || 0);
  });
}
watchDaily();
setInterval(watchDaily, 30000);

// --- Live Clicks: recentClicks/feed is a 6-slot ring (slot = newTotal % 6),
// each slot {c: country, t: server timestamp}. Sorted newest-first here. ---
let feedEntries = [];
let feedLoaded = false;
const animatedFeedKeys = new Set();

function renderLive() {
  if (feedEntries.length === 0) {
    liveList.innerHTML = `<li class="tc-empty">Waiting for the next click…</li>`;
    return;
  }
  liveList.innerHTML = feedEntries
    .map((e) => {
      const isNew = feedLoaded && !animatedFeedKeys.has(e.key);
      animatedFeedKeys.add(e.key);
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

// Links to pages that don't exist yet stay hidden (see site-shell.js PAGES).
fullLeaderboardLink.hidden = !isLive("/leaderboard");
if (isLive("/sponsor")) {
  sponsorPromoBtn.href = "/sponsor";
  sponsorPromoBtn.hidden = false;
} else if (sponsorConfig.inquiryContact) {
  sponsorPromoBtn.href = sponsorConfig.inquiryContact;
  sponsorPromoBtn.hidden = false;
}

// Radiates `count` particles outward from (x, y) in a full circle, with
// some randomness per particle so the burst doesn't look mechanical.
// `gold` swaps in the gold color/glow and a sparkle glyph for golden clicks.
function spawnParticleBurst(x, y, count, gold) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2);
    const distance = 34 + Math.random() * 34;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 20; // slight upward bias

    const p = document.createElement("span");
    p.className = gold ? "particle gold" : "particle";
    p.textContent = gold ? "✨" : "+1";
    p.style.left = x + "px";
    p.style.top = y + "px";
    p.style.setProperty("--dx", dx.toFixed(1) + "px");
    p.style.setProperty("--dy", dy.toFixed(1) + "px");
    clickBtn.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

function spawnComboText(n) {
  const el = document.createElement("span");
  el.className = "combo-text";
  el.textContent = `×${n} combo`;
  clickBtn.appendChild(el);
  setTimeout(() => el.remove(), 650);
}

// Small fading dots trailing the pointer while it hovers the click circle.
// Throttled so moving the mouse doesn't flood the DOM with dot elements.
let lastTrailTime = 0;
clickBtn.addEventListener("pointermove", (e) => {
  const now = performance.now();
  if (now - lastTrailTime < 45) return;
  lastTrailTime = now;

  const rect = clickBtn.getBoundingClientRect();
  const dot = document.createElement("span");
  dot.className = "trail-dot";
  dot.style.left = e.clientX - rect.left + "px";
  dot.style.top = e.clientY - rect.top + "px";
  clickBtn.appendChild(dot);
  setTimeout(() => dot.remove(), 500);
});

function spawnConfettiBurst() {
  const colors = ["var(--amber)", "var(--coral)", "var(--teal)", "#ffd700"];
  const piecesCount = 46;
  for (let i = 0; i < piecesCount; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--drift", (Math.random() * 200 - 100).toFixed(0) + "px");
    piece.style.setProperty("--spin", (Math.random() * 720 - 360).toFixed(0) + "deg");
    piece.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
    piece.style.animationDelay = Math.random() * 0.3 + "s";
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3600);
  }
}

function showMilestoneBanner(target) {
  const banner = document.createElement("div");
  banner.className = "milestone-banner";
  banner.textContent = `🎉 ${formatCount(target)} clicks — milestone reached! 🎉`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 3000);
}

function celebrateMilestone(target) {
  spawnConfettiBurst();
  showMilestoneBanner(target);
}

clickBtn.addEventListener("click", async (e) => {
  // UX-level throttle matching COOLDOWN_MS on the clientCooldowns rule below —
  // without this, a fast double-click would pass the +1 validation on
  // stats/total and stats/countries fine but still get silently rejected as
  // a whole (multi-path updates are all-or-nothing) once the cooldown rule
  // fails, since the update() promise here isn't surfaced to the user.
  // Disabling the button keeps every click a user can actually make succeed.
  if (clickBtn.disabled) return;
  clickBtn.disabled = true;
  setTimeout(() => {
    clickBtn.disabled = false;
  }, COOLDOWN_MS);

  const now = Date.now();
  comboCount = now - lastClickTime < COMBO_WINDOW_MS ? comboCount + 1 : 1;
  lastClickTime = now;

  const isGolden = Math.random() < GOLDEN_CHANCE;

  clickBtn.classList.remove("pulse", "golden-pulse");
  void clickBtn.offsetWidth;
  clickBtn.classList.add(isGolden ? "golden-pulse" : "pulse");

  const rect = clickBtn.getBoundingClientRect();
  const x = e.clientX ? e.clientX - rect.left : rect.width / 2;
  const y = e.clientY ? e.clientY - rect.top : rect.height / 2;
  spawnParticleBurst(x, y, isGolden ? 26 : 14, isGolden);

  if (comboCount >= 2) spawnComboText(comboCount);

  playClickSound(comboCount, isGolden);

  if (isGolden) {
    goldenFoundCount += 1;
    localStorage.setItem("cww_golden_found", String(goldenFoundCount));
    renderGoldenStat();
  }

  // Same +1 write as always, golden or not — the shared total only ever
  // moves by exactly 1 per click, per the increment-only Firebase rule.
  // Golden clicks are purely a client-side cosmetic flourish; nothing about
  // them is written to or read from Firebase.
  const country = await countryPromise;
  const updates = {
    "stats/total": increment(1),
    [`stats/countries/${country}`]: increment(1),
    [`stats/daily/${utcDate()}`]: increment(1),
    "recentClicks/latest": { country, ts: serverTimestamp() },
    [`clientCooldowns/${clientId}`]: serverTimestamp(),
  };
  // Live Clicks ring: slot = the total this click produces, mod 6.
  if (currentTotal !== null) {
    updates[`recentClicks/feed/${(currentTotal + 1) % 6}`] = { c: country, t: serverTimestamp() };
  }
  update(ref(db), updates);
});

shareBtn.addEventListener("click", async () => {
  const text =
    "I just helped click the world's counter past " + formatCount(currentTotal || 0) + ". Join in.";
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch {
      /* user cancelled the share sheet */
    }
  } else {
    shareBtn.textContent = "copied — go paste it";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable — button text still confirms the click */
    }
    setTimeout(() => {
      shareBtn.textContent = "share your rank";
    }, 2000);
  }
});
