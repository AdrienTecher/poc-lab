// The crossing: a drift of fleece that closes over the world and opens on
// somewhere else.
//
// He is named after a cloud and his shorn fleece already becomes one — scenery.js
// floats every one he loses up into the cloud bank. So the thing that covers a
// change of place is made of the same stuff he is, rather than a fade to black or
// a slide, both of which would be a screen doing something rather than the world.
//
// It covers exactly ONE kind of change: stepping between the meadow and a place.
// Walking the valley is deliberately left uncovered — he crosses ground on screen
// and watching him do it is the entire design of travel, so registry.mount() takes
// a `quiet` flag and travel uses it.
//
// Nothing depends on this. It is built only when motion is welcome, so under
// prefers-reduced-motion there is no curtain at all rather than a still one.
import { $ } from "../engine/svg.js";
import { REDUCED } from "../engine/math.js";
import { onSwap } from "../places/registry.js";

// Two phases, not one. A single animation covered and uncovered symmetrically,
// and the backing reached full opacity while the blobs were still growing — so the
// whole thing read as a flat cream rectangle and the fleece was never visible as
// fleece. Closing wants to be quick and together; OPENING is the half anybody
// actually watches, because it is where you find out where you are, so it is
// slower and staggered and the cloud parts across the frame.
//
// COVER must outlast the crossfade underneath: .meadow takes 520ms to drop away,
// so the hold has to still be down at 520 and the parting start after it.
const COVER = 380, HOLD = 220, PART = 700;

// Where each puff sits and how big it is. Hand-placed rather than random: a drift
// wants to look composed, and a random one leaves gaps on some viewport nobody
// tested. Nine of them, staggered in three beats so the edge rolls in rather than
// arriving all at once.
const PUFFS = [
  [-6, 34, 38], [8, 72, 33], [22, 26, 41], [36, 64, 36], [50, 38, 44],
  [64, 76, 34], [78, 30, 40], [92, 62, 37], [106, 44, 39],
];

let node = null, closeAt = 0, openAt = 0;

export const build = () => {
  if (REDUCED) return;
  node = document.createElement("div");
  node.className = "puffs";
  node.setAttribute("aria-hidden", "true");
  for (const [i, [x, y, size]] of PUFFS.entries()) {
    const puff = document.createElement("i");
    puff.className = "puff";
    puff.style.left = `${x}%`;
    puff.style.top = `${y}%`;
    puff.style.width = `${size}vmax`;
    puff.style.height = `${size}vmax`;
    // one stagger, used at full strength when the cloud parts and at a third of it
    // on the way in — so closing reads as together and opening reads as a sweep
    puff.style.setProperty("--d", `${i * 26}ms`);
    node.appendChild(puff);
  }
  // On the BODY, not in the scene. Inside `.scene` its z-index is trapped by that
  // element's isolation:isolate, so it can only ever pass under the HUD — and the
  // HUD is white text on a translucent white chip, which over a fleece the same
  // colour ghosts into something you cannot read. A crossing that leaves unreadable
  // chrome floating on it is worse than one that covers everything: the two clocks
  // are stored epochs derived on read, so half a second behind the wool costs
  // nothing and gets them back exactly right.
  document.body.appendChild(node);
  onSwap(sweep);
};

/** Close over the world, then part again. Restarting mid-sweep is a real case —
 *  Escape out of a place and straight back in — so every class is dropped and the
 *  layout forced before they go back on, or the animation would not replay.
 *
 *  `sweeping` is up for the whole of it and the phases sit inside it, which gives
 *  anything watching from outside one thing to look at rather than two. */
export const sweep = () => {
  if (!node) return;
  clearTimeout(closeAt); clearTimeout(openAt);
  node.classList.remove("sweeping", "crossing", "parting");
  void node.offsetWidth;
  node.classList.add("sweeping", "crossing");
  closeAt = setTimeout(() => {
    node.classList.replace("crossing", "parting");
  }, COVER + HOLD);
  openAt = setTimeout(() => {
    node.classList.remove("sweeping", "parting");
  }, COVER + HOLD + PART);
};
