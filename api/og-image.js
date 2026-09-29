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
// packages, and we bundle our own font files so there's no hidden asset the
// deployment could fail to trace.
// Must be static (non-variable) TTFs — satori's bundled opentype.js parser
// throws on the "fvar" table of a variable font (e.g. Google's current
// Inter[opsz,wght].ttf). These were fetched with an old-Android user agent,
// which is the well-known trick that makes Google Fonts serve plain static
// TrueType instead of a variable font or woff2.
const fontRegular = fs.readFileSync(path.join(process.cwd(), "api/fonts/Inter-Regular.ttf"));
const fontBold = fs.readFileSync(path.join(process.cwd(), "api/fonts/Inter-Bold.ttf"));

async function fetchTotal() {
  const res = await fetch(`${firebaseConfig.databaseURL}/stats/total.json`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("bad response " + res.status);
  const data = await res.json();
  if (typeof data !== "number") throw new Error("total is not a number");
  return data;
}

// satori just needs plain {type, props} nodes — the same shape JSX compiles
// down to — so the tree is built by hand rather than requiring a JSX-aware
// build step for this one file.
function el(type, style, children) {
  return { type, props: { style, children } };
}

// Digits shrink as they get longer so 9+ digits (e.g. 123,456,789) always fit
// inside the frame — the frame's width is fixed, the font size isn't.
function countFontSize(formatted) {
  const len = formatted.length;
  if (len <= 6) return 128; // up to 999,999
  if (len <= 9) return 96; // up to 999,999,999
  if (len <= 11) return 76; // up to 99,999,999,999
  return 60;
}

async function render(tree) {
  const svg = await satori(tree, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Inter", data: fontRegular, weight: 400, style: "normal" },
      { name: "Inter", data: fontBold, weight: 700, style: "normal" },
    ],
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}

// Shared page chrome: dark background + soft cyan glow, footer domain line,
// and a slot in the middle for either the count frame or the failure message.
function page(middle) {
  return el(
    "div",
    {
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#050b1f",
      backgroundImage: "radial-gradient(circle at 50% 42%, rgba(39,211,255,0.28), transparent 62%)",
      fontFamily: "Inter",
    },
    [
      middle,
      el(
        "div",
        { display: "flex", fontSize: 26, color: "#9fb6d9", marginTop: 40 },
        "clickwiththeworld.fun"
      ),
    ]
  );
}

// EXACT hero line from index.html's <h1> (the site's own tagline, not invented).
const TAGLINE = "One Counter. The Whole World.";

function successMiddle(total) {
  const formatted = total.toLocaleString("en-US");
  return el(
    "div",
    { display: "flex", flexDirection: "column", alignItems: "center" },
    [
      el(
        "div",
        {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "28px 64px",
          borderRadius: 28,
          border: "2px solid rgba(39,211,255,0.75)",
          backgroundColor: "rgba(3,10,32,0.8)",
          boxShadow: "0 0 60px rgba(39,211,255,0.35)",
        },
        [
          el(
            "div",
            {
              display: "flex",
              fontSize: 26,
              fontWeight: 600,
              color: "#9fb6d9",
              letterSpacing: 4,
            },
            "TOTAL CLICKS WORLDWIDE"
          ),
          el(
            "div",
            {
              display: "flex",
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: countFontSize(formatted),
              color: "#eaffff",
              textShadow: "0 0 24px rgba(39,211,255,0.95), 0 0 60px rgba(39,211,255,0.6)",
              marginTop: 14,
              letterSpacing: 2,
            },
            formatted
          ),
        ]
      ),
      el(
        "div",
        { display: "flex", fontSize: 34, fontWeight: 600, color: "#eaf6ff", marginTop: 36 },
        TAGLINE
      ),
    ]
  );
}

function failureMiddle() {
  return el(
    "div",
    {
      display: "flex",
      fontSize: 46,
      fontWeight: 700,
      color: "#eaf6ff",
      textAlign: "center",
    },
    "Join the global click"
  );
}

module.exports = {
  async fetch() {
    try {
      const total = await fetchTotal();
      const png = await render(page(successMiddle(total)));
      return new Response(png, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      });
    } catch {
      // Never show a fake "0" — a failed fetch renders the same card without
      // a number, and gets a short cache so a bad render doesn't stick around.
      const png = await render(page(failureMiddle()));
      return new Response(png, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "max-age=0, s-maxage=10",
        },
      });
    }
  },
};
