import { HtmlRenderComponent, PositionComponent } from "../components/index.js";

const renderedElements = new Map(); // entityId -> el

export function HtmlRenderSystem(world, defaultParentSelector = "#ui-root") {
  const currentEntityIds = new Set(world.query([HtmlRenderComponent]));

  // CLEANUP removed entities
  for (const [entityId, el] of renderedElements.entries()) {
    if (!currentEntityIds.has(entityId)) {
      if (el.parentElement) el.parentElement.removeChild(el);
      renderedElements.delete(entityId);
    }
  }

  // RENDER/UPDATE entities
  for (const id of currentEntityIds) {
    const htmlRenderComponent = world.getComponent(id, HtmlRenderComponent);
    if (!htmlRenderComponent) continue;

    // try to get existing element or create new
    let el = renderedElements.get(id);
    if (!el) {
      el = document.createElement(htmlRenderComponent.tagName || "div");
      renderedElements.set(id, el);
    }

    // ensure correct parent
    const parentSelector =
      htmlRenderComponent.parentSelector || defaultParentSelector;
    const parent = document.querySelector(parentSelector);
    if (!parent) {
      console.warn(`HtmlRenderSystem: No element found for selector ${parentSelector}`);
      continue;
    }
    if (!el.parentElement || el.parentElement !== parent) {
      parent.appendChild(el);
    }

    // update id
    if (htmlRenderComponent.id && el.id !== htmlRenderComponent.id) {
      el.id = htmlRenderComponent.id;
    }

    // update classes
    if (htmlRenderComponent.classes) {
      el.className = ""; // reset
      el.classList.add(...htmlRenderComponent.classes);
    }

    // update style
    if (htmlRenderComponent.style) {
      Object.assign(el.style, htmlRenderComponent.style);
    }

    // update inner HTML (you could optimize with diffing if needed)
    if (htmlRenderComponent.html && el.innerHTML !== htmlRenderComponent.html) {
      el.innerHTML = htmlRenderComponent.html;
    }

    // position handling
    const pos = world.getComponent(id, PositionComponent);
    if (pos) {
      el.style.position = "absolute";
      el.style.left = pos.x + "px";
      el.style.top = pos.y + "px";
    }
  }
}
