export default (function createLoadingOverlayModule() {
  const ID = "pb-framework-loading-overlay";
  let shown = false;

  function ensure() {
    if (document.getElementById(ID)) return;
    const el = document.createElement("div");
    el.id = ID;
    el.style.cssText = [
      "position:fixed",
      "inset:0",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:rgba(0,0,0,0.35)",
      "z-index:9999",
      "visibility:hidden",
      "opacity:0",
      "transition:opacity .18s, visibility .18s",
    ].join(";");
    el.innerHTML = `<div style="padding:14px 20px;border-radius:8px;display:flex;gap:12px;align-items:center;">
      <div style="width:18px;height:18px;border-radius:50%;border:3px solid #ccc;border-top-color:#333;animation:pbspin .8s linear infinite"></div>
      <div id="pb-loading-overlay-text">Loading…</div>
    </div>
    <style>@keyframes pbspin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(el);
  }

  function show(text = "Loading…") {
    ensure();
    const el = document.getElementById(ID);
    const txt = el.querySelector("#pb-loading-overlay-text");
    if (txt) txt.textContent = text;
    el.style.visibility = "visible";
    el.style.opacity = "1";
    shown = true;
  }

  function hide() {
    const el = document.getElementById(ID);
    if (!el || !shown) return;
    el.style.opacity = "0";
    setTimeout(() => { if (el) el.style.visibility = "hidden"; }, 200);
    shown = false;
  }

  return { show, hide };
})();