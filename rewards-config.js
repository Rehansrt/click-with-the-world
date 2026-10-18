// Deals listed on /rewards. Static and manually maintained, same idea as
// sponsor-config.js: edit this file to add, change or remove a deal; the page
// builds its cards from it, so no HTML changes are needed.
//
// Fields (per deal):
//   category — short tag shown at the top of the card.
//   title    — product name.
//   blurb    — one short line about it. No prices.
//   url      — the store's affiliate link.
//   store    — store name, used for the button: "View on <store> →".
//   note     — optional; one small muted line under the blurb, e.g. a
//              store's offer and its terms.
//
// Text only: no product images or logos on the page.

export const REWARDS = [
  {
    category: "Audio",
    title: "boAt Official Store",
    blurb: "Earbuds, headphones, speakers and smartwatches from boAt's own store.",
    url: "https://inr.deals/track?id=srt479226254&src=merchant-detail-backend&campaign=cps&url=https%3A%2F%2Fwww.boat-lifestyle.com%2F",
    store: "boAt",
    note: "Code BTXINR5: 5% off prepaid orders, min. order ₹1000, valid till 31 Dec 2026. Offer terms set by the store.",
  },
  { category: "Audio", title: "Wireless Earbuds", blurb: "Everyday wireless earbuds", url: "https://fktr.in/Vq24mVd", store: "Flipkart" },
  { category: "Wearables", title: "boAt Wave Fury Smartwatch", blurb: "Smartwatch with fitness tracking", url: "https://fktr.in/BpUrckE", store: "Flipkart" },
  { category: "Audio", title: "boAt Bar 480 Speaker", blurb: "Portable Bluetooth speaker", url: "https://fktr.in/0A7fS2L", store: "Flipkart" },
  { category: "Gadgets", title: "Mi 20000mAh Power Bank", blurb: "High-capacity power bank", url: "https://fktr.in/GVHD6tJ", store: "Flipkart" },
  { category: "Gaming", title: "Logitech G102 Gaming Mouse", blurb: "Wired gaming mouse", url: "https://fktr.in/J5rQaBm", store: "Flipkart" },
  { category: "Fashion", title: "Asian Casual Sneakers", blurb: "Casual everyday sneakers", url: "https://fktr.in/M30rLm0", store: "Flipkart" },
  { category: "Fashion", title: "Lavie Satchel Handbag", blurb: "Satchel handbag", url: "https://fktr.in/S80sF8P", store: "Flipkart" },
  { category: "Travel", title: "American Tourister Valex Backpack", blurb: "Laptop/travel backpack", url: "https://fktr.in/d84JMxb", store: "Flipkart" },
  { category: "Home", title: "Sturlite Tozo Desk Lamp", blurb: "Study/desk lamp", url: "https://fktr.in/iCrIvuC", store: "Flipkart" },
  { category: "Home", title: "Go24 500ml Bottle", blurb: "500ml water bottle", url: "https://fktr.in/N1l3LVe", store: "Flipkart" },
];
