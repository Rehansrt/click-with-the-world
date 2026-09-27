// FAQ search + category filter. The answers are plain HTML (<details>), so the
// page still reads fine without this script.
const sections = [...document.querySelectorAll(".faq-cat")];
const buttons = [...document.querySelectorAll(".cat-btn")];
const search = document.getElementById("faqSearch");
const emptyMsg = document.getElementById("faqEmpty");

let current = "general";

function render() {
  const q = search.value.trim().toLowerCase();
  let anyShown = false;

  sections.forEach((section) => {
    let matches = 0;
    section.querySelectorAll("details.qa").forEach((item) => {
      const hit = !q || item.textContent.toLowerCase().includes(q);
      item.hidden = !hit;
      if (hit) matches++;
    });
    // Searching looks across every category; otherwise only the chosen one.
    const show = q ? matches > 0 : section.dataset.cat === current;
    section.hidden = !show;
    if (show) anyShown = true;
  });

  emptyMsg.hidden = anyShown;

  buttons.forEach((btn) => {
    const active = !q && btn.dataset.cat === current;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    search.value = "";
    current = btn.dataset.cat;
    render();
  });
});

search.addEventListener("input", render);
render();
