import {
  getDatabase,
  ref,
  push,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

// Shared by app.js, embed-widget.js, milestones.js and leaderboard.js.
// Reports App Check failures (never successes) so real-user failures can be
// told apart from bots/crawlers. Two channels, same as before:
//  - navigator.sendBeacon to /api/appcheck-log (Vercel's own ~1h runtime
//    logs) — fires every time, unthrottled, unchanged.
//  - a create-only appcheckLogs/<pushId> entry in Realtime Database, which
//    persists — this is the one that needs the dedupe/cap below, since it's
//    the one that accumulates indefinitely otherwise.

// Flip to false once App Check Enforce is ON: at that point a rejected
// request never reaches the database at all, so this custom log stops being
// the useful signal it is today — Firebase's own App Check Console metrics
// are the standing source of truth from then on.
export const APPCHECK_LOGGING_ENABLED = true;

const MAX_WRITES_PER_SESSION = 3;

// sessionStorage lets the dedupe/cap survive navigating between pages in the
// same tab (Home -> Leaderboard -> Milestones), which a plain module-level
// variable wouldn't (each page load re-runs this module from scratch). A
// third-party context (e.g. this embed inside a host page under strict
// storage partitioning) can make sessionStorage throw, so every access is
// wrapped and falls back to an in-memory equivalent for the rest of this
// page's lifetime once that's detected.
const memoryLoggedCodes = new Set();
let memoryWriteCount = 0;
let storageBroken = false;

function getWriteCount() {
  if (!storageBroken) {
    try {
      return Number(sessionStorage.getItem("cwtw_acl_count")) || 0;
    } catch {
      storageBroken = true;
    }
  }
  return memoryWriteCount;
}

function setWriteCount(n) {
  if (!storageBroken) {
    try {
      sessionStorage.setItem("cwtw_acl_count", String(n));
      return;
    } catch {
      storageBroken = true;
    }
  }
  memoryWriteCount = n;
}

function alreadyLoggedCode(code) {
  if (!storageBroken) {
    try {
      return sessionStorage.getItem("cwtw_acl_" + code) !== null;
    } catch {
      storageBroken = true;
    }
  }
  return memoryLoggedCodes.has(code);
}

function markLoggedCode(code) {
  if (!storageBroken) {
    try {
      sessionStorage.setItem("cwtw_acl_" + code, "1");
      return;
    } catch {
      storageBroken = true;
    }
  }
  memoryLoggedCodes.add(code);
}

export function reportAppCheckError(app, err) {
  if (!APPCHECK_LOGGING_ENABLED) return;

  try {
    const payload = JSON.stringify({
      code: (err && err.code) || null,
      message: (err && err.message) || String(err),
      userAgent: navigator.userAgent,
      path: location.pathname,
      timestamp: new Date().toISOString(),
    });
    navigator.sendBeacon(
      "/api/appcheck-log",
      new Blob([payload], { type: "text/plain" })
    );
  } catch {
    /* reporting must never affect the app */
  }

  // Persist to RTDB (appcheckLogs/<pushId>) since Vercel Hobby only keeps
  // runtime logs ~1h. Fields must match the appcheckLogs validate rule
  // exactly: 5 strings/number, strings <= 300. Deduped per error code and
  // capped in total, both per tab session — see comment above.
  try {
    const code = (err && err.code) || "unknown";
    if (alreadyLoggedCode(code)) return;
    if (getWriteCount() >= MAX_WRITES_PER_SESSION) return;

    const clip = (v) => String(v).slice(0, 300);
    push(ref(getDatabase(app), "appcheckLogs"), {
      code: clip(code),
      message: clip((err && err.message) || err),
      userAgent: clip(navigator.userAgent),
      path: clip(location.pathname),
      timestamp: serverTimestamp(),
    }).catch(() => {
      /* rules not published / offline — ignore, never break the site */
    });

    markLoggedCode(code);
    setWriteCount(getWriteCount() + 1);
  } catch {
    /* ignore */
  }
}
