// Menú móvil: el botón de tres rayas abre y cierra el panel de enlaces.
(function () {
  var btn = document.querySelector(".nav-toggle");
  var panel = document.getElementById("navlinks");
  if (!btn || !panel) return;
  function set(open) {
    panel.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  }
  btn.addEventListener("click", function (e) { e.stopPropagation(); set(!panel.classList.contains("open")); });
  document.addEventListener("click", function (e) {
    if (panel.classList.contains("open") && !panel.contains(e.target)) set(false);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
})();
