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

// Trimmed-down version of app.js for the compact embed widget: same data
// model (stats/total, stats/countries/<ISO2>, recentClicks/latest), so
// clicks made here still count toward the main site's total and leaderboard,
// but with no milestone/ticker/leaderboard UI of its own to render.

const app = initializeApp(firebaseConfig);
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
