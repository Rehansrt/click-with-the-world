// Vercel populates geolocation headers on every request at the edge — no API
// key or external lookup needed once this is deployed on Vercel.
export default function handler(req, res) {
  const country = req.headers["x-vercel-ip-country"] || null;
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ country });
}
