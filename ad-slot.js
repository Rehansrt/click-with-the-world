// The ONE AdSense unit on the home page (below "How It Works"). Paste the slot
// ID from AdSense here to switch it on. While empty this renders nothing at
// all: no box, no reserved space. Auto ads are NOT enabled from code — keep
// "Auto ads" off for this site in the AdSense dashboard too.
const AD_SLOT = "";

const AD_CLIENT = "ca-pub-5895766839000240";

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
