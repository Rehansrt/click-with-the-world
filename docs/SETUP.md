# Self-hosting guide

How to run your own copy of Click With The World. There is no build step: it's static
HTML/CSS/JS plus a few Vercel Functions in `api/`.

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com/ and click **Add project**.
2. Name it anything and finish the wizard (Google Analytics is optional).
3. In the left sidebar open **Build > Realtime Database** and click **Create Database**.
   Pick any location and start in **locked mode** (step 3 replaces the default rules).
4. Click the gear icon > **Project settings**. Under **Your apps**, click the **</>** (web)
   icon to register a web app. You don't need Firebase Hosting.
5. Firebase shows you a `firebaseConfig` object. Copy those values.

## 2. Add your config

Open [`firebase-config.js`](../firebase-config.js) and replace the values in `firebaseConfig`
with your own. These identifiers are safe to expose in client-side code: they only say which
Firebase project to talk to. Access control comes from the security rules and App Check.

## 3. Publish the security rules

In the Firebase Console, go to **Realtime Database > Rules**, paste in the contents of
[`database.rules.json`](../database.rules.json), and click **Publish**.

What the rules do:

- Anyone can **read** the stats and the live feed, so every open page updates in real time.
- Each counter (`stats/total`, `stats/countries/<ISO2>`, `stats/daily/<YYYY-MM-DD>`) can only
  go up by **exactly 1** per write, and can't be deleted.
- `clientCooldowns/<id>` rejects a second click from the same browser within 800 ms.
- `recentClicks/latest` and `recentClicks/feed/<0-5>` hold the last few clicks (country and
  time only) for the Live Clicks list.
- `stats/milestones/<value>` records when a milestone was first reached; it can be written
  once, and only when the total has reached that value.
- Everything else is rejected.

## 4. Set up App Check

The pages that talk to the database (`app.js`, `embed-widget.js`, `leaderboard.js`,
`milestones.js`) start Firebase App Check with reCAPTCHA Enterprise before opening the
database connection. To make that work for your project:

1. Create a reCAPTCHA Enterprise site key in Google Cloud and allow-list your own domain(s).
2. In the Firebase Console, open **App Check**, register your web app with that key.
3. Put the site key in `firebase-config.js` as `recaptchaSiteKey` (it is not a secret).
4. When you're ready, turn on **Enforce** for Realtime Database in the App Check screen.
   From then on, reads and writes without a valid token are rejected.

reCAPTCHA rejects traffic it judges to be automated, including headless and scripted
browsers, even from an allow-listed domain. Test in an ordinary browser session.

## 5. Run it locally

```bash
npm run dev
```

This serves the folder with `npx serve`. Notes:

- The Vercel Functions in `api/` don't run under a plain static server, so `/api/geo` and
  `/api/og-image` return 404 locally. Country detection falls back to a keyless IP lookup
  (ipwho.is).
- App Check only issues tokens for domains allow-listed on your reCAPTCHA key, so add
  `localhost` to the key (or use an App Check debug token) for local testing.
- The page talks to whichever Firebase project is in `firebase-config.js`. Clicks you make
  locally are real writes to that database.

## 6. Deploy to Vercel

1. Push the folder to a GitHub repo.
2. Go to https://vercel.com/new and import it. No build command or output directory is
   needed; Vercel serves the static files and picks up the functions in `api/`.
3. Deploy. `api/geo.js` reads Vercel's geolocation header in production with no extra setup.

Or from the CLI:

```bash
npx vercel
```

## Things tied to the original domain

Change these if you deploy under your own domain:

- [`vercel.json`](../vercel.json) redirects two specific hostnames to
  `www.clickwiththeworld.fun`. Edit or remove those rules.
- `embed.js` (`THIS_ORIGIN`) and `embed-this.js` (`ORIGIN`) hardcode the site origin used in
  embed snippets.
- Each page's `canonical`, `og:url` and `og:image` tags point at the original domain.
- `ads.txt`, the AdSense tag in `index.html`, and the contact form key in `contact.js` and
  `partner.js` belong to the original site. Replace or remove them.

## Share preview image

`api/og-image.js` renders a 1200×630 preview image with `satori` and `@resvg/resvg-js`.

- The fonts in `api/fonts/` must be static TTFs. satori's font parser fails on variable fonts.
- It reads `stats/total` through the database's REST endpoint. With App Check enforcement
  on, an unauthenticated read is rejected and the image shows its fallback text. To show the
  live count, create a service account with read access, base64-encode its JSON key, and
  set it as the `FIREBASE_SERVICE_ACCOUNT_B64` environment variable in Vercel. Never commit
  the key.
