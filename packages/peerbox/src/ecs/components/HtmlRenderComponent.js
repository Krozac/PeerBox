export function HtmlRenderComponent({ id, classes = [], style = {}, html = "" } = {}) {
  return {
    id,
    classes,
    style,
    html,
    parentSelector,
    // Don't include `element` in the component itself!
  };
}