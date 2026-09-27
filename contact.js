// Contact form -> Web3Forms (fetch/JSON, no redirect). The access key is
// public by design (it only allows sending to this site's own inbox).
const ENDPOINT = "https://api.web3forms.com/submit";
const ACCESS_KEY = "bf23ed6a-8c63-4c90-afb5-1b1cea81edca";
const BASE_SUBJECT = "New message — Click With The World";
const FALLBACK_EMAIL = "hello@clickwiththeworld.fun";

const form = document.getElementById("contactForm");
const sendBtn = document.getElementById("sendBtn");
const statusEl = document.getElementById("formStatus");
const BTN_LABEL = sendBtn.innerHTML;

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
    showStatus("ok", "Thanks! Your message has been sent.");
    form.reset();
    return;
  }

  const topic = form.elements.topic.value;
  const payload = {
    access_key: ACCESS_KEY,
    subject: topic ? `${BASE_SUBJECT} [${topic}]` : BASE_SUBJECT,
    from_name: "CWTW Contact",
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    message: form.elements.message.value.trim(),
    topic: topic || "(none)",
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
      showStatus("ok", "Thanks! Your message has been sent. We usually reply within a couple of days.");
      form.reset();
    } else {
      throw new Error(data.message || "Request failed");
    }
  } catch {
    statusEl.className = "status err";
    statusEl.textContent = "Sorry, your message couldn't be sent. Please email us directly at ";
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
