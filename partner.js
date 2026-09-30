// Founding Partner inquiry form -> Web3Forms (same endpoint/key as
// contact.js — this key only allows sending to this site's own inbox).
import { PARTNER_INVENTORY } from "./partner-config.js";

const ENDPOINT = "https://api.web3forms.com/submit";
const ACCESS_KEY = "bf23ed6a-8c63-4c90-afb5-1b1cea81edca";
const BASE_SUBJECT = "Founding Partner inquiry";
const FALLBACK_EMAIL = "sponsor@clickwiththeworld.fun";

const form = document.getElementById("partnerForm");
const sendBtn = document.getElementById("partnerSendBtn");
const statusEl = document.getElementById("partnerFormStatus");
const BTN_LABEL = sendBtn.innerHTML;

// The dropdown's <option> values are static HTML (crawlable), not rendered
// from PARTNER_INVENTORY — this just checks they still match so the two
// can't silently drift apart, same pattern as milestones.js's ladder check.
{
  const select = document.getElementById("pMilestone");
  const htmlValues = [...select.options]
    .map((o) => o.value)
    .filter(Boolean)
    .map(Number);
  const configValues = PARTNER_INVENTORY.map((i) => i.milestone);
  const inSync =
    htmlValues.length === configValues.length &&
    htmlValues.every((v, i) => v === configValues[i]);
  if (!inSync) {
    console.warn("[partner] milestone dropdown out of sync with PARTNER_INVENTORY", {
      html: htmlValues,
      config: configValues,
    });
  }
}

function showStatus(kind, message) {
  statusEl.className = "status " + kind;
  statusEl.textContent = message;
  statusEl.hidden = false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.hidden = true;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // Honeypot filled in: pretend it worked, send nothing.
  if (form.elements.botcheck.checked) {
    showStatus("ok", "Thanks! Your inquiry has been sent.");
    form.reset();
    return;
  }

  const payload = {
    access_key: ACCESS_KEY,
    subject: BASE_SUBJECT,
    from_name: "CWTW Partner Inquiry",
    brand_name: form.elements.brand.value.trim(),
    website: form.elements.website.value.trim(),
    email: form.elements.email.value.trim(),
    milestone: form.elements.milestone.value,
    offer: form.elements.offer.value.trim(),
    botcheck: "",
  };

  sendBtn.disabled = true;
  sendBtn.textContent = "Sending…";

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      showStatus("ok", "Thanks! Your inquiry has been sent. We usually reply within a couple of days.");
      form.reset();
    } else {
      throw new Error(data.message || "Request failed");
    }
  } catch {
    statusEl.className = "status err";
    statusEl.textContent = "Sorry, your inquiry couldn't be sent. Please email us directly at ";
    const link = document.createElement("a");
    link.href = "mailto:" + FALLBACK_EMAIL;
    link.textContent = FALLBACK_EMAIL;
    statusEl.append(link, ".");
    statusEl.hidden = false;
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = BTN_LABEL;
  }
});
