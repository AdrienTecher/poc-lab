// Everything in this world is drawn as SVG, so these two are the whole toolkit.
const NS = "http://www.w3.org/2000/svg";

export const $ = (sel, root = document) => root.querySelector(sel);

export const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  return node;
};

/** Fingers are wider than a clover stem: give a small prop a real tap target. */
export const tapTarget = (group, width, height, y) =>
  group.appendChild(el("rect", { x: -width / 2, y, width, height, fill: "transparent" }));
