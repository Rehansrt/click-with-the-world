// Personal click badges (Home page only). The visitor's own click count lives
// only in this browser's localStorage under "cwtw_my_clicks"; it is never sent
// anywhere. app.js calls recordClick() only after Firebase has confirmed the
// +1, so blocked or failed clicks don't count. If storage can't be used, the
// whole feature stays hidden and clicking works as before.

const KEY = "cwtw_my_clicks";
const SITE = "https://www.clickwiththeworld.fun";

const TIERS = [
  { at: 1, name: "Rookie" },
  { at: 50, name: "Bronze Clicker" },
  { at: 200, name: "Silver Clicker" },
  { at: 500, name: "Gold Clicker" },
  { at: 1000, name: "Legend" },
];

const fmt = (n) => n.toLocaleString("en-US");

function storageWorks() {
  try {
    const probe = "__cwtw_probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

// Throws if storage fails; callers hide the feature then.
function readCount() {
  const n = parseInt(localStorage.getItem(KEY) || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Highest tier reached (or null), and the next one to aim for (or null).
function tiersFor(count) {
  let current = null;
  let next = null;
  for (const t of TIERS) {
    if (count >= t.at) current = t;
    else if (!next) next = t;
  }
  return { current, next };
}

export function startBadges() {
  const box = document.getElementById("myBadge");
  const toast = document.getElementById("badgeToast");
  if (!box || !toast) return null;

  const hide = () => {
    box.hidden = true;
  };
  if (!storageWorks()) {
    hide();
    return null;
  }

  const countEl = document.getElementById("myBadgeCount");
  const nameEl = document.getElementById("myBadgeName");
  const sepEl = document.getElementById("myBadgeSep");
  const fillEl = document.getElementById("myBadgeFill");
  const nextEl = document.getElementById("myBadgeNext");
  const shareEl = document.getElementById("myBadgeShare");
  const shareLabel = shareEl.textContent;

  let count = 0;

  function render() {
    const { current, next } = tiersFor(count);
    countEl.textContent = `Your clicks: ${fmt(count)}`;
    nameEl.textContent = current ? current.name : "";
    sepEl.hidden = !current;
    if (next) {
      const from = current ? current.at : 0;
      const pct = ((count - from) / (next.at - from)) * 100;
      fillEl.style.width = Math.max(0, Math.min(100, pct)) + "%";
      nextEl.textContent = `${fmt(next.at - count)} more to ${next.name}`;
      nextEl.hidden = false;
    } else {
      fillEl.style.width = "100%";
      nextEl.hidden = true;
    }
    shareEl.hidden = !current;
    box.classList.remove("is-pending");
    box.hidden = false;
  }

  let toastTimer = null;
  function showToast(text) {
    clearTimeout(toastTimer);
    toast.textContent = text;
    toast.hidden = false;
    toast.classList.remove("is-showing");
    void toast.offsetWidth; // restart the animation
    toast.classList.add("is-showing");
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-showing");
      toast.hidden = true;
    }, 3000);
  }

  try {
    count = readCount();
  } catch {
    hide();
    return null;
  }
  render();

  // Another tab on this site clicked: show its count here too (no toast).
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try {
      count = readCount();
      render();
    } catch {
      /* keep what's shown */
    }
  });

  shareEl.addEventListener("click", async () => {
    const { current } = tiersFor(count);
    if (!current) return;
    const text = `I'm a ${current.name} on Click With The World with ${fmt(count)} ${count === 1 ? "click" : "clicks"}! Add yours: ${SITE}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // closed the share sheet
      }
    }
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      /* clipboard unavailable */
    }
    shareEl.textContent = ok ? "Copied!" : "Couldn't copy";
    setTimeout(() => {
      shareEl.textContent = shareLabel;
    }, 2000);
  });

  return {
    // Called after Firebase confirms a click. Re-reads storage first so
    // several open tabs don't overwrite each other's count.
    recordClick() {
      try {
        const before = readCount();
        const after = before + 1;
        localStorage.setItem(KEY, String(after));
        count = after;
        render();
        const unlocked = TIERS.find((t) => t.at === after);
        if (unlocked) showToast(`Badge unlocked: ${unlocked.name}!`);
      } catch {
        hide();
      }
    },
  };
}
