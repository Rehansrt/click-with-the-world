// Rules tests for database.rules.json, run against the local Realtime Database
// emulator only (project "demo-cww": the demo- prefix means nothing here can
// reach the live project). Run with: npm run test:rules
//
// Each test starts from the same seeded database and sends writes shaped
// exactly like the click update in app.js / embed-widget.js, from a visitor
// signed in anonymously (the cooldown entry is keyed by their uid).
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const firebase = require("firebase/compat/app").default;
require("firebase/compat/database");

const PROJECT_ID = "demo-cww";
const { increment, TIMESTAMP } = firebase.database.ServerValue;
const TODAY = new Date().toISOString().slice(0, 10);

const SEED = {
  stats: {
    total: 100,
    countries: { IN: 60, US: 40 },
    daily: { [TODAY]: 10 },
  },
  recentClicks: {
    latest: { country: "IN", ts: 1 },
    feed: { 4: { c: "IN", t: 1 } },
  },
};

// Same six paths as the click update in app.js. totalBefore is the total the
// page last saw; the feed slot is the total this click produces, mod 6.
function clickUpdate({ country = "IN", uid = "uid-a", totalBefore = 100, by = 1 } = {}) {
  return {
    "stats/total": increment(by),
    [`stats/countries/${country}`]: increment(1),
    [`stats/daily/${TODAY}`]: increment(1),
    "recentClicks/latest": { country, ts: TIMESTAMP },
    [`clientCooldowns/${uid}`]: TIMESTAMP,
    [`recentClicks/feed/${(totalBefore + 1) % 6}`]: { c: country, t: TIMESTAMP },
  };
}

let env;

// A signed-in (anonymous) visitor's database, or a signed-out one.
const asUser = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).database();
const asNobody = () => env.unauthenticatedContext().database();

async function readAsAdmin(p) {
  let value;
  await env.withSecurityRulesDisabled(async (ctx) => {
    value = (await ctx.database().ref(p).once("value")).val();
  });
  return value;
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: {
      host: "127.0.0.1",
      port: 9000,
      rules: fs.readFileSync(path.join(__dirname, "..", "database.rules.json"), "utf8"),
    },
  });
});

after(async () => {
  if (env) await env.cleanup();
});

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled((ctx) => ctx.database().ref().set(SEED));
});

describe("click rules (database.rules.json, Phase 2)", () => {
  it("a. valid click multi-path update (signed in) → PASS", async () => {
    await assertSucceeds(asUser("uid-a").ref().update(clickUpdate()));
    assert.equal(await readAsAdmin("stats/total"), 101);
    assert.equal(await readAsAdmin("stats/countries/IN"), 61);
    assert.equal(await readAsAdmin(`stats/daily/${TODAY}`), 11);
    assert.equal((await readAsAdmin("recentClicks/feed/5")).c, "IN");
    assert.equal(typeof (await readAsAdmin("clientCooldowns/uid-a")), "number");
  });

  it("b. total +2 → FAIL", async () => {
    const db = asUser("uid-a");
    await assertFails(db.ref("stats/total").set(increment(2)));
    await assertFails(db.ref().update(clickUpdate({ by: 2 })));
    assert.equal(await readAsAdmin("stats/total"), 100);
  });

  it("c. deleting stats/total or a country counter → FAIL", async () => {
    const db = asUser("uid-a");
    await assertFails(db.ref("stats/total").remove());
    await assertFails(db.ref("stats/countries/IN").remove());
    assert.equal(await readAsAdmin("stats/total"), 100);
    assert.equal(await readAsAdmin("stats/countries/IN"), 60);
  });

  it("d. same clientId (uid) clicking again within 800 ms → FAIL", async () => {
    const db = asUser("uid-a");
    await assertSucceeds(db.ref().update(clickUpdate({ uid: "uid-a", totalBefore: 100 })));
    await assertFails(db.ref().update(clickUpdate({ uid: "uid-a", totalBefore: 101 })));
    assert.equal(await readAsAdmin("stats/total"), 101);
  });

  it('e. invalid country code "xx1" → FAIL', async () => {
    await assertFails(asUser("uid-a").ref().update(clickUpdate({ country: "xx1" })));
    assert.equal(await readAsAdmin("stats/total"), 100);
  });

  it("f. total +1 without a cooldown write (signed in) → FAIL (Phase 1 gap closed)", async () => {
    await assertFails(asUser("uid-a").ref().update({ "stats/total": increment(1) }));
    assert.equal(await readAsAdmin("stats/total"), 100);
  });

  it("g. signed-out click → FAIL", async () => {
    await assertFails(asNobody().ref().update(clickUpdate({ uid: "uid-a" })));
    assert.equal(await readAsAdmin("stats/total"), 100);
  });

  it("h. signed-in user writing another uid's cooldown → FAIL", async () => {
    const db = asUser("uid-a");
    await assertFails(db.ref().update(clickUpdate({ uid: "uid-b" })));
    await assertFails(db.ref("clientCooldowns/uid-b").set(TIMESTAMP));
    assert.equal(await readAsAdmin("stats/total"), 100);
    assert.equal(await readAsAdmin("clientCooldowns/uid-b"), null);
  });

  it("i. same uid clicking again within 800 ms from a second tab → FAIL", async () => {
    // Two separate connections signed in as the same uid (two tabs, one browser).
    await assertSucceeds(asUser("uid-a").ref().update(clickUpdate({ uid: "uid-a", totalBefore: 100 })));
    await assertFails(asUser("uid-a").ref().update(clickUpdate({ uid: "uid-a", totalBefore: 101 })));
    assert.equal(await readAsAdmin("stats/total"), 101);
  });

  it("j. country +1 alone, without total +1 → FAIL", async () => {
    await assertFails(asUser("uid-a").ref("stats/countries/IN").set(increment(1)));
    assert.equal(await readAsAdmin("stats/countries/IN"), 60);
  });

  it("k. recentClicks/latest overwrite without total +1 → FAIL", async () => {
    await assertFails(asUser("uid-a").ref("recentClicks/latest").set({ country: "US", ts: TIMESTAMP }));
    assert.equal((await readAsAdmin("recentClicks/latest")).country, "IN");
  });

  it("l. two different signed-in users clicking at the same moment → both PASS", async () => {
    const [ra, rb] = await Promise.allSettled([
      asUser("uid-a").ref().update(clickUpdate({ uid: "uid-a", country: "IN", totalBefore: 100 })),
      asUser("uid-b").ref().update(clickUpdate({ uid: "uid-b", country: "US", totalBefore: 100 })),
    ]);
    assert.equal(ra.status, "fulfilled", String(ra.reason));
    assert.equal(rb.status, "fulfilled", String(rb.reason));
    assert.equal(await readAsAdmin("stats/total"), 102);
    assert.equal(await readAsAdmin("stats/countries/IN"), 61);
    assert.equal(await readAsAdmin("stats/countries/US"), 41);
  });

  // Extra checks beyond the required list.
  it("m. same uid clicking again after 800 ms → PASS (normal repeat clicks still work)", async () => {
    const db = asUser("uid-a");
    await assertSucceeds(db.ref().update(clickUpdate({ uid: "uid-a", totalBefore: 100 })));
    await new Promise((r) => setTimeout(r, 900));
    await assertSucceeds(db.ref().update(clickUpdate({ uid: "uid-a", totalBefore: 101 })));
    assert.equal(await readAsAdmin("stats/total"), 102);
  });

  it("n. one total +1 that also adds +1 to a second country → FAIL (Phase 2.1)", async () => {
    const update = { ...clickUpdate({ uid: "uid-a" }), "stats/countries/US": increment(1) };
    await assertFails(asUser("uid-a").ref().update(update));
    assert.equal(await readAsAdmin("stats/total"), 100);
    assert.equal(await readAsAdmin("stats/countries/US"), 40);
  });

  it('o. valid click with latest.country "IN" but incrementing stats/countries/US → FAIL', async () => {
    const update = clickUpdate({ uid: "uid-a", country: "IN" });
    delete update["stats/countries/IN"];
    update["stats/countries/US"] = increment(1);
    await assertFails(asUser("uid-a").ref().update(update));
    assert.equal(await readAsAdmin("stats/total"), 100);
    assert.equal(await readAsAdmin("stats/countries/US"), 40);
  });

  it('p. valid click from the "XX" fallback country → PASS', async () => {
    await assertSucceeds(asUser("uid-a").ref().update(clickUpdate({ uid: "uid-a", country: "XX" })));
    assert.equal(await readAsAdmin("stats/total"), 101);
    assert.equal(await readAsAdmin("stats/countries/XX"), 1);
  });
});
