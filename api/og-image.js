const fs = require("fs");
const path = require("path");
const satoriModule = require("satori");
const satori = satoriModule.default || satoriModule;
const { Resvg } = require("@resvg/resvg-js");
const { firebaseConfig } = require("../firebase-config.js");

// @vercel/og was tried first but is fundamentally unworkable outside Next.js:
// its Edge build can't have its WASM/font assets resolved by a plain Vercel
// Edge Function, and its Node build ships as an ES module that a CommonJS
// function can't require() (and, once loaded via dynamic import, silently
// produced an empty response body — its own asset tracing didn't survive
// outside Next's build pipeline either). satori + @resvg/resvg-js is the pair
// @vercel/og itself wraps, used directly: both are well-behaved CJS-or-dual
// packages, and we bundle our own font file so there's no hidden asset the
// deployment could fail to trace.
const fontData = fs.readFileSync(path.join(process.cwd(), "api/fonts/Inter.ttf"));

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

// satori just needs plain {type, props} nodes — the same shape JSX compiles
// down to — so the tree is built by hand rather than requiring a JSX-aware
// build step for this one file.
function el(type, style, children) {
  return { type, props: { style, children } };
}

module.exports = {
  async fetch() {
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
        fontFamily: "Inter",
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

    const svg = await satori(tree, {
      width: 1200,
      height: 630,
      fonts: [{ name: "Inter", data: fontData, weight: 400, style: "normal" }],
    });

    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } })
      .render()
      .asPng();

    return new Response(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  },
};
