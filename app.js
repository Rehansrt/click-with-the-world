import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
  increment,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
import { sponsorConfig } from "./sponsor-config.js";

const app = initializeApp(firebaseConfig);
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

// Renders one sponsor slot from sponsor-config.js. Placeholder styling when
// inactive, real name/logo/link when a sponsor is configured — swapping a
// slot over never requires touching this code, only sponsor-config.js.
function renderSponsorSlot(el, config) {
  const logo = config.active && config.logoUrl
    ? `<img class="sponsor-logo" src="${config.logoUrl}" alt="">`
    : "";
  const tag = config.active ? "sponsored" : "sponsor this spot";
  const label = config.active && config.name ? config.name : config.placeholderText;
  const text = config.active && config.link
    ? `<a class="sponsor-link" href="${config.link}" target="_blank" rel="noopener sponsored">${label}</a>`
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

const BIG_MILESTONE_STEP = 100000;

function updateMilestone(total) {
  const step = milestoneStep(total);
  const target = Math.floor(total / step) * step + step;
  const remaining = target - total;
  const progress = ((total - (target - step)) / step) * 100;

  milestoneTarget.textContent = formatCount(target);
  gaugeFill.style.width = Math.max(0, Math.min(100, progress)) + "%";
  milestoneNote.textContent =
    formatCount(remaining) + " clicks to go — first country to push it over gets the crown.";

  // Only show the milestone sponsor slot for "big" milestones (every 100K) —
  // not every small one on the way there.
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
