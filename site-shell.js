// Shared header + footer for every page. To use on a page: add
//   <div id="site-header"></div> ... <div id="site-footer"></div>
//   <script type="module" src="/site-shell.js"></script>
// Pages show up in the nav ONLY when `live: true` — flip the flag when the page
// ships so no link ever points at a 404.

export const PAGES = [
  { label: "Home", href: "/", live: true },
  { label: "Milestones", href: "/milestones", live: false },
  { label: "Leaderboard", href: "/leaderboard", live: false },
  { label: "Embed", href: "/embed-this", live: true },
  { label: "Sponsor", href: "/sponsor", live: false },
  { label: "About", href: "/about", live: false },
  { label: "FAQ", href: "/faq", live: false },
  { label: "Contact", href: "/contact", live: true },
];

export const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy", live: true },
  { label: "Contact", href: "/contact", live: true },
];

export const KOFI_URL = "https://ko-fi.com/clickwiththeworld";
export const TAGLINE = "One world. One counter.";

export function isLive(href) {
  return [...PAGES, ...LEGAL_LINKS].some((p) => p.href === href && p.live);
}

function currentPath() {
  const p = location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
  return p.length > 1 ? p.replace(/\/$/, "") : "/";
}

let logoSeq = 0;
function globeLogo(size) {
  const id = "shg" + logoSeq++;
  return `<svg class="sh-logo" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="${id}" cx=".35" cy=".3" r=".9">
        <stop offset="0" stop-color="#6fd6ff"/><stop offset=".55" stop-color="#1667e8"/><stop offset="1" stop-color="#061b5c"/>
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="22" fill="url(#${id})"/>
    <g fill="none" stroke="#cdeeff" stroke-opacity=".5" stroke-width="1">
      <ellipse cx="24" cy="24" rx="9" ry="22"/><path d="M2.5 24h43M6 14h36M6 34h36"/>
    </g>
    <g fill="#ffd27a"><circle cx="17" cy="19" r="1.2"/><circle cx="30" cy="27" r="1.4"/><circle cx="22" cy="31" r="1"/><circle cx="33" cy="17" r="1"/></g>
  </svg>`;
}

const cupIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 9h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V9z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M9 3v2M12 3v2"/></svg>`;

function navLinks(active) {
  return PAGES.filter((p) => p.live)
    .map(
      (p) =>
        `<a href="${p.href}"${p.href === active ? ' class="is-active" aria-current="page"' : ""}>${p.label}</a>`
    )
    .join("");
}

function renderHeader(el) {
  const active = currentPath();
  el.innerHTML = `
    <div class="sh-inner">
      <a class="sh-brand" href="/">
        ${globeLogo(46)}
        <span class="sh-brand-text"><strong>Click With The World</strong><small>${TAGLINE}</small></span>
      </a>
      <nav id="shNav" class="sh-nav" aria-label="Main">${navLinks(active)}</nav>
      <a class="sh-tip" href="${KOFI_URL}" target="_blank" rel="noopener">${cupIcon}<span>Tip Us</span></a>
      <button class="sh-burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="shNav">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
    </div>`;

  const burger = el.querySelector(".sh-burger");
  const nav = el.querySelector(".sh-nav");
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
}

function renderFooter(el) {
  const active = currentPath();
  const legal = LEGAL_LINKS.filter((l) => l.live)
    .map((l) => `<a href="${l.href}">${l.label}</a>`)
    .join('<span class="sf-sep" aria-hidden="true">|</span>');
  el.innerHTML = `
    <div class="sf-inner">
      <a class="sh-brand" href="/">
        ${globeLogo(40)}
        <span class="sh-brand-text"><strong>Click With The World</strong><small>${TAGLINE}</small></span>
      </a>
      <nav class="sf-nav" aria-label="Footer">${navLinks(active)}<a href="${KOFI_URL}" target="_blank" rel="noopener">Tip Us</a></nav>
    </div>
    <div class="sf-bottom">
      <span>&copy; 2026 Click With The World</span>${legal ? '<span class="sf-sep" aria-hidden="true">|</span>' + legal : ""}
    </div>`;
}

function init() {
  if (!document.querySelector('link[href$="site-shell.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/site-shell.css";
    document.head.appendChild(link);
  }
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  if (header) renderHeader(header);
  if (footer) renderFooter(footer);
}

init();
