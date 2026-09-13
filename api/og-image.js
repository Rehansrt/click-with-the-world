import { ImageResponse } from "@vercel/og";
import { firebaseConfig } from "../firebase-config.js";

// Deliberately NOT using the Edge runtime here: @vercel/og bundles WASM/font
// assets in a way that only Next.js's edge build pipeline can resolve — in a
// plain Vercel project the Edge build fails with "referencing unsupported
// modules: @vercel: module". The Node.js runtime (the default when no
// `export const config = { runtime: "edge" }` is present) has full
// node_modules resolution and works fine, per @vercel/og's own docs.

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

// Satori (which powers ImageResponse) just needs plain {type, props} nodes —
// the same shape JSX compiles down to — so we build the tree by hand here
// rather than requiring a JSX-aware build step for this one file.
function el(type, style, children) {
  return { type, props: { style, children } };
}

async function renderImage() {
  const total = await fetchTotal();
  const formatted = total.toLocaleString("en-IN");

  const tree = el(
    "div",
    {
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
    },
    [
      el(
        "div",
        { display: "flex", fontSize: 30, color: "#a7acd9" },
        "a small experiment in collective clicking"
      ),
      el(
        "div",
        {
          display: "flex",
          fontSize: 128,
          fontWeight: 700,
          color: "#f2f0e6",
          letterSpacing: -2,
          marginTop: 12,
        },
        formatted
      ),
      el(
        "div",
        { display: "flex", fontSize: 42, fontWeight: 600, color: "#ffb627", marginTop: 4 },
        "clicks so far — join in"
      ),
      el(
        "div",
        { display: "flex", fontSize: 26, color: "#a7acd9", marginTop: 48 },
        "Click With The World"
      ),
    ]
  );

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    headers: {
      "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

export default {
  fetch: renderImage,
};
