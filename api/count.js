const crypto = require("crypto");
const { firebaseConfig } = require("../firebase-config.js");

// GET /api/count -> {"total": 12345}: the live world total, for pages that
// don't load Firebase (the birthday image on /time reads it once per image).
// Read-only: one read of stats/total, nothing is ever written.
//
// The read works the same way as in og-image.js, and the code is a copy of
// that file's so the link-preview image can't be affected by changes here.
// With App Check enforced on the database a server can't read it the way a
// browser does, so the read carries a Google OAuth2 access token for a
// service account. The key comes from the FIREBASE_SERVICE_ACCOUNT_B64 env
// var (base64 of the JSON key file) and is never in the repo.
function loadServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

let cachedToken = null;

async function getAccessToken(sa) {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned =
    encode({ alg: "RS256", typ: "JWT" }) +
    "." +
    encode({
      iss: sa.client_email,
      scope:
        "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: unsigned + "." + signature,
    }),
  });
  if (!res.ok) throw new Error("token exchange failed " + res.status);
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

async function fetchTotal() {
  const sa = loadServiceAccount();
  const headers = sa ? { Authorization: "Bearer " + (await getAccessToken(sa)) } : {};
  const res = await fetch(`${firebaseConfig.databaseURL}/stats/total.json`, {
    cache: "no-store",
    headers,
  });
  if (!res.ok) throw new Error("bad response " + res.status);
  const data = await res.json();
  if (typeof data !== "number") throw new Error("total is not a number");
  return data;
}

const json = (body, status, cacheControl) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cacheControl },
  });

module.exports = {
  async fetch(request) {
    if (request && request.method && request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "method not allowed" }, 405, "no-store");
    }
    try {
      const total = await fetchTotal();
      // Shared for 30 seconds at the edge, never kept by the browser, and
      // never served stale: the number a visitor gets is at most 30 s old.
      return json({ total }, 200, "public, max-age=0, s-maxage=30");
    } catch (err) {
      console.error("[count] read failed:", err && err.message);
      // No number is better than a wrong one: the caller leaves the line out.
      return json({ error: "unavailable" }, 503, "no-store");
    }
  },
};
