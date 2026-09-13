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
embed.html              compact embeddable widget (just the button + count)
embed-widget.js         Firebase wiring for the embed widget
embed.js                script-tag loader that injects the embed as an iframe
embed-this.html         snippet generator + instructions page ("Embed this counter")
api/geo.js              Vercel serverless function used to detect a visitor's country
api/og-image.js         Vercel Function that renders the live count as a share-preview image
api/fonts/              static Inter TTFs used to render that image (see note below)
database.rules.json     Realtime Database security rules
vercel.json             enables clean URLs (/embed, /embed-this instead of .html)
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

## Dynamic share preview (OG image)

`api/og-image.js` is a Vercel Function (Node.js runtime) that reads the current
`stats/total` value straight from Firebase (via its public REST endpoint) and renders a
1200×630 image showing the live count and "clicks so far — join in", using `satori` (layout)
and `@resvg/resvg-js` (SVG-to-PNG). `index.html` points `og:image` and `twitter:image` at
`/api/og-image`, so pasting the site's URL into WhatsApp, Twitter/X, Slack, etc. shows a
live-looking preview card instead of a blank one.

Notes:
- This only runs on Vercel — `npm run dev` (plain static server) can't execute Vercel
  Functions, so `/api/og-image` will 404 locally. Verify it after deploying instead.
- `@vercel/og` was tried first and abandoned: it's built assuming Next.js's build pipeline,
  and fails in a plain Vercel project in several different ways (Edge build can't resolve
  its own WASM/font assets; its Node build is an ES module a CommonJS function can't
  `require()`; even loaded via dynamic `import()` it silently rendered an empty body). Using
  `satori` + `@resvg/resvg-js` directly — the same pair `@vercel/og` wraps — avoids all of it.
- The font files in `api/fonts/` must be **static** TTFs, not Google's current variable
  `Inter[opsz,wght].ttf` — satori's bundled font parser throws on that font's `fvar` table.
  These were fetched by requesting Google Fonts' CSS with an old Android user agent, a
  well-known trick that makes it serve plain TrueType instead of a variable font or woff2.
- The image is cached at Vercel's edge for 60 seconds (`s-maxage=60`) so a burst of shares
  doesn't hammer Firebase; the count in the preview can lag reality by up to a minute.
- Most chat apps (WhatsApp, Slack, iMessage) cache the preview per-URL for a while after the
  first share, so resharing the *same* link won't always show an updated count — that's a
  platform-side cache, not a bug here.
- The og:image URL is hardcoded to `https://click-with-the-world.vercel.app` in
  `index.html`. If you move to a custom domain, update those meta tags to match.

## Embeddable widget

`/embed-this` is a page (linked from the main site's footer) where anyone can pick a size
and copy either a `<script>` snippet or a plain `<iframe>` snippet to drop the counter into
their own site.

- `embed.html` (served at `/embed`) is the compact widget itself — just the button and the
  count, no leaderboard/milestone/ticker/share button. It writes to the exact same
  `stats/total`, `stats/countries/<ISO2>`, and `recentClicks/latest` paths as the main site,
  so a click on an embedded widget counts toward the same global total and leaderboard.
- `embed.js` (served at `/embed.js`) is the script-tag loader: it reads `data-width` /
  `data-height` off its own `<script>` tag (via `document.currentScript`) and inserts an
  `<iframe src="https://click-with-the-world.vercel.app/embed">` right after itself.
- Both are hardcoded to `https://click-with-the-world.vercel.app` (a script or iframe running
  on someone else's domain still needs an absolute URL back to this site) — update that if
  you move to a custom domain.
- `/embed` and `/embed-this` only work extension-free once deployed, via `cleanUrls: true`
  in `vercel.json`; locally they're `embed.html` / `embed-this.html` (though `npx serve` also
  happens to resolve the extension-free paths, mirroring Vercel's behavior).

## Ko-fi tip widget

`index.html` includes Ko-fi's official floating-chat embed (from ko-fi.com/manage/widgets,
Ko-fi page: `ko-fi.com/clickwiththeworld`) just before the closing `</body>` tag, colored to
match the site via the widget's own `background-color`/`text-color` options rather than a
custom wrapper.

- It's only on the main site — not the embed widget, which is meant to stay minimal.
- Ko-fi's floating button has no built-in position option and defaults to bottom-left; the
  small CSS override at the bottom of `style.css` (targeting `.floatingchat-container-wrap`
  / `-mobi`, Ko-fi's own stable class names) moves it to bottom-right instead, clear of the
  footer buttons. The widget's container `id` is randomized per page load, so it can't be
  targeted directly — the class names are the stable hook.
- To change the tip text or colors, edit the `kofiWidgetOverlay.draw(...)` call directly;
  there's no separate config file for this one since it's a single small snippet.
