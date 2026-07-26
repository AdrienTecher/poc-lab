// The diorama kit: a 2:1 dimetric projection and the three-faced solids it
// draws. One function, no matrices — fractional grid coordinates are legal
// everywhere, and every rig is authored in tile space rather than pixels.
import { el } from "./svg.js";
import { rand } from "./math.js";

export const IW = 46, IH = 23, IZ = 30, IOX = 468, IOY = 134;   // 2:1 dimetric, one function, no matrices
export const isoX = (gx, gy) => IOX + (gx - gy) * IW;
export const isoY = (gx, gy, gz = 0) => IOY + (gx + gy) * IH - gz * IZ;
export const pt = (gx, gy, gz) => `${isoX(gx, gy).toFixed(1)},${isoY(gx, gy, gz).toFixed(1)}`;

export const poly = (layer, points, fill, opacity) => {
  const n = el("polygon", { points, fill });
  if (opacity !== undefined) n.setAttribute("opacity", opacity);
  layer.appendChild(n);
  return n;
};
export const boxAt = (layer, gx, gy, w, d, z0, h, top, left, right) => {
  poly(layer, [pt(gx, gy, z0 + h), pt(gx + w, gy, z0 + h), pt(gx + w, gy + d, z0 + h), pt(gx, gy + d, z0 + h)].join(" "), top);
  poly(layer, [pt(gx, gy + d, z0 + h), pt(gx + w, gy + d, z0 + h), pt(gx + w, gy + d, z0), pt(gx, gy + d, z0)].join(" "), left);
  poly(layer, [pt(gx + w, gy, z0 + h), pt(gx + w, gy + d, z0 + h), pt(gx + w, gy + d, z0), pt(gx + w, gy, z0)].join(" "), right);
};

export const pine = (layer, gx, gy, scale = 1) => {
  const x = isoX(gx, gy), y = isoY(gx, gy, 1);
  const g = el("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})` });
  g.appendChild(el("ellipse", { cx: 0, cy: 0, rx: 15, ry: 6, fill: "#2c3a2e", opacity: ".16" }));
  g.appendChild(el("polygon", { points: "-3.5,0 3.5,0 2.5,-16 -2.5,-16", fill: "var(--iso-wood-r)" }));
  for (const [w, base, top] of [[19, -12, -40], [14, -32, -58]]) {
    g.appendChild(el("polygon", { points: `${-w},${base} 0,${base + 4} 0,${top}`, fill: "var(--iso-pine-l)" }));
    g.appendChild(el("polygon", { points: `${w},${base} 0,${base + 4} 0,${top}`, fill: "var(--iso-pine-r)" }));
    g.appendChild(el("polygon", { points: `${-w},${base} ${w},${base} 0,${top}`, fill: "var(--iso-pine)", opacity: ".0" }));
  }
  layer.appendChild(g);
  return g;
};

