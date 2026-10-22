/* CECT temporary sandbox KYC preview CTA.
   Visible on the public landing page only. No personal data or cookies accessed. */
(function () {
  "use strict";
  if (window.location.pathname !== "/") return;
  if (document.getElementById("cect-kyc-preview-entry")) return;
  var box = document.createElement("aside");
  box.id = "cect-kyc-preview-entry";
  box.setAttribute("aria-label", "Démonstration KYC CECT");
  box.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:9500;max-width:min(390px,calc(100% - 36px));background:#082f24;color:#fff;border:1px solid #2c7459;border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.25);padding:15px 48px 15px 17px;font:14px/1.5 system-ui,-apple-system,sans-serif";
  var a = document.createElement("a");
  a.href = "/verification-kyc-demo.html";
  a.style.cssText = "text-decoration:none;color:#fff;font-weight:750;display:block";
  var title = document.createElement("span");
  title.textContent = "🛡 Nouveau : KYC CECT × Didit";
  title.style.cssText = "font-size:15px;display:block";
  var small = document.createElement("span");
  small.textContent = "Découvrez les parcours PF et PM · démonstration Sandbox →";
  small.style.cssText = "display:block;font-size:12px;margin-top:4px;color:#baead7;font-weight:450";
  a.append(title, small);
  var close = document.createElement("button");
  close.type = "button";
  close.setAttribute("aria-label", "Fermer l'annonce KYC");
  close.textContent = "×";
  close.style.cssText = "position:absolute;right:11px;top:8px;color:#b4decf;font-size:22px;cursor:pointer;background:transparent;border:0;padding:5px 9px";
  close.addEventListener("click", function () { box.remove(); });
  box.append(a, close);
  document.body.appendChild(box);
})();
