import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken,
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

const db = getDatabase(app);
const totalRef = ref(db, "stats/total");

const countDisplay = document.getElementById("countDisplay");
const clickBtn = document.getElementById("clickBtn");

function formatCount(n) {
  return n.toLocaleString("en-IN");
}

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

onValue(totalRef, (snap) => {
  countDisplay.textContent = formatCount(snap.val() || 0);
});

function spawnParticle(x, y) {
  const p = document.createElement("span");
  p.className = "particle";
  p.textContent = "+1";
  p.style.left = x + "px";
  p.style.top = y + "px";
  p.style.setProperty("--dx", Math.random() * 24 - 12 + "px");
  clickBtn.appendChild(p);
  setTimeout(() => p.remove(), 700);
}

// UX-level guard only — briefly disables the button so a single embed
// instance can't rapid-fire clicks. Not a real rate limit (that's App
// Check's job); just stops one impatient tap-spam from feeling broken.
const CLICK_COOLDOWN_MS = 400;

clickBtn.addEventListener("click", async (e) => {
  if (clickBtn.disabled) return;
  clickBtn.disabled = true;
  setTimeout(() => {
    clickBtn.disabled = false;
  }, CLICK_COOLDOWN_MS);

  clickBtn.classList.remove("pulse");
  void clickBtn.offsetWidth;
  clickBtn.classList.add("pulse");
  const rect = clickBtn.getBoundingClientRect();
  spawnParticle(e.clientX - rect.left, e.clientY - rect.top);

  const country = await countryPromise;
  update(ref(db), {
    "stats/total": increment(1),
    [`stats/countries/${country}`]: increment(1),
    "recentClicks/latest": { country, ts: serverTimestamp() },
  });
});
