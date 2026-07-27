// La carte — the valley seen from far enough back to see all of it.
//
// Researched before written. The two systems this borrows from solve different
// halves of the problem and neither solves both:
//
//   Dofus lays its world out as a contiguous grid you leave by walking off the edge,
//   and since the 16:9 rework the borders show a live PREVIEW of the adjacent map —
//   real scenery, real resource state, no NPCs. Orientation beyond that is a separate
//   illustrated world-map screen, which is a drawing OF the world rather than the
//   world, and cannot show you anything true about it.
//
//   Waven drops the contiguity entirely: discrete islands on a node graph, unlocked
//   by progression, sailed between. Excellent for saying "here is everywhere and what
//   is open", useless for saying "what is next door".
//
// This valley is structurally Waven — six places on two unlock branches — but drawn
// like Dofus, as one continuous strip. So the map is neither a panel nor a node graph:
// it is the SHOT WIDENING until the whole strip is in it. Every diorama already lives
// in one shared coordinate space, so pulling the camera back reveals the real places,
// live, with his own sheep standing in one of them. Nothing is drawn twice and nothing
// can drift out of date, which is the thing an illustrated world map cannot promise.
//
// What it improves on, specifically: Dofus's map cannot show you the state of a place
// (is the board half-played? is the fence lit?) because it is a different artwork.
// This one shows it because it IS the place. And unlike Waven's graph it keeps the
// geography — you can see that le pont is between la grange and le clocher.
import { $, el } from "../engine/svg.js";
import { say } from "../ui/copy.js";
import { REDUCED } from "../engine/math.js";
import { VB_X, VB_Y, VB_W, VB_H, PITCH, centre, view, wide } from "../engine/camera.js";
import { announce, setHint } from "../ui/hint.js";
import { refreshCTM } from "../world/pointer.js";
import * as valley from "../world/valley.js";
import { active, roster, onSwap } from "./registry.js";
import * as neighbours from "./neighbours.js";
import { go } from "./travel.js";

const root = document.documentElement;
const front = $("#valleyFront");

const MARGIN = 0.16;     // a sixth of a frame of air either side of the strip
let labels = null;
let open = false;

/** The frames worth showing: everywhere he has opened, in road order. */
const shown = () => roster().filter((p) => valley.opened(p.id)).sort((a, b) => a.road - b.road);

/** The shot that holds all of them, and where its middle is. */
const fit = () => {
  const list = shown();
  const lo = list[0].road, hi = list.at(-1).road;
  const span = (hi - lo + 1 + MARGIN * 2) * PITCH;
  return { width: span, centreX: (centre(lo) + centre(hi)) / 2 };
};

/** A name over each frame, and a ring round the one he is in. Built into the front
 *  layer so it scales with the shot rather than floating over it — these are places
 *  in the world being labelled, not buttons in a panel. */
const build = () => {
  if (labels) return;
  labels = el("g", { class: "carte" });
  front.appendChild(labels);
};

const paintLabels = () => {
  labels.replaceChildren();
  if (!open) return;
  const here = active();
  // The names are sized in SCREEN pixels and converted back, because guessing a
  // counter-scale got it wrong twice: dividing by width/VB_W is not the shrink
  // factor, since `meet` fits to the height when the shot is narrow and to the WIDTH
  // when it is wide, and those give 1.345 and 0.280. So ask what the target scale
  // will be and undo exactly that. u(16) is sixteen pixels, at any width, on any
  // screen — and a frame is only ~200px across at six of them, which is why the
  // plate has to be told a real size rather than a big number.
  const b = front.getBoundingClientRect();
  const sc = Math.min(b.width / fit().width, b.height / VB_H) || 1;
  const u = (px) => px / sc;
  for (const p of shown()) {
    const cx = centre(p.road);
    const g = el("g", { class: "carte__spot", tabindex: "0", role: "button", "data-place": p.id });
    g.setAttribute("aria-label", `Aller vers ${p.label[0]} — go to ${p.label[1]}`);
    if (p === here) g.classList.add("here");

    // the tap target is the whole frame, because the whole frame IS the place
    g.appendChild(el("rect", {
      class: "carte__field", x: cx - PITCH / 2, y: VB_Y, width: PITCH, height: VB_H,
    }));
    const plate = el("g", {
      class: "carte__plate",
      transform: `translate(${cx} ${(VB_Y + VB_H - u(16)).toFixed(1)})`,
    });
    plate.appendChild(el("rect", {
      class: "carte__pad",
      x: (-u(58)).toFixed(1), y: (-u(13)).toFixed(1),
      width: u(116).toFixed(1), height: u(21).toFixed(1), rx: u(10.5).toFixed(1),
    }));
    const name = el("text", {
      class: "carte__name", x: 0, y: u(5).toFixed(1), "text-anchor": "middle",
      "font-size": u(13).toFixed(1),
    });
    name.textContent = p.label[0];
    plate.appendChild(name);
    g.appendChild(plate);

    const pick = (e) => {
      e.preventDefault?.(); e.stopPropagation?.();
      if (p === here) { close(); return; }
      close();
      go(p.id);
    };
    g.addEventListener("pointerdown", pick);
    g.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") pick(e); });
    labels.appendChild(g);
  }
};

export const showing = () => open;

export const show = () => {
  if (open || !active()) return;
  build();
  open = true;
  root.dataset.carte = "1";
  // Every opened place goes live. Ordinarily only he and his two neighbours are in the
  // document; here the whole valley is, because the whole valley is what a map is for.
  //
  // Three things each of these calls is doing. wake() builds a place and puts its
  // bands in — but its PIECES are only registered with depth.js and reach the DOM on
  // the first sort(), which lives in frame(), so a neighbour would come up as decor
  // with no bales and no lanterns. frame(0, 0) sorts them in without advancing
  // anything, since every step scales its work by dt. And peek(false) un-inerts them:
  // a place you can travel to from here is not a place you are merely looking at.
  for (const p of shown()) { p.wake(); p.frame(0, 0); p.peek?.(false); }
  const { width, centreX } = fit();
  view(centreX, width);
  paintLabels();
  setTimeout(refreshCTM, REDUCED ? 0 : 320);
  const names = shown().map((p) => p.label[0]).join(", ");
  announce(say.carte.said(names, active().label[0]));
  setHint(...say.carte.how);
};

export const close = () => {
  if (!open) return;
  open = false;
  delete root.dataset.carte;
  const here = active();
  // ...and the view settles back to him and what is beside him
  neighbours.settle(here);
  view(centre(here.road), VB_W);
  paintLabels();
  setTimeout(refreshCTM, REDUCED ? 0 : 320);
};

export const toggle = () => (open ? close() : show());

export const build_ = build;

export const bind = () => {
  $("#mapBtn").addEventListener("click", toggle);
  addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "m" && active()) { e.preventDefault(); toggle(); return; }
    // Escape closes the map before it leaves the place — one key, the nearer meaning
    // first, which is what every other Escape in this game already does
    if (e.key === "Escape" && open) { e.stopPropagation(); close(); }
  }, true);
  // walking away, arriving, or going home all end the map: it is a view of where he
  // is, and he is somewhere else now
  onSwap(() => { if (open) close(); });
};

/** The valley is not something to look at while it is moving under you. */
export const blockedByTravel = () => open && !wide();
