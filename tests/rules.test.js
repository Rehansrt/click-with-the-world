// Rules tests for database.rules.json, run against the local Realtime Database
// emulator only (project "demo-cww": the demo- prefix means nothing here can
// reach the live project). Run with: npm run test:rules
//
// Each test starts from the same seeded database and sends writes shaped
// exactly like the click update in app.js / embed-widget.js.
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
function clickUpdate({ country = "IN", clientId = "client-a", totalBefore = 100, by = 1 } = {}) {
  return {
    "stats/total": increment(by),
    [`stats/countries/${country}`]: increment(1),
    [`stats/daily/${TODAY}`]: increment(1),
    "recentClicks/latest": { country, ts: TIMESTAMP },
    [`clientCooldowns/${clientId}`]: TIMESTAMP,
    [`recentClicks/feed/${(totalBefore + 1) % 6}`]: { c: country, t: TIMESTAMP },
  };
}

let env;
let db;

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
  db = env.unauthenticatedContext().database();
});

describe("click rules (current database.rules.json)", () => {
  it("a. valid click multi-path update → PASS", async () => {
    await assertSucceeds(db.ref().update(clickUpdate()));
    assert.equal(await readAsAdmin("stats/total"), 101);
    assert.equal(await readAsAdmin("stats/countries/IN"), 61);
    assert.equal(await readAsAdmin(`stats/daily/${TODAY}`), 11);
    assert.equal((await readAsAdmin("recentClicks/feed/5")).c, "IN");
    assert.equal(typeof (await readAsAdmin("clientCooldowns/client-a")), "number");
  });

  it("b. total +2 → FAIL", async () => {
    await assertFails(db.ref("stats/total").set(increment(2)));
    await assertFails(db.ref().update(clickUpdate({ by: 2 })));
    assert.equal(await readAsAdmin("stats/total"), 100);
  });

  it("c. deleting stats/total or a country counter → FAIL", async () => {
    await assertFails(db.ref("stats/total").remove());
    await assertFails(db.ref("stats/countries/IN").remove());
    assert.equal(await readAsAdmin("stats/total"), 100);
    assert.equal(await readAsAdmin("stats/countries/IN"), 60);
  });

  it("d. same clientId clicking again within 800 ms → FAIL", async () => {
    await assertSucceeds(db.ref().update(clickUpdate({ clientId: "client-a", totalBefore: 100 })));
    await assertFails(db.ref().update(clickUpdate({ clientId: "client-a", totalBefore: 101 })));
    assert.equal(await readAsAdmin("stats/total"), 101);
  });

  it('e. invalid country code "xx1" → FAIL', async () => {
    await assertFails(db.ref().update(clickUpdate({ country: "xx1" })));
    assert.equal(await readAsAdmin("stats/total"), 100);
  });

  it("f. GAP — to be closed in Phase 2: stats/total +1 without touching clientCooldowns → currently PASS", async () => {
    await assertSucceeds(db.ref().update({ "stats/total": increment(1) }));
    assert.equal(await readAsAdmin("stats/total"), 101);
    assert.equal(await readAsAdmin("clientCooldowns"), null);
  });

  it("g. GAP — to be closed in Phase 2: two clicks with two different random clientIds within 800 ms → currently PASS", async () => {
    await assertSucceeds(db.ref().update(clickUpdate({ clientId: "random-1", totalBefore: 100 })));
    await assertSucceeds(db.ref().update(clickUpdate({ clientId: "random-2", totalBefore: 101 })));
    assert.equal(await readAsAdmin("stats/total"), 102);
  });
});
