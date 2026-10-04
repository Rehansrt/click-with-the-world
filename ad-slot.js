// The ONE AdSense unit on the home page (below "How It Works"). Paste the slot
// ID from AdSense here to switch it on. While empty this renders nothing at
// all: no box, no reserved space. Auto ads are NOT enabled from code — keep
// "Auto ads" off for this site in the AdSense dashboard too.
const AD_SLOT = "";

const AD_CLIENT = "ca-pub-5895766839000240";

// How long after the page's load event the AdSense script is fetched.
const ADSENSE_DELAY_MS = 5000;

// Loads the AdSense script well after the page has finished loading. It used
// to be an async tag in <head>, where it could run before the stylesheets
// arrived (measuring an unstyled page, which registered as one huge layout
// shift) and competed with first paint. Only pages whose ad section carries
// data-load-adsense load it.
function loadAdSenseLater() {
  const section = document.getElementById("adSection");
  if (!section || !("loadAdsense" in section.dataset)) return;

  const inject = () => {
    if (document.querySelector('script[src*="adsbygoogle.js"]')) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
    document.head.appendChild(script);
  };
  const schedule = () => setTimeout(inject, ADSENSE_DELAY_MS);

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}

function mountAd() {
  const section = document.getElementById("adSection");
  if (!section || !AD_SLOT) return;

  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.style.display = "block";
  ins.dataset.adClient = AD_CLIENT;
  ins.dataset.adSlot = AD_SLOT;
  ins.dataset.adFormat = "auto";
  ins.dataset.fullWidthResponsive = "true";
  section.appendChild(ins);
  section.hidden = false;

  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    section.hidden = true;
  }

  // Collapse cleanly if AdSense has nothing to show.
  new MutationObserver(() => {
    if (ins.dataset.adStatus === "unfilled") section.hidden = true;
  }).observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });
}

mountAd();
loadAdSenseLater();
