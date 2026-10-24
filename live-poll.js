import {
  ref,
  get,
  goOffline,
  goOnline,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

// Reads a few database paths on a timer instead of keeping live listeners
// open. A live listener is sent every click from everyone, so its download
// grows with (clicks × people watching); a poll costs the same small amount
// per visitor-minute whatever the traffic.
//
// tasks: [{ path, every, onData, watch }]
//   path   — string, or a function returning one (e.g. today's UTC date).
//   every  — ms between reads. Tasks at or below FAST_MS run on every tick.
//   onData — called with (value, { path, resumed }) after each successful
//            read; `resumed` is true on the first read after the tab comes
//            back from being hidden (or on the first read ever).
//   watch  — a change in this value counts as activity. When several polls
//            in a row see no change, polling slows down (IDLE_STEPS); any
//            change, bump(), or the tab coming back makes it fast again.
//
// Polling stops while the tab is hidden; after HIDDEN_OFFLINE_MS hidden the
// database connection is closed too, and both come back with the tab.
const FAST_MS = 2500;
const IDLE_STEPS = [
  [4, 5000], // 4 unchanged polls in a row → every 5 s
  [8, 10000], // 8 → every 10 s
];
const HIDDEN_OFFLINE_MS = 120000;
const TICK_WAIT_MS = 8000; // a stuck read can't hold up the next tick longer than this

export function startPolling(db, tasks) {
  const state = tasks.map((t) => ({ ...t, last: -Infinity, busy: false, prev: undefined, resumed: true }));
  let idle = 0;
  let timer = null;
  let offlineTimer = null;
  let offline = false;

  function interval() {
    let ms = FAST_MS;
    for (const [n, slower] of IDLE_STEPS) if (idle >= n) ms = slower;
    return ms;
  }

  // Resolves true (value changed), false (unchanged) or null (read failed).
  async function read(t) {
    if (t.busy) return null;
    t.busy = true;
    t.last = Date.now();
    try {
      const path = typeof t.path === "function" ? t.path() : t.path;
      const v = (await get(ref(db, path))).val();
      let changed = false;
      if (t.watch) {
        const key = JSON.stringify(v);
        changed = t.prev !== undefined && key !== t.prev;
        t.prev = key;
      }
      const resumed = t.resumed;
      t.resumed = false;
      try {
        t.onData(v, { path, resumed });
      } catch {
        /* a render error must not stop polling */
      }
      return changed;
    } catch {
      return null; // offline, or the read was refused: try again next tick
    } finally {
      t.busy = false;
    }
  }

  async function tick(force = false) {
    timer = null;
    const now = Date.now();
    const due = state.filter((t) => force || t.every <= FAST_MS || now - t.last >= t.every - 100);
    const results = await Promise.race([
      Promise.all(due.map(read)),
      new Promise((resolve) => setTimeout(() => resolve([]), TICK_WAIT_MS)),
    ]);
    if (results.some((r) => r === true)) idle = 0;
    else if (results.some((r) => r === false)) idle += 1;
    schedule();
  }

  function schedule() {
    if (document.hidden || timer) return;
    timer = setTimeout(tick, interval());
  }

  document.addEventListener("visibilitychange", () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (document.hidden) {
      offlineTimer = setTimeout(() => {
        offline = true;
        goOffline(db);
      }, HIDDEN_OFFLINE_MS);
      return;
    }
    clearTimeout(offlineTimer);
    offlineTimer = null;
    if (offline) {
      offline = false;
      goOnline(db);
    }
    idle = 0;
    for (const t of state) t.resumed = true;
    tick(true);
  });

  tick(true);

  return {
    // Back to fast polling now (e.g. after the visitor's own click).
    bump() {
      if (idle === 0) return;
      idle = 0;
      if (timer) {
        clearTimeout(timer);
        timer = null;
        schedule();
      }
    },
  };
}
