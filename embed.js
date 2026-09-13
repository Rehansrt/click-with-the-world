(function () {
  var THIS_ORIGIN = "https://click-with-the-world.vercel.app";
  var script = document.currentScript;
  if (!script) return;

  var width = script.getAttribute("data-width") || "240";
  var height = script.getAttribute("data-height") || "170";

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
