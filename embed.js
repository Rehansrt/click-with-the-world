(function () {
  var THIS_ORIGIN = "https://clickwiththeworld.fun";
  var script = document.currentScript;
  if (!script) return;

  var width = script.getAttribute("data-width") || "300";
  var height = script.getAttribute("data-height") || "150";

  var iframe = document.createElement("iframe");
  iframe.src = THIS_ORIGIN + "/embed";
  iframe.width = width;
  iframe.height = height;
  iframe.style.border = "0";
  iframe.style.borderRadius = "18px";
  iframe.style.colorScheme = "normal";
  iframe.title = "Click With The World — live click counter";
  iframe.loading = "lazy";

  script.parentNode.insertBefore(iframe, script.nextSibling);
})();
