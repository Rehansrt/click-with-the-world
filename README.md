# Click With The World

A live, shared click counter with a real-time country leaderboard. Every visitor taps the
same button; the total and the per-country tallies are stored in Firebase Realtime Database
and update for everyone instantly.

## Project structure

```
index.html              markup (unchanged design)
style.css               all styling/animations (unchanged, extracted from the original file)
app.js                  Firebase wiring, click handling, leaderboard/ticker rendering
firebase-config.js      your Firebase web app config (paste your own values in)
api/geo.js              Vercel serverless function used to detect a visitor's country
database.rules.json     Realtime Database security rules
```

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com/ and click **Add project**.
2. Name it anything (e.g. `click-with-the-world`) and finish the wizard (Google Analytics is optional — you can skip it).
3. Once the project is created, in the left sidebar open **Build > Realtime Database**.
4. Click **Create Database**. Pick any location. Start in **locked mode** (the rules file in this repo replaces the defaults, see step 3 below).
5. In the left sidebar, click the gear icon > **Project settings**. Under **Your apps**, click the **</>** (web) icon to register a new web app. Give it any nickname — you don't need Firebase Hosting.
6. Firebase will show you a `firebaseConfig` object. Copy those values.

## 2. Add your config to this project

Open [`firebase-config.js`](firebase-config.js) and replace the placeholder values with the
ones Firebase gave you:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

These identifiers are safe to expose in client-side code — they only tell the app which
Firebase project to talk to. Actual access control is enforced by the rules below.

## 3. Deploy the security rules

In the Firebase Console, go to **Realtime Database > Rules** and paste in the contents of
[`database.rules.json`](database.rules.json), then click **Publish**.

These rules:
- allow anyone to **read** the stats (needed for the counter/leaderboard to update live for everyone)
- allow writes only to `stats/total`, `stats/countries/<ISO2>`, and `recentClicks/latest`
- require each write to increase a counter by **exactly 1**, so a client can't inject an arbitrary or negative jump
- reject anything that doesn't match this exact shape

There's no login/auth in this app (it's a public novelty counter, same spirit as the
original demo), so writes are open to anyone who can reach your database URL. The
increment-by-1 validation is the main defense against abuse; if you want stronger
protection later (e.g. per-IP rate limiting), that requires Firebase App Check or a
Cloud Function in front of the writes.

## 4. Run it locally

No build step — it's static HTML/CSS/JS plus one serverless function.

```bash
npm run dev
```

This serves the site with `npx serve`. The country leaderboard will show `XX` / "somewhere
in the world" for you locally unless the `/api/geo` route is running — that route only
works once deployed to Vercel (see below), but the app falls back to a free keyless IP
lookup (ipwho.is) so country detection still works locally, just less precisely tied to
Vercel's edge geolocation.

## 5. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new and import the repo.
3. No build command or output directory needed — Vercel auto-detects this as a static
   project with a serverless function in `api/`.
4. Deploy. That's it — `api/geo.js` automatically has access to Vercel's edge geolocation
   headers in production, no extra configuration needed.

Or via the CLI:

```bash
npx vercel
```

## How the data model works

- `stats/total` — a single number, incremented by 1 on every click across all visitors.
- `stats/countries/<ISO2>` — one counter per country, incremented by 1 on every click from
  a visitor detected in that country.
- `recentClicks/latest` — the most recent click's country + timestamp, used to drive the
  "someone in X just clicked" ticker in real time.

All three are updated atomically in a single multi-path `update()` call per click.
