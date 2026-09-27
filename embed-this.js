// Embed generator: size presets, snippet tabs, copy button. No Firebase here —
// the live preview is the real /embed iframe, which has its own connection.
const ORIGIN = "https://www.clickwiththeworld.fun";

const sizeButtons = [...document.querySelectorAll(".eg-size")];
const tabButtons = [...document.querySelectorAll(".eg-tab")];
const preview = document.getElementById("previewFrame");
const codeBox = document.getElementById("codeBox");
const codeNote = document.getElementById("codeNote");
const copyBtn = document.getElementById("copyBtn");
const copyStatus = document.getElementById("copyStatus");

const NOTES = {
  script: "Drop this where you want the widget to appear. It injects the iframe automatically, so no extra markup is needed.",
  iframe: "Plain HTML, if you'd rather not run a script. Paste this directly wherever you want the widget.",
};

let width = 300;
let height = 150;
let tab = "script";

// Exact formats already given out; only the domain is now the www host.
function snippet(kind) {
  if (kind === "script") {
    return `<script src="${ORIGIN}/embed.js" data-width="${width}" data-height="${height}" async></` + `script>`;
  }
  return `<iframe src="${ORIGIN}/embed" width="${width}" height="${height}" style="border:0;" title="Click With The World — live click counter" loading="lazy"></iframe>`;
}

function render() {
  preview.width = width;
  preview.height = height;
  codeBox.textContent = snippet(tab);
  codeNote.textContent = NOTES[tab];
}

sizeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    width = Number(btn.dataset.w);
    height = Number(btn.dataset.h);
    sizeButtons.forEach((b) => {
      const on = b === btn;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    render();
  });
});

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tab = btn.dataset.tab;
    tabButtons.forEach((b) => {
      const on = b === btn;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    render();
  });
});

function fallbackCopy() {
  const range = document.createRange();
  range.selectNodeContents(codeBox);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

copyBtn.addEventListener("click", async () => {
  const label = "Copy Code";
  let ok = false;
  try {
    await navigator.clipboard.writeText(codeBox.textContent);
    ok = true;
  } catch {
    ok = fallbackCopy();
  }
  copyBtn.textContent = ok ? "Copied" : "Press Ctrl+C to copy";
  copyStatus.textContent = ok ? "Code copied to clipboard" : "Copy failed; the code is selected, press Ctrl+C";
  setTimeout(() => {
    copyBtn.textContent = label;
  }, 1800);
});

render();
