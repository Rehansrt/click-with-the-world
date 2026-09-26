// Receives App Check failure reports from the browser (navigator.sendBeacon)
// and writes one JSON line per report to Vercel's runtime logs. Deliberately
// stores nothing: no database write, no IP, no cookies — just console.log.
const MAX_LEN = 300;

function clip(value) {
  if (value === undefined || value === null) return null;
  return String(value).slice(0, MAX_LEN);
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  // sendBeacon sends a text/plain Blob (avoids a CORS preflight), so Vercel
  // hands us a string; fall back gracefully if it arrives already parsed.
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).end();
  }

  console.log(
    "[appcheck-failure]",
    JSON.stringify({
      code: clip(body.code),
      message: clip(body.message),
      userAgent: clip(body.userAgent),
      path: clip(body.path),
      timestamp: clip(body.timestamp),
    })
  );

  return res.status(204).end();
}
