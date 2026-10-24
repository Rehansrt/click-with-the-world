import {
  ref,
  onValue,
  set,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { MILESTONE_LADDER } from "./milestone-ladder.js";

// Records the first time each ladder milestone is seen as reached, at
// stats/milestones/<value> = server timestamp. It is an observer: it never
// touches the click update, and its writes are separate, so a rejected write
// (e.g. someone else recorded it first) can't lose a click. First writer wins;
// the rules only allow a write when the node doesn't exist and the live total
// is already at or above the milestone.
//
// Called from Home and the embed widget only (the pages where clicks happen).
// Everything is wrapped so nothing here can throw into the caller.
//
// The embed widget calls it as startMilestoneRecorder(db) and it keeps its own
// live listener on stats/total. Home polls the total instead (live-poll.js), so
// it passes { externalTotal: true } and feeds each polled value to setTotal();
// a listener here would undo the saving, since it is sent every click.
const MAX_ATTEMPTS = 3;

export function startMilestoneRecorder(db, { externalTotal = false } = {}) {
  try {
    let total = null;
    let recorded = null; // null until the first stats/milestones snapshot arrives
    const attempts = new Map();

    function check() {
      try {
        if (total === null || recorded === null) return;
        for (const m of MILESTONE_LADDER) {
          if (total < m || String(m) in recorded) continue;
          const tried = attempts.get(m) || 0;
          if (tried >= MAX_ATTEMPTS) continue;
          attempts.set(m, tried + 1);
          set(ref(db, `stats/milestones/${m}`), serverTimestamp()).catch(() => {
            /* already recorded by someone else, or not allowed yet: harmless */
          });
        }
      } catch {
        /* never affect the page */
      }
    }

    function setTotal(v) {
      total = typeof v === "number" ? v : null;
      check();
    }

    if (!externalTotal) {
      onValue(ref(db, "stats/total"), (snap) => setTotal(snap.val()), () => {});
    }

    // stats/milestones changes only when a milestone is first recorded, so a
    // live listener here costs next to nothing.
    onValue(
      ref(db, "stats/milestones"),
      (snap) => {
        recorded = snap.val() || {};
        check();
      },
      () => {}
    );

    return {
      setTotal(v) {
        try {
          setTotal(v);
        } catch {
          /* never affect the page */
        }
      },
    };
  } catch {
    /* never affect the page */
    return null;
  }
}
