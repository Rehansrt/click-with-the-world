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
import { sponsorConfig } from "./sponsor-config.js";

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
  /* proceed without a pre-fetched token — not a hard dependency */
}

const db = getDatabase(app);

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

const LB_COLORS = ["var(--coral)", "var(--teal)", "var(--amber)", "var(--amber)", "var(--amber)", "var(--amber)"];

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
  return n.toLocaleString("en-IN");
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
  const rel = config.active ? "noopener sponsored" : "noopener";
  const text = href
    ? `<a class="sponsor-link" href="${href}" target="_blank" rel="${rel}">${label}</a>`
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

let currentTotal = null;

function milestoneStep(total) {
  if (total < 1000) return 100;
  if (total < 10000) return 1000;
  if (total < 100000) return 10000;
  if (total < 1000000) return 100000;
  return 1000000;
}

const BIG_MILESTONE_STEP = 1000000;

function updateMilestone(total) {
  const step = milestoneStep(total);
  const target = Math.floor(total / step) * step + step;
  const remaining = target - total;
  const progress = ((total - (target - step)) / step) * 100;

  milestoneTarget.textContent = formatCount(target);
  gaugeFill.style.width = Math.max(0, Math.min(100, progress)) + "%";
  milestoneNote.textContent =
    formatCount(remaining) + " clicks to go — first country to push it over gets the crown.";

  // Only show the milestone sponsor slot for "big" milestones (every 1M,
  // matching the gauge's own top-tier step size) — not every small one on
  // the way there.
  if (target % BIG_MILESTONE_STEP === 0) {
    milestoneSponsor.hidden = false;
    renderSponsorSlot(milestoneSponsor, sponsorConfig.milestone);
  } else {
    milestoneSponsor.hidden = true;
  }
}

function renderCount(total) {
  countDisplay.textContent = formatCount(total);
  updateMilestone(total);
}

function renderLeaderboard(countries, total) {
  const rows = Object.entries(countries || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (rows.length === 0) {
    leaderboardList.innerHTML = `<li class="lb-row"><span class="lb-name">no clicks yet — be the first</span></li>`;
    return;
  }

  leaderboardList.innerHTML = rows
    .map(([iso2, count], i) => {
      const pct = total > 0 ? (count / total) * 100 : 0;
      const pctLabel = pct >= 10 ? pct.toFixed(0) : pct.toFixed(1);
      const barWidth = Math.max(pct, 1.5);
      return `
        <li class="lb-row">
          <span class="lb-name">${flagEmoji(iso2)} ${countryName(iso2)}</span>
          <span class="lb-track"><span class="lb-fill" style="width:${barWidth}%; background:${LB_COLORS[i] || "var(--amber)"};"></span></span>
          <span class="lb-pct">${pctLabel}%</span>
        </li>
      `;
    })
    .join("");
}

renderSponsorSlot(leaderboardSponsor, sponsorConfig.leaderboard);

let currentCountries = {};

onValue(totalRef, (snap) => {
  currentTotal = snap.val() || 0;
  renderCount(currentTotal);
  renderLeaderboard(currentCountries, currentTotal);
});

onValue(countriesRef, (snap) => {
  currentCountries = snap.val() || {};
  renderLeaderboard(currentCountries, currentTotal || 0);
});

onValue(latestClickRef, (snap) => {
  const data = snap.val();
  if (!data) return;
  ticker.textContent = `${flagEmoji(data.country)} someone in ${countryName(data.country)} just clicked`;
});

function spawnParticle(x, y) {
  const p = document.createElement("span");
  p.className = "particle";
  p.textContent = "+1";
  p.style.left = x + "px";
  p.style.top = y + "px";
  p.style.setProperty("--dx", Math.random() * 40 - 20 + "px");
  clickBtn.appendChild(p);
  setTimeout(() => p.remove(), 750);
}

clickBtn.addEventListener("click", async (e) => {
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
