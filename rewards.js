// /rewards — builds the deal cards from rewards-config.js. Text only; every
// value goes in with textContent, and every link is marked as a paid link.
import { REWARDS } from "./rewards-config.js";

const grid = document.getElementById("rewardsGrid");

for (const deal of REWARDS) {
  const card = document.createElement("article");
  card.className = "rw-card";

  const tag = document.createElement("span");
  tag.className = "rw-tag";
  tag.textContent = deal.category;

  const title = document.createElement("h2");
  title.className = "rw-title";
  title.textContent = deal.title;

  const blurb = document.createElement("p");
  blurb.className = "rw-blurb";
  blurb.textContent = deal.blurb;

  const link = document.createElement("a");
  link.className = "btn-outline rw-btn";
  link.href = deal.url;
  link.target = "_blank";
  link.rel = "sponsored nofollow noopener noreferrer";
  link.textContent = `View on ${deal.store} →`;

  card.append(tag, title, blurb, link);
  grid.append(card);
}
