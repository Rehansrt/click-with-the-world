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

// Trimmed-down version of app.js for the compact embed widget: same data
// model (stats/total, stats/countries/<ISO2>, recentClicks/latest), so
// clicks made here still count toward the main site's total and leaderboard,
// but with no milestone/ticker/leaderboard UI of its own to render.

const app = initializeApp(firebaseConfig);

// Same App Check gate as app.js — must run before getDatabase(). This runs
// inside the embed's own iframe (served from this site's origin regardless
// of which page embeds it), so the reCAPTCHA Enterprise key just needs this
// site's domain allow-listed, not every host page's domain.
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
  isTokenAutoRefreshEnabled: true,
});

// See app.js for why this matters: without waiting for the first token,
// getDatabase()'s WebSocket connection can open before App Check's async
// reCAPTCHA challenge finishes, showing up as invalid/outdated in metrics
// for the whole page session even though nothing is actually broken.
try {
  await getToken(appCheck);
} catch {
  /* proceed without a pre-fetched token — not a hard dependency */
}

// Token-change listener kept registered, as before; it used to log each
// background refresh and no longer does.
onTokenChanged(appCheck, {
  next: () => {},
  error: () => {},
});

const db = getDatabase(app);

// Same first-reached recorder as Home. Dynamic import + catch: it must never
// affect clicks or rendering.
try {
  import("./milestone-recorder.js")
    .then((m) => m.startMilestoneRecorder(db))
    .catch(() => {});
} catch {
  /* ignore */
}
const totalRef = ref(db, "stats/total");

const countDisplay = document.getElementById("countDisplay");
const clickBtn = document.getElementById("clickBtn");

function formatCount(n) {
  return n.toLocaleString("en-IN");
}

// Shrinks the count number to fit the circle instead of overflowing it (a
// large total, e.g. 9 digits, would otherwise spill past the button edge —
// the button diameter and base font-size are fixed by embed.html's CSS and
// don't grow with text length). Resets to the CSS size first so it can grow
// back if a shorter value is set later.
function fitCount() {
  countDisplay.style.fontSize = "";
  const maxWidth = clickBtn.clientWidth * 0.8;
  if (maxWidth <= 0) return;
  const baseSize = parseFloat(getComputedStyle(countDisplay).fontSize);
  if (countDisplay.scrollWidth > maxWidth) {
    const scaled = baseSize * (maxWidth / countDisplay.scrollWidth);
    countDisplay.style.fontSize = Math.max(10, scaled) + "px";
  }
}

function setCount(text) {
  countDisplay.textContent = text;
  fitCount();
}

let fitResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(fitResizeTimer);
  fitResizeTimer = setTimeout(fitCount, 120);
});

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
      /* ignore — stays "XX" */
    }
  }

  sessionStorage.setItem("cww_country", code);
  return code;
}

const countryPromise = detectCountry();

// Interim client-side rate-limit stopgap while App Check enforcement stays
// off (blocked on firebase/firebase-js-sdk#10385) — see app.js for the full
// rationale. Same localStorage key on purpose: this embed shares its origin
// (and therefore storage) with the main site, so the same visitor gets one
// consistent cooldown budget across both surfaces.
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

// Lighter interaction layer than the main site by design: an embed sits on
// someone else's page, so it stays to particle burst + number roll-up only —
// no sound, no confetti, no combo text, no golden-click mechanic. Same
// increment-only Firebase write either way.

let displayedTotal = 0;
let hasRenderedCount = false;
let rollupRaf = null;
let rollupFallbackTimer = null;
let rollupToken = 0;

function animateCountTo(target) {
  const start = displayedTotal;
  const startTime = performance.now();
  const duration = 300;
  const myToken = ++rollupToken;

  if (rollupRaf) cancelAnimationFrame(rollupRaf);
  if (rollupFallbackTimer) clearTimeout(rollupFallbackTimer);

  function commitFinal() {
    if (myToken !== rollupToken) return;
    displayedTotal = target;
    setCount(formatCount(target));
  }

  function step(now) {
    if (myToken !== rollupToken) return;
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(start + (target - start) * eased);
    displayedTotal = value;
    setCount(formatCount(value));
    if (t < 1) {
      rollupRaf = requestAnimationFrame(step);
    } else {
      commitFinal();
    }
  }

  rollupRaf = requestAnimationFrame(step);
  // Safety net if rAF stalls (backgrounded tab/iframe) — see app.js for why.
  rollupFallbackTimer = setTimeout(commitFinal, duration + 120);
}

let currentTotal = null;

function utcDate() {
  return new Date().toISOString().slice(0, 10);
}

onValue(totalRef, (snap) => {
  const total = snap.val() || 0;
  currentTotal = total;
  if (!hasRenderedCount) {
    hasRenderedCount = true;
    displayedTotal = total;
    setCount(formatCount(total));
  } else {
    animateCountTo(total);
  }
});

// Radiates a small burst of particles outward from (x, y) — same technique
// as the main site's spawnParticleBurst, scaled down for this compact widget.
function spawnParticleBurst(x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2);
    const distance = 14 + Math.random() * 14;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 8;

    const p = document.createElement("span");
    p.className = "particle";
    p.textContent = "+1";
    p.style.left = x + "px";
    p.style.top = y + "px";
    p.style.setProperty("--dx", dx.toFixed(1) + "px");
    p.style.setProperty("--dy", dy.toFixed(1) + "px");
    clickBtn.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

// Disables the button for COOLDOWN_MS after each click — both a UX guard
// against rapid-fire tap-spam AND kept in sync with the server-side
// clientCooldowns rule (database.rules.json) so a click a real user can
// actually make never gets silently rejected by it (multi-path updates are
// all-or-nothing, and this update()'s result isn't surfaced to the user).
clickBtn.addEventListener("click", async (e) => {
  if (clickBtn.disabled) return;
  clickBtn.disabled = true;
  setTimeout(() => {
    clickBtn.disabled = false;
  }, COOLDOWN_MS);

  clickBtn.classList.remove("pulse");
  void clickBtn.offsetWidth;
  clickBtn.classList.add("pulse");
  const rect = clickBtn.getBoundingClientRect();
  const x = e.clientX ? e.clientX - rect.left : rect.width / 2;
  const y = e.clientY ? e.clientY - rect.top : rect.height / 2;
  spawnParticleBurst(x, y, 10);

  const country = await countryPromise;
  const updates = {
    "stats/total": increment(1),
    [`stats/countries/${country}`]: increment(1),
    [`stats/daily/${utcDate()}`]: increment(1),
    "recentClicks/latest": { country, ts: serverTimestamp() },
    [`clientCooldowns/${clientId}`]: serverTimestamp(),
  };
  // Same Live Clicks ring as the main site: slot = the total this click
  // produces, mod 6.
  if (currentTotal !== null) {
    updates[`recentClicks/feed/${(currentTotal + 1) % 6}`] = { c: country, t: serverTimestamp() };
  }
  update(ref(db), updates);
});
