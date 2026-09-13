import { ImageResponse } from "@vercel/og";
import { firebaseConfig } from "../firebase-config.js";

export const config = {
  runtime: "edge",
};

async function fetchTotal() {
  try {
    const res = await fetch(`${firebaseConfig.databaseURL}/stats/total.json`, {
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data === "number" ? data : 0;
  } catch {
    return 0;
  }
}

export default async function handler() {
  const total = await fetchTotal();
  const formatted = total.toLocaleString("en-IN");

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#12142b",
          backgroundImage:
            "radial-gradient(circle at 50% 15%, rgba(255,182,39,0.22), transparent 60%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#a7acd9" }}>
          a small experiment in collective clicking
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 128,
            fontWeight: 700,
            color: "#f2f0e6",
            letterSpacing: -2,
            marginTop: 12,
          }}
        >
          {formatted}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 42,
            fontWeight: 600,
            color: "#ffb627",
            marginTop: 4,
          }}
        >
          clicks so far — join in
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#a7acd9", marginTop: 48 }}>
          Click With The World
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
