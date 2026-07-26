import * as save from "./engine/save.js";
import { clamp, lerp, rand, now, REDUCED } from "./engine/math.js";
import { $, el, tapTarget } from "./engine/svg.js";
import { springs, S, set, v, kick, stepSpring, stepSprings } from "./engine/spring.js";
import { sfx } from "./engine/audio.js";
import { attachParticles, heart, sparkle, crumb, tear, tuft, zzz, stepParticles } from "./engine/particles.js";
import { isoX, isoY, pt, poly, boxAt, pine } from "./engine/iso.js";
import { depthLayers } from "./engine/depth.js";
import { state } from "./state.js";
import {
  HAPPY_MS, FADE_MS, PET_TARGET, DOZE_AFTER,
  WOOL_FULL_MS, SHEAR_TARGET, WOOL_READY, SHEAR_MIN, SHEAR_CALM,
  CLOVERS_TO_UNLOCK,
} from "./rules.js";

(() => {
  "use strict";

  const svg = $("#sheep"), stage = $("#stage"), fx = $("#fx");
  const live = $("#live"), hintEl = $("#hint"), hintText = $("#hintText");
  attachParticles(fx);

  // restore an in-flight happiness window so a reload doesn't betray him
  if (save.data.sheep.happyUntil > Date.now()) {
    state.happyUntil = save.data.sheep.happyUntil;
    state.mood = 1;
    state.everCuddled = true;
  }
  // A first visit starts mid-fleece — write that epoch down straight away, or a
  // player who never shears would start over at 45% on every reload.
  if (save.data.sheep.woolFrom > 0) state.woolFrom = save.data.sheep.woolFrom;
  else { save.data.sheep.woolFrom = state.woolFrom; save.touch(true); }
  state.fed = save.data.care.fed;
  state.sound = save.data.prefs.sound;

  const woolNow = () => clamp((Date.now() - state.woolFrom) / WOOL_FULL_MS, 0, 1);
  let woolWrote = 0;
  const setWool = (v) => { state.woolFrom = Date.now() - clamp(v, 0, 1) * WOOL_FULL_MS; };
  const saveWool = (force) => {
    if (!force && Date.now() - woolWrote < 500) return;
    woolWrote = Date.now();
    save.data.sheep.woolFrom = state.woolFrom;
    save.touch(force);
  };
  addEventListener("pagehide", () => saveWool(true));
  state.wool = woolNow();

  S("lean", 0, 90, 13);      // head tilt, degrees
  S("gazeX", 0, 110, 15);
  S("gazeY", 0, 110, 15);
  S("hop", 0, 150, 11);      // vertical body offset, driven by impulses
  S("earL", 0, 130, 12);
  S("earR", 0, 130, 12);
  S("tail", 0, 170, 11);
  S("sway", 0, 60, 10);
  S("mouth", -1, 80, 13);    // -1 frown … +1 grin
  S("brow", 1, 80, 13);
  S("open", 0, 190, 14);     // mouth opening, for bleats and chewing
  S("moodS", state.mood, 26, 10);
  // How he takes the blades: -1 flinching away, +1 leaning into them. Slow hands
  // earn trust, fast ones lose it. Wool is a body state; mood is a feeling state —
  // this spring is body, and must never be wired into --m.
  S("nerve", 0, 40, 11);

  /* ------------------------------------------------------------------ *
   * Wool: a ring of blobs around an ellipse. Each breathes on its own phase
   * and gets pushed aside by the petting hand.
   * ------------------------------------------------------------------ */
  // Blobs keep their polar definition rather than a baked position, because the
  // fleece length rescales the ring and the curls independently every frame.
  const blobs = [];
  const addBlobs = (parent, part, cx, cy, rx, ry, count, radius, from = -Math.PI, span = Math.PI * 2) => {
    for (const i of [...Array(count).keys()]) {
      const a = from + (span * i) / count;
      const b = {
        node: el("circle"), part,
        cx, cy, rx, ry, ca: Math.cos(a), sa: Math.sin(a),
        bx: cx + Math.cos(a) * rx, by: cy + Math.sin(a) * ry,
        r: radius + Math.sin(i * 2.7) * radius * 0.15,
        phase: rand(0, Math.PI * 2),
        speed: rand(0.8, 1.5),
      };
      parent.appendChild(b.node);
      blobs.push(b);
    }
  };
  addBlobs($("#woolBody"), "body", 200, 240, 88, 52, 16, 28);
  addBlobs($("#woolHead"), "head", 200, 186, 45, 42, 7, 18, -Math.PI * 0.97, Math.PI * 0.94);

  /* ------------------------------------------------------------------ *
   * Scenery: sun rays, cloud bank, grass, flowers, clovers
   * ------------------------------------------------------------------ */
  const rays = $("#rays");
  for (const i of [...Array(12).keys()]) {
    const s = document.createElement("span");
    s.style.transform = `rotate(${i * 30}deg)`;
    rays.appendChild(s);
  }

  const bank = $("#cloudbank");
  for (const i of [...Array(5).keys()]) {
    const g = el("g", { class: "puff" });
    g.setAttribute("transform", `translate(${rand(0, 900)} ${50 + i * 46 + rand(-14, 14)}) scale(${rand(0.65, 1.3)})`);
    g.style.animationDuration = `${rand(95, 180)}s`;
    g.style.animationDelay = `${-rand(0, 140)}s`;
    for (const [cx, cy, r] of [[0, 0, 26], [30, -11, 34], [64, 2, 24], [30, 12, 30]]) {
      g.appendChild(el("ellipse", { cx, cy, rx: r * 1.3, ry: r * 0.8 }));
    }
    bank.appendChild(g);
  }

  const meadow = $("#meadow"), turf = $("#turf");
  const flowers = [], clovers = [];
  const PETAL = ["#ff9ec4", "#ffd166", "#c9a7ff", "#fff1f5"];

  for (const i of [...Array(88).keys()]) {
    const x = (i / 88) * 1240 - 20 + rand(-7, 7);
    const h = rand(30, 88), w = rand(5, 10), bend = rand(-22, 22);
    const p = el("path", {
      class: "blade",
      d: `M${x},260 C${x + bend * 0.3},${260 - h * 0.5} ${x + bend},${260 - h * 0.8} ${x + bend * 1.2},${260 - h} C${x + bend + w},${260 - h * 0.7} ${x + w},${260 - h * 0.3} ${x + w},260 Z`,
    });
    p.style.animationDuration = `${rand(3, 5.6)}s`;
    p.style.animationDelay = `${-rand(0, 5)}s`;
    turf.appendChild(p);
  }

  for (const i of [...Array(20).keys()]) {
    const anchor = el("g");
    anchor.setAttribute("transform", `translate(${rand(20, 1180)} ${rand(140, 232)})`);
    const g = el("g", { class: "flower" });
    g.style.transitionDelay = `${rand(0, 0.7)}s`;
    const hue = PETAL[i % PETAL.length];
    g.appendChild(el("path", { d: `M0,0 L${rand(-5, 5)},28`, stroke: "#4e9440", "stroke-width": 3.4, "stroke-linecap": "round", fill: "none" }));
    for (const k of [...Array(5).keys()]) {
      const a = (k / 5) * Math.PI * 2;
      g.appendChild(el("circle", { cx: Math.cos(a) * 7, cy: Math.sin(a) * 7, r: 5.6, fill: hue }));
    }
    g.appendChild(el("circle", { r: 4, fill: "#ffdf6e" }));
    anchor.appendChild(g);
    turf.appendChild(anchor);
    flowers.push(g);
  }

  // The meadow viewBox is stretched to the viewport width, which would squash any
  // prop drawn in it — so every prop carries its own counter-scale, redone on resize.
  const props = [];
  const placeProp = (node, x, y, k) => {
    props.push({ node, x, y, k });
    return node;
  };
  const measureUI = () => {
    const top = crossUI.getBoundingClientRect().top;
    if (top) document.documentElement.style.setProperty("--ui-h", `${Math.round(innerHeight - top)}px`);
  };

  const layoutProps = () => {
    const box = meadow.getBoundingClientRect();
    const sx = (box.width || 1200) / 1200, sy = (box.height || 260) / 260;
    // props hold a fixed on-screen size, which crowds them together on a narrow
    // meadow — so they shrink with the width once there is no room to spare
    const fit = clamp(box.width / 900, 0.6, 1);
    for (const p of props) {
      const k = p.k * fit;
      p.node.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${(k * sy / sx).toFixed(4)} ${k})`);
    }
  };

  // clovers are the treat: pick one out of the grass and offer it to him
  const CLOVER_X = [140, 355, 890, 560, 250, 760];
  const addClover = (x) => {
    const g = el("g", { class: "clover", tabindex: "0", role: "button" });
    g.setAttribute("aria-label", "Offrir un trèfle — give him a clover");
    tapTarget(g, 46, 62, -26);
    g.appendChild(el("path", { d: "M0,2 L0,28", stroke: "#3f8a36", "stroke-width": 3, "stroke-linecap": "round", fill: "none" }));
    const leaves = el("g", { class: "clover__leaves" });
    leaves.appendChild(el("use", { href: "#cloverLeaves", fill: "#4ea343" }));
    leaves.appendChild(el("use", { href: "#cloverLeaves", fill: "#69c257", transform: "scale(.82)" }));
    g.appendChild(leaves);
    meadow.appendChild(g);
    g.addEventListener("pointerdown", (e) => { e.stopPropagation(); startDrag(g, e.clientX, e.clientY); });
    g.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); feedFrom(g); } });
    clovers.push(placeProp(g, x, 212, 1.35));
    return g;
  };
  for (const x of CLOVER_X.slice(0, 3)) addClover(x);

  // the shears wait in the grass on the other side of the meadow
  const shearsNode = el("g", { class: "shears", tabindex: "0", role: "button" });
  shearsNode.setAttribute("aria-label", "Prendre les ciseaux pour la tonte — pick up the shears");
  tapTarget(shearsNode, 42, 68, -34);
  shearsNode.appendChild(el("use", { href: "#shearsShape" }));
  meadow.appendChild(shearsNode);
  placeProp(shearsNode, 1145, 206, 2);

  // A shorn fleece floats off and joins the cloud bank — he is named after one.
  const fleeceToCloud = () => {
    const g = el("g", { class: "puff" });
    const scale = rand(0.55, 0.9);
    g.setAttribute("transform", `translate(0 ${rand(70, 150)}) scale(${scale})`);
    const seconds = rand(110, 190);
    g.style.animationDuration = `${seconds}s`;
    // start it mid-drift, at the sky position right above where the fleece let go
    g.style.animationDelay = `${-seconds * 0.5}s`;
    for (const [cx, cy, r] of [[0, 0, 26], [30, -11, 34], [64, 2, 24], [30, 12, 30]]) {
      g.appendChild(el("ellipse", { cx, cy, rx: r * 1.3, ry: r * 0.8 }));
    }
    bank.appendChild(g);
    while (bank.childElementCount > 9) bank.firstElementChild.remove();
  };
  layoutProps();
  addEventListener("resize", layoutProps);

  /* ------------------------------------------------------------------ *
   * Butterflies — idle company, and something for his eyes to follow
   * ------------------------------------------------------------------ */
  const butterflies = [];
  const TINT = ["#ffd9f0", "#fff3b8", "#dbeaff"];
  for (const i of [...Array(3).keys()]) {
    const g = el("g", { class: "bfly", cursor: "pointer" });
    const wing = (sx) => {
      const w = el("g", { fill: TINT[i], opacity: ".95" });
      w.append(
        el("ellipse", { cx: sx * 9, cy: -5, rx: 9.5, ry: 11 }),
        el("ellipse", { cx: sx * 7.5, cy: 7, rx: 7, ry: 8 }),
      );
      return w;
    };
    const wingL = wing(-1), wingR = wing(1);
    g.append(wingL, wingR, el("ellipse", { rx: 2.4, ry: 9, fill: "#5b4a55" }),
      el("path", { d: "M-1,-8 C-4,-14 -7,-15 -9,-16 M1,-8 C4,-14 7,-15 9,-16", stroke: "#5b4a55", "stroke-width": 1.4, fill: "none", "stroke-linecap": "round" }));
    $("#butterflies").appendChild(g);
    const b = { node: g, wingL, wingR, x: 200, y: 150, seed: rand(0, 100), speed: rand(0.22, 0.4), flee: 0, alive: i === 0 };
    g.addEventListener("pointerdown", (e) => { e.stopPropagation(); b.flee = 2.6; poke(); sfx.flutter(); });
    butterflies.push(b);
  }

  /* ------------------------------------------------------------------ *
   * Interaction
   * ------------------------------------------------------------------ */
  const ptr = { x: 200, y: 200, inside: false, speed: 0, at: now(), px: 200, py: 200 };
  const lastClient = { x: innerWidth / 2, y: innerHeight / 2 };
  let ctm = null;
  const refreshCTM = () => { ctm = svg.getScreenCTM(); };
  addEventListener("resize", refreshCTM);
  refreshCTM();

  const toSvg = (e) => {
    if (!ctm) refreshCTM();
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(ctm.inverse());
  };
  // the hit region breathes with the fleece, so a fluffy sheep is a bigger target
  const sheepRX = () => 118 + 42 * state.wool;
  const sheepRY = () => 116 + 32 * state.wool;
  const onSheep = (p) => {
    const dx = (p.x - 200) / sheepRX(), dy = (p.y - 238) / sheepRY();
    return dx * dx + dy * dy <= 1;
  };
  const poke = () => { state.lastPoke = now(); state.dozing = false; };
  let hintTimer = 0;
  const setHint = (fr, en) => {
    hintText.innerHTML = `${fr} <span class="en">· ${en}</span>`;
    hintEl.classList.remove("gone");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintEl.classList.add("gone"), 6500);
  };
  const announce = (msg) => { live.textContent = msg; };

  const goHappy = (isRefresh) => {
    const wasHappy = state.happyUntil > Date.now();
    state.happyUntil = Date.now() + HAPPY_MS;
    save.data.sheep.happyUntil = state.happyUntil;
    save.touch(true);
    if (!wasHappy) {
      sfx.chime(); sfx.bleat(true);
      kick("hop", -330);
      for (const i of [...Array(14).keys()]) setTimeout(() => heart(rand(150, 250), rand(150, 235)), i * 55);
      announce("Nuage sourit : il est heureux pour cinq minutes.");
    } else if (isRefresh) {
      heart(rand(172, 228), 172);
      announce("Câlin renouvelé : cinq minutes de plus.");
    }
    if (!state.everCuddled) { state.everCuddled = true; }
    hintEl.classList.add("gone");
  };

  let petPrev = null, shearPrev = null, keyPetting = false, keyShearing = false;

  svg.addEventListener("pointerdown", (e) => {
    const p = toSvg(e);
    if (state.tool) grabTool(e);
    if (!onSheep(p)) { if (state.tool) dropShears(); return; }
    svg.setPointerCapture?.(e.pointerId);
    poke();
    if (state.tool === "shears") {
      state.shearing = true;
      shearPrev = p;
      kick("earL", -90); kick("earR", 90);
      return;
    }
    state.petting = true;
    petPrev = p;
    stage.classList.add("cuddling");
    kick("earL", -140); kick("earR", 140);
  });

  addEventListener("pointermove", (e) => {
    const p = toSvg(e);
    ptr.x = p.x; ptr.y = p.y; ptr.inside = true;
    lastClient.x = e.clientX; lastClient.y = e.clientY;
    const dtp = Math.max(0.008, now() - ptr.at);
    ptr.speed = lerp(ptr.speed, Math.hypot(p.x - ptr.px, p.y - ptr.py) / dtp, 0.3);
    ptr.at = now(); ptr.px = p.x; ptr.py = p.y;
    state.lastPointer = now();
    if (!state.dozing || onSheep(p)) poke();

    if (state.tool) moveTool(e.clientX, e.clientY);

    if (state.shearing && shearPrev) {
      const d = Math.hypot(p.x - shearPrev.x, p.y - shearPrev.y);
      shearPrev = p;
      if (d > 0.4) shearStroke(p, d);
    } else if (state.petting && petPrev) {
      const d = Math.hypot(p.x - petPrev.x, p.y - petPrev.y);
      petPrev = p;
      if (d > 0.4) {
        const before = state.cuddle;
        state.cuddle = clamp(state.cuddle + d / PET_TARGET, 0, 1);
        if (Math.random() < d / 90) sparkle(p.x + rand(-16, 16), p.y + rand(-16, 16));
        if (Math.random() < d / 700) sfx.purr();
        if (before < 1 && state.cuddle >= 1) goHappy(false);
        else if (state.cuddle >= 1 && Math.random() < d / 500) goHappy(true);
      }
    }
    if (dragging) moveDrag(e.clientX, e.clientY);
  }, { passive: true });

  const endPointer = (e) => {
    if (state.petting) { state.petting = false; petPrev = null; stage.classList.remove("cuddling"); }
    if (state.shearing) { state.shearing = false; shearPrev = null; }
    if (dragging) dropDrag(e);
  };
  addEventListener("pointerup", endPointer);
  addEventListener("pointercancel", endPointer);
  document.addEventListener("pointerleave", () => { ptr.inside = false; });

  const bleat = () => {
    state.bleatUntil = now() + 0.55;
    sfx.bleat(state.mood > 0.5);
    kick("hop", -70); kick("earL", -120); kick("earR", 120);
    poke();
  };

  // a tap that doesn't travel is a poke, not a cuddle: he just answers
  let downAt = 0, downPos = null;
  svg.addEventListener("pointerdown", (e) => { downAt = now(); downPos = toSvg(e); });
  svg.addEventListener("pointerup", (e) => {
    if (!downPos) return;
    const p = toSvg(e);
    if (now() - downAt < 0.35 && Math.hypot(p.x - downPos.x, p.y - downPos.y) < 12 && onSheep(p)) {
      if (game.on) embark("mouton"); else bleat();
    }
    downPos = null;
  });

  /* ---- keyboard: the sheep itself is focusable and holdable ---- */
  const hit = $("#hit");
  hit.setAttribute("tabindex", "0");
  hit.setAttribute("role", "button");
  hit.setAttribute("aria-label", "Caresser Nuage — maintiens Espace pour le câliner");
  hit.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    poke();
    if (e.key === "Enter" && game.on) { embark("mouton"); return; }
    if (state.tool === "shears") keyShearing = state.shearing = true;
    else keyPetting = state.petting = true;
  });
  const stopKeyPet = () => {
    keyPetting = state.petting = false;
    keyShearing = state.shearing = false;
  };
  hit.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") stopKeyPet(); });
  hit.addEventListener("blur", stopKeyPet);
  addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "f" && !game.on) {
      const c = clovers.find((c) => !c.classList.contains("picked"));
      if (c) feedFrom(c);
    }
  });

  /* ---- clover drag & drop ---- */
  let dragging = null;
  const dragNode = document.createElement("div");
  dragNode.className = "drag";
  dragNode.innerHTML =
    `<svg viewBox="-22 -22 44 44"><g><use href="#cloverLeaves" fill="#4ea343"/><use href="#cloverLeaves" fill="#69c257" transform="scale(.82)"/></g></svg>`;

  const moveDrag = (x, y) => { dragNode.style.transform = `translate(${x}px, ${y}px) rotate(${Math.sin(now() * 7) * 9}deg)`; };
  const startDrag = (clover, x, y) => {
    dragging = clover;
    clover.classList.add("picked");
    document.body.appendChild(dragNode);
    moveDrag(x, y);
    poke();
  };
  const regrow = (clover) => setTimeout(() => clover.classList.remove("picked"), 5000);
  const dropDrag = (e) => {
    const clover = dragging;
    dragging = null;
    dragNode.remove();
    const p = toSvg(e);
    // generous drop zone: anywhere near his head counts as an offering
    if (onSheep(p) || Math.hypot(p.x - 200, p.y - 196) < 190) { feed(); regrow(clover); }
    else clover.classList.remove("picked");
  };
  const feedFrom = (clover) => { clover.classList.add("picked"); feed(); regrow(clover); };

  const feed = () => {
    state.chewUntil = now() + 2.1;
    poke();
    sfx.munch();
    kick("earL", -180); kick("earR", 180);
    for (const i of [...Array(8).keys()]) setTimeout(() => crumb(200 + rand(-14, 14), 206), i * 70);
    // a treat doesn't buy happiness — only a cuddle does — but it tops up a
    // window that is already running, which is how a well-fed sheep stays happy.
    state.fed = Math.min(state.fed + 1, CLOVERS_TO_UNLOCK);
    save.data.care.fed = state.fed;
    save.touch(true);
    updateSprout();
    if (state.fed >= CLOVERS_TO_UNLOCK) setTimeout(unlockRiver, 700);
    if (state.happyUntil > Date.now()) {
      state.happyUntil = Math.min(state.happyUntil + 30000, Date.now() + HAPPY_MS);
      save.data.sheep.happyUntil = state.happyUntil;
      setTimeout(() => heart(200, 172), 900);
      announce("Nuage croque le trèfle : trente secondes de bonheur en plus.");
    } else {
      announce("Nuage croque le trèfle, mais ce sont les câlins qui le rendent heureux.");
    }
  };

  /* ------------------------------------------------------------------ *
   * Shearing — the fleece grows on a fifteen-minute clock and has to come off
   * ------------------------------------------------------------------ */
  const toolCursor = document.createElement("div");
  toolCursor.className = "tool-cursor";
  toolCursor.innerHTML = `<svg viewBox="-26 -36 52 68"><use href="#shearsShape"/></svg>`;

  const moveTool = (x, y) => {
    const tilt = state.shearing ? Math.sin(now() * 24) * 15 : -10;
    toolCursor.style.transform = `translate(${x}px, ${y}px) rotate(${tilt.toFixed(1)}deg)`;
  };

  const grabTool = (e) => { lastClient.x = e.clientX; lastClient.y = e.clientY; moveTool(e.clientX, e.clientY); };

  const takeShears = () => {
    if (state.tool === "shears") return;
    if (state.wool < SHEAR_MIN) {
      sfx.whiff();
      setHint("Sa laine est trop courte — elle repousse", "his wool is too short — it is growing back");
      announce("Sa laine est trop courte pour la tonte.");
      return;
    }
    state.tool = "shears";
    shearsNode.classList.add("held");
    document.body.appendChild(toolCursor);
    document.body.classList.add("tooling");
    moveTool(lastClient.x, lastClient.y);
    sfx.snip();
    poke();
    setHint("Passe les ciseaux sur sa laine", "run the shears over his wool");
    announce("Ciseaux en main. Passe-les sur sa laine pour le tondre.");
  };

  const dropShears = () => {
    if (state.tool !== "shears") return;
    saveWool(true);
    state.tool = null;
    state.shearing = false;
    shearPrev = null;
    shearsNode.classList.remove("held");
    toolCursor.remove();
    document.body.classList.remove("tooling");
  };

  const fleeceOff = () => {
    setWool(0);
    state.wool = 0;
    state.shiverUntil = now() + 3.4;
    kick("hop", -250); kick("earL", -240); kick("earR", 240);
    sfx.chime(); sfx.bleat(state.mood > 0.5);
    // the fleece leaves as a dozen tufts and comes back as a cloud
    for (const i of [...Array(12).keys()]) setTimeout(() => tuft(rand(150, 250), rand(205, 265)), i * 45);
    for (const i of [...Array(6).keys()]) setTimeout(() => sparkle(rand(150, 250), rand(190, 250)), 300 + i * 90);
    setTimeout(fleeceToCloud, 900);
    announce("La toison est tombée : Nuage est tout neuf, et un peu frileux.");
    setHint("Nuage est tondu — trois câlins avant la prochaine tonte", "shorn: three cuddles until the next one");
    setTimeout(dropShears, 800);
  };

  // Wool is a body state, mood is a feeling state. Nothing below writes
  // state.happyUntil, state.cuddle, springs.moodS or --m, and nothing below calls
  // goHappy(): shearing reads his mood as a gate, and never the other way round.
  let refusedAt = 0;
  const refuse = (sx) => {
    kick("hop", -120);
    kick("sway", sx < 200 ? 130 : -130);
    if (now() - refusedAt < 2.4) return;
    refusedAt = now();
    sfx.whiff(); sfx.bleat(false);
    setHint("Rassure-le d'abord — un câlin, puis la tonte", "settle him with a cuddle first, then shear");
    announce("Nuage se dérobe : il faut d'abord le rassurer avec un câlin.");
  };

  const shearStroke = (p, d) => {
    const before = state.wool;
    if (before <= 0.02) return;  // already bare — regrowth must show before the blades bite again
    if (state.mood < SHEAR_CALM) { refuse(p.x); return; }
    setWool(before - d / SHEAR_TARGET);
    saveWool(false);
    state.wool = woolNow();
    poke();
    if (Math.random() < d / 24) tuft(p.x + rand(-16, 16), p.y + rand(-14, 14));
    if (Math.random() < d / 80) sfx.snip();
    if (Math.random() < d / 420) kick(Math.random() < 0.5 ? "earL" : "earR", rand(-180, 180));
    if (state.wool <= 0.02) fleeceOff();
  };

  shearsNode.addEventListener("pointerdown", (e) => { e.stopPropagation(); takeShears(); });
  shearsNode.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); takeShears(); hit.focus(); }
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") dropShears();
    if (e.key.toLowerCase() === "t" && !game.on) (state.tool ? dropShears : takeShears)();
  });
  // clicking anywhere else in the world puts the shears back in the grass
  addEventListener("pointerdown", (e) => {
    if (!state.tool) return;
    if (svg.contains(e.target) || shearsNode.contains(e.target)) return;
    dropShears();
  });

  /* ---- sound toggle ---- */
  const soundBtn = $("#sound");
  const paintSound = () => {
    soundBtn.setAttribute("aria-pressed", String(state.sound));
    soundBtn.setAttribute("aria-label", state.sound ? "Couper le son — mute" : "Activer le son — unmute");
  };
  paintSound();   // he may have been muted last visit; the control has to say so
  soundBtn.addEventListener("click", () => {
    state.sound = !state.sound;
    paintSound();
    save.data.prefs.sound = state.sound;
    save.touch();
    if (state.sound) sfx.flutter();
  });

  /* ------------------------------------------------------------------ *
   * La traversée — le loup, le mouton et le chou
   *
   * The crossing borrows the sheep and nothing else. It never calls goHappy()
   * or feed(), never writes state.happyUntil or nuage:happy-until, and never
   * touches state.cuddle: the cuddle rig stays live throughout, so you can
   * stroke him on the bank between moves and the world greys out around the
   * river if his five minutes run out mid-crossing.
   * ------------------------------------------------------------------ */

  const crossBack = $("#crossBack"), crossFront = $("#crossFront"), decor = $("#isoDecor");
  const layers = depthLayers(crossBack, crossFront);
  const crossUI = $("#crossUI"), crossMoves = $("#crossMoves");
  const SLOTS = {
    L: { loup: [2.6, 0.4], mouton: [1.4, 2.2], chou: [0.4, 4.0] },
    R: { loup: [8.6, 0.4], mouton: [7.4, 2.2], chou: [6.4, 4.0] },
  };
  const DOCK = { L: 3.85, R: 5.25 }, BOAT_GY = 2.5, BOAT_GZ = 0.3;
  const NAME = { loup: "le loup", mouton: "Nuage", chou: "le chou" };
  const SIDE_FR = { L: "rive gauche", R: "rive droite" };
  // loup + chou is legal: wolves do not eat cabbage
  const PAIRS = [["loup", "mouton"], ["mouton", "chou"]];

  const game = {
    on: false, built: false, phase: "idle", rowTimer: 0, pose: {},
    boat: "L", where: { loup: "L", mouton: "L", chou: "L" },
    aboard: null, moves: 0, stack: [], rowUntil: 0, rowing: 0,
    solves: save.data.valley.solves.riviere ?? 0,
    unlocked: save.data.valley.unlocked.includes("riviere"),
  };

  S("boatX", DOCK.L, 34, 11);
  S("cargoY", 0, 190, 13);

  /* ---- world building: made things are faceted, living things are rounded ---- */

  const crests = [];
  const buildWorld = () => {
    if (game.built) return;
    game.built = true;

    // river bed and water, the one place a stretched quad is honest
    poly(decor, [pt(3, 0, 0.35), pt(6, 0, 0.35), pt(6, 5, 0.35), pt(3, 5, 0.35)].join(" "), "var(--iso-water)");
    poly(decor, [pt(3, 0, 0.35), pt(3, 5, 0.35), pt(3, 5, 0), pt(3, 0, 0)].join(" "), "var(--iso-water-d)");

    for (const i of [...Array(14).keys()]) {
      const node = poly(decor, "", "var(--iso-crest)", 0.55);
      crests.push({ node, wx: 3.15 + (i % 7) * 0.45, wy: (i * 0.71) % 5, phase: rand(0, 6.28) });
    }

    boxAt(decor, 0, 0, 3, 5, 0, 1, "var(--iso-grass)", "var(--iso-grass-l)", "var(--iso-earth-r)");
    boxAt(decor, 6, 0, 3, 5, 0, 1, "var(--iso-grass)", "var(--iso-grass-l)", "var(--iso-grass-r)");
    // the cliff faces that meet the water
    poly(decor, [pt(3, 0, 1), pt(3, 5, 1), pt(3, 5, 0), pt(3, 0, 0)].join(" "), "var(--iso-earth-r)");
    poly(decor, [pt(6, 0, 1), pt(6, 0, 0), pt(6, 5, 0), pt(6, 5, 1)].join(" "), "var(--iso-earth)", 0);

    // docks
    boxAt(decor, 2.7, 2.1, 0.5, 0.8, 1, 0.06, "var(--iso-wood)", "var(--iso-wood-l)", "var(--iso-wood-r)");
    boxAt(decor, 5.9, 2.1, 0.5, 0.8, 1, 0.06, "var(--iso-wood)", "var(--iso-wood-l)", "var(--iso-wood-r)");

    // scenery: nothing on the right bank nearer than gx+gy = 9, or it would
    // paint over Nuage, who is a single DOM actor sitting above this layer
    for (const [gx, gy, k] of [[0.4, 0.4, 1.15], [2.6, 0.5, 0.9], [0.5, 4.2, 1.05], [1.2, 3.0, 0.8]]) pine(decor, gx, gy, k);
    for (const [gx, gy, k] of [[8.4, 0.5, 1.1], [8.7, 0.2, 0.85], [6.3, 0.2, 0.95]]) pine(decor, gx, gy, k);

    // pennant post on the far bank, unfurled on a win
    const postX = isoX(8.75, 4.8), postY = isoY(8.75, 4.8, 1);
    const post = el("g", { transform: `translate(${postX.toFixed(1)} ${postY.toFixed(1)})` });
    post.appendChild(el("ellipse", { cx: 0, cy: 0, rx: 9, ry: 4, fill: "#2c3a2e", opacity: ".18" }));
    post.appendChild(el("polygon", { points: "-9,0 9,0 6,-7 -6,-7", fill: "var(--iso-earth-l)" }));
    post.appendChild(el("rect", { x: -2, y: -58, width: 4, height: 54, rx: 2, fill: "var(--iso-wood-r)" }));
    const flag = el("polygon", { class: "pennant", points: "2,-57 33,-47 2,-37", fill: "#ff9ec4" });
    flag.setAttribute("id", "pennant");
    post.appendChild(flag);
    decor.appendChild(post);

    /* ---- the boat: faceted hull, and oars that actually pull ---- */
    const boat = el("g", { id: "boat", tabindex: "0", role: "button" });
    boat.setAttribute("aria-label", "Traverser la rivière — row across");
    const hull = el("g", { transform: "scale(1.15)" });
    hull.appendChild(el("ellipse", { cx: 0, cy: 14, rx: 46, ry: 11, fill: "#1d3348", opacity: ".2" }));
    hull.appendChild(el("polygon", { points: "-26.9,-20.7 -11.5,-22.9 10.4,-15.5 28.0,-4.3 26.0,5.8 23.1,9.2 6.9,9.1 -12.4,1.1 -26.2,-8.3 -23.8,-14.3", fill: "var(--iso-wood-r)" }));
    hull.appendChild(el("polygon", { points: "5.8,8.6 -19.0,-1.1 -35.4,-13.3 -29.9,-22.2 -28.1,-15.0 -32.8,-6.9 -17.3,4.5 6.0,13.6", fill: "var(--iso-wood-l)" }));
    hull.appendChild(el("polygon", { points: "31.6,-4.3 28.9,7.3 5.8,8.6 6.0,13.6 27.2,12.6 29.2,2.0", fill: "var(--iso-wood-r)" }));
    hull.appendChild(el("path", {
      d: "M28.9,7.3 5.8,8.6 -19.0,-1.1 -35.4,-13.3 -29.9,-22.2 -12.2,-24.9 12.2,-16.7 31.6,-4.3Z M26.0,5.8 5.7,6.8 -16.5,-2.0 -31.3,-12.9 -26.9,-20.7 -11.5,-22.9 10.4,-15.5 28.0,-4.3Z",
      fill: "var(--iso-wood)", "fill-rule": "evenodd",
    }));
    const oarNear = el("line", { id: "oarNear", x1: 6, y1: 2, x2: 34, y2: 22, stroke: "var(--iso-wood-l)", "stroke-width": 4.5, "stroke-linecap": "round" });
    const oarFar = el("line", { id: "oarFar", x1: -8, y1: -12, x2: -38, y2: -2, stroke: "var(--iso-wood-l)", "stroke-width": 4.5, "stroke-linecap": "round" });
    hull.appendChild(oarNear); hull.appendChild(oarFar);
    boat.appendChild(hull);
    layers.add(boat, () => v("boatX") + BOAT_GY, "boat");
    game.boatNode = boat; game.oarNear = oarNear; game.oarFar = oarFar; game.hull = hull;

    /* ---- the wolf: rounded, like every living thing in this app ---- */
    const wolf = el("g", { id: "tokLoup", class: "tok", tabindex: "0", role: "button" });
    wolf.setAttribute("aria-label", "Le loup — the wolf");
    wolf.innerHTML = `
      <ellipse cx="0" cy="2" rx="46" ry="12" fill="#1d2a22" opacity=".18"/>
      <path d="M40,-34 C62,-40 66,-60 54,-70 C58,-52 46,-46 36,-44 Z" fill="#7d879a"/>
      <rect x="-30" y="-30" width="13" height="32" rx="6.5" fill="#79839a"/>
      <rect x="17" y="-30" width="13" height="32" rx="6.5" fill="#79839a"/>
      <ellipse cx="0" cy="-44" rx="42" ry="32" fill="#8d97a8"/>
      <ellipse cx="0" cy="-36" rx="27" ry="21" fill="#c9d1dc"/>
      <path d="M-34,-96 L-40,-124 L-14,-108 Z" fill="#8d97a8"/>
      <path d="M34,-96 L40,-124 L14,-108 Z" fill="#8d97a8"/>
      <path d="M-31,-99 L-35,-116 L-18,-106 Z" fill="#d3a3a8"/>
      <path d="M31,-99 L35,-116 L18,-106 Z" fill="#d3a3a8"/>
      <ellipse cx="0" cy="-92" rx="36" ry="30" fill="#98a2b3"/>
      <ellipse cx="0" cy="-80" rx="19" ry="15" fill="#e2e7ee"/>
      <path d="M-6,-86 Q0,-90 6,-86 Q6,-80 0,-77 Q-6,-80 -6,-86 Z" fill="#4a4550"/>
      <path d="M-12,-74 Q0,-68 12,-74" stroke="#4a4550" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="-14" cy="-99" rx="7.5" ry="8" fill="#3b2f3f"/>
      <ellipse cx="14" cy="-99" rx="7.5" ry="8" fill="#3b2f3f"/>
      <circle cx="-16.4" cy="-102" r="2.6" fill="#fff"/>
      <circle cx="11.6" cy="-102" r="2.6" fill="#fff"/>
      <path d="M-24,-112 Q-14,-116 -6,-112" stroke="#6d7688" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M24,-112 Q14,-116 6,-112" stroke="#6d7688" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    layers.add(wolf, () => depthOf("loup"), "loup");

    /* ---- the cabbage ---- */
    const chou = el("g", { id: "tokChou", class: "tok", tabindex: "0", role: "button" });
    chou.setAttribute("aria-label", "Le chou — the cabbage");
    chou.innerHTML = `
      <ellipse cx="0" cy="2" rx="44" ry="12" fill="#1d2a22" opacity=".18"/>
      <path d="M-50,-4 C-66,-18 -60,-44 -38,-42 C-46,-30 -46,-16 -40,-4 Z" fill="#4a9942"/>
      <path d="M50,-4 C66,-18 60,-44 38,-42 C46,-30 46,-16 40,-4 Z" fill="#55a54c"/>
      <circle cx="0" cy="-46" r="45" fill="#8ecf6d"/>
      <path d="M-45,-46 A45,45 0 0,1 -6,-91 L0,-46 Z" fill="#a5dd82"/>
      <path d="M6,-91 A45,45 0 0,1 45,-46 L0,-46 Z" fill="#7bc25c"/>
      <path d="M-45,-46 A45,45 0 0,0 0,-1 L0,-46 Z" fill="#77bb5a" opacity=".55"/>
      <path d="M-19,-79 Q0,-68 19,-79" stroke="#5faa46" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <path d="M-33,-60 Q0,-42 33,-60" stroke="#5faa46" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M-38,-34 Q0,-14 38,-34" stroke="#5faa46" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <ellipse cx="-16" cy="-68" rx="10" ry="6.5" fill="#c9 efa0" opacity="0"/>
      <ellipse cx="-16" cy="-68" rx="10" ry="6.5" fill="#c8efa2" opacity=".45"/>`;
    layers.add(chou, () => (game.where.chou === "boat" ? -1000 : 1000), "chou");   // OLD RULE EMULATION
    game.tok = { loup: wolf, chou };
    bindTok("loup"); bindTok("chou"); bindBoat();
  };

  /* ---- placement: one rail for all three actors, so they never drift apart ---- */
  const VB_X = 196, VB_Y = 44, VB_W = 728, VB_H = 452;   // must match the two .cross viewBoxes
  const MOUTON_W = 186;   // Nuage's worn width in board units; wolf and cabbage hang off this
  const isoRect = () => {
    const r = crossBack.getBoundingClientRect();
    const sc = Math.min(r.width / VB_W, r.height / VB_H);
    return { sc, ox: r.left + (r.width - VB_W * sc) / 2 - VB_X * sc, oy: r.top + (r.height - VB_H * sc) / 2 - VB_Y * sc };
  };
  const placeSheepAt = (ux, uy) => {
    const { sc, ox, oy } = isoRect();
    const w = stage.offsetWidth || 1, h = w * 372 / 400;
    stage.style.setProperty("--k", (MOUTON_W * sc / w).toFixed(4));
    stage.style.setProperty("--x", `${(ox + ux * sc - w / 2).toFixed(1)}px`);
    stage.style.setProperty("--y", `${(oy + uy * sc - h * 0.9435).toFixed(1)}px`);
  };
  const placeTok = (id, ux, uy, scale) => {
    game.tok[id].setAttribute("transform", `translate(${ux.toFixed(1)} ${uy.toFixed(1)}) scale(${scale})`);
  };
  const TOK_SCALE = { loup: 0.58, chou: 0.52 };
  const boatSpot = (gx) => [isoX(gx, BOAT_GY), isoY(gx, BOAT_GY, BOAT_GZ)];
  const depthOf = (id) => {
    if (game.where[id] === "boat") return v("boatX") + BOAT_GY;
    const [gx, gy] = SLOTS[game.where[id]][id];
    return gx + gy;
  };
  const spot = (id) => {
    if (game.where[id] === "boat") {
      const [x, y] = boatSpot(v("boatX"));
      return [x, y - 6 + v("cargoY")];
    }
    const [gx, gy] = SLOTS[game.where[id]][id];
    return [isoX(gx, gy), isoY(gx, gy, 1)];
  };

  const drawActors = () => {
    // a choreography may pin a piece somewhere the board model does not know about
    for (const id of ["loup", "chou"]) placeTok(id, ...(game.pose[id] ?? spot(id)), TOK_SCALE[id]);
    const [mx, my] = game.pose.mouton ?? spot("mouton");
    placeSheepAt(mx, my);
    layers.sort(depthOf("mouton"));
  };

  /* ---- the rules, one predicate, one call site ---- */
  const unsafe = (bank) => PAIRS.find(([a, b]) => game.where[a] === bank && game.where[b] === bank) || null;

  const readout = () => {
    const list = (bank) => ["loup", "mouton", "chou"].filter((id) => game.where[id] === bank).map((id) => NAME[id]).join(", ") || "personne";
    const cargo = game.aboard ? ` ${NAME[game.aboard]} est dans la barque.` : "";
    announce(`Rive gauche : ${list("L")}. Rive droite : ${list("R")}. La barque est à ${SIDE_FR[game.boat]}.${cargo}`);
  };
  const setMoves = () => {
    crossMoves.textContent = `${game.moves} passage${game.moves > 1 ? "s" : ""}`;
    $("#crossUndo").disabled = game.stack.length === 0;
    $("#crossRow").disabled = game.phase !== "idle";
  };
  const syncTokens = () => {
    $("#crossRow").disabled = game.phase !== "idle";
    for (const id of ["loup", "chou"]) {
      const node = game.tok[id];
      const reachable = game.where[id] === game.boat || game.where[id] === "boat";
      node.toggleAttribute("disabled", !reachable || game.phase !== "idle");
      node.setAttribute("tabindex", reachable && game.phase === "idle" ? "0" : "-1");
    }
  };

  /* ---- entering and leaving ---- */
  const enterCross = () => {
    if (game.on || !game.unlocked) return;
    buildWorld();
    game.on = true;
    game.phase = "idle";
    poke();
    document.documentElement.dataset.mode = "cross";
    state.petting = false; petPrev = null; keyPetting = false;
    stage.classList.remove("cuddling");
    dropShears();
    if (dragging) { dragging.classList.remove("picked"); dragging = null; dragNode.remove(); }
    resetBoard(false);
    stage.classList.add("gliding");
    setTimeout(() => stage.classList.remove("gliding"), 1000);
    setHint("Le loup mange le mouton, le mouton mange le chou — une seule place dans la barque",
      "wolf eats sheep, sheep eats cabbage — one seat in the boat");
    setTimeout(() => { refreshCTM(); drawActors(); measureUI(); }, 20);
    setTimeout(refreshCTM, 1000);
    readout();
  };

  const exitCross = () => {
    if (!game.on) return;
    clearTimeout(game.rowTimer);
    game.on = false;
    game.phase = "idle";
    delete document.documentElement.dataset.mode;
    stage.style.removeProperty("--x");
    stage.style.removeProperty("--y");
    stage.style.removeProperty("--k");
    stage.classList.remove("riding", "gliding");
    setTimeout(refreshCTM, 60);
    setTimeout(refreshCTM, 700);
    announce("Retour au pré.");
  };

  const resetBoard = (animate = true) => {
    clearTimeout(game.rowTimer);   // a crossing in flight must not land on a fresh board
    game.pose = {};
    game.boat = "L";
    game.where = { loup: "L", mouton: "L", chou: "L" };
    game.aboard = null;
    game.moves = 0;
    game.stack = [];
    game.phase = "idle";
    springs.boatX.target = springs.boatX.v = DOCK.L;
    springs.cargoY.target = springs.cargoY.v = 0;
    for (const id of ["loup", "chou"]) game.tok[id].classList.remove("gone");
    game.tok.chou.style.transform = "";
    layers.reset();
    $("#pennant").classList.remove("up");
    setMoves(); syncTokens(); drawActors(); measureUI();
    if (animate) { readout(); }
  };

  /* ---- moves ---- */
  const embark = (id) => {
    if (!game.on || game.phase !== "idle") return;
    if (game.where[id] === "boat") {           // stepping back ashore
      game.where[id] = game.boat;
      game.aboard = null;
    } else if (game.where[id] === game.boat) { // boarding, one seat, a second click swaps
      if (game.aboard) game.where[game.aboard] = game.boat;
      game.where[id] = "boat";
      game.aboard = id;
      kick("cargoY", -260);
    } else return;
    poke();
    sfx.flutter();
    syncTokens(); drawActors(); readout();
  };

  const row = () => {
    if (!game.on || game.phase !== "idle" || now() < game.rowUntil) return;
    game.stack.push({ boat: game.boat, where: { ...game.where }, moves: game.moves });
    const from = game.boat;
    game.boat = from === "L" ? "R" : "L";
    game.moves += 1;
    game.rowUntil = now() + (REDUCED ? 0.24 : 1.05);
    game.rowing = game.rowUntil;
    game.phase = "rowing";
    state.petting = false;
    if (game.where.mouton === "boat") stage.classList.add("riding");
    set("boatX", DOCK[game.boat]);
    if (REDUCED) springs.boatX.v = DOCK[game.boat];
    sfx.row();
    poke();
    setMoves(); syncTokens();
    clearTimeout(game.rowTimer);
    game.rowTimer = setTimeout(() => arrive(from), (game.rowUntil - now()) * 1000);
  };

  const arrive = (from) => {
    if (!game.on) return;
    if (game.aboard) {                 // auto-disembark: a second click carries no decision
      game.where[game.aboard] = game.boat;
      game.aboard = null;
      springs.cargoY.v = springs.cargoY.target = 0;
    }
    stage.classList.remove("riding");
    game.phase = "idle";
    drawActors(); syncTokens(); setMoves();

    const bad = unsafe(from);          // the one call site
    if (bad) return fail(bad, from);
    if (["loup", "mouton", "chou"].every((id) => game.where[id] === "R")) return win();
    readout();                         // silence is the reward for a correct move
  };

  const fail = (pair, bank) => {
    game.phase = "failed";
    syncTokens();
    const [a, b] = pair;
    if (pair.includes("loup")) {
      // the wolf commits an unauthorised cuddle and carries him off
      const [wx, wy] = spot("mouton");
      game.pose.loup = [wx - 26, wy];
      kick("earL", -320); kick("earR", 320);
      setTimeout(() => {
        if (game.phase !== "failed") return;   // reset or undo already moved on
        game.tok.loup.classList.add("gone");
        game.pose.loup = [wx - 40, wy - 18];
        game.pose.mouton = [wx + 6, wy - 18];
        for (const i of [...Array(3).keys()]) {
          setTimeout(() => {
            const [px, py] = spot("mouton");
            const puff = el("ellipse", { cx: px + rand(-30, 30), cy: py - rand(10, 40), rx: 16, ry: 11, fill: "#8b94a5", opacity: ".7" });
            crossFront.appendChild(puff);
            setTimeout(() => puff.remove(), 900);
          }, i * 120);
        }
      }, 700);
      sfx.bleat(false);
      announce("Le loup a fait un câlin non autorisé au mouton. Annule le dernier passage.");
      setHint("Le loup et le mouton, seuls…", "wolf and sheep, left alone…");
    } else {
      // entirely his own fault, and the funnier of the two
      state.chewUntil = now() + 2.1;   // borrowed ingredients, never feed() itself
      sfx.munch();
      for (const i of [...Array(10).keys()]) setTimeout(() => crumb(200 + rand(-16, 16), 206), i * 60);
      game.tok.chou.classList.add("gone");
      announce("Le mouton a mangé le chou. Annule le dernier passage.");
      setHint("Le mouton et le chou, seuls…", "sheep and cabbage, left alone…");
    }
  };

  const win = () => {
    game.phase = "won";
    syncTokens();
    sfx.chime();
    kick("hop", -300);
    for (const i of [...Array(18).keys()]) setTimeout(() => sparkle(rand(140, 260), rand(170, 250)), 460 + i * 40);
    setTimeout(() => $("#pennant").classList.add("up"), 700);
    // if he is sad, the victory bleat is the sad bleat
    setTimeout(() => sfx.bleat(state.mood > 0.5), 900);
    game.solves += 1;
    save.data.valley.solves.riviere = game.solves;
    save.touch(true);
    growReward();
    const best = game.moves === 7 ? " C'est la solution optimale." : "";
    announce(`Tout le monde est passé en ${game.moves} passages.${best}`);
    setHint(`Tout le monde est passé — ${game.moves} passages${game.moves === 7 ? ", le minimum" : ""}`,
      `everyone crossed in ${game.moves}${game.moves === 7 ? " — the minimum" : ""}`);
  };

  const undo = () => {
    if (!game.on || !game.stack.length || game.phase === "rowing") return;
    clearTimeout(game.rowTimer);
    game.pose = {};
    const prev = game.stack.pop();
    game.boat = prev.boat;
    game.where = { ...prev.where };
    game.moves = prev.moves;
    game.aboard = Object.keys(game.where).find((id) => game.where[id] === "boat") || null;
    game.phase = "idle";
    springs.boatX.target = DOCK[game.boat];
    if (REDUCED) springs.boatX.v = DOCK[game.boat];
    for (const id of ["loup", "chou"]) game.tok[id].classList.remove("gone");
    $("#pennant").classList.remove("up");
    stage.classList.remove("riding");
    setMoves(); syncTokens(); drawActors(); readout();
  };

  /* ---- the door: a four-leaf clover, one member of the family promoted ---- */
  const sprout = el("g", { class: "sprout", role: "button", tabindex: "-1" });
  sprout.setAttribute("aria-label", "Jouer à la traversée — play the crossing");
  sprout.innerHTML = `
    <circle class="sprout__halo" cx="0" cy="-8" r="0" fill="#fff8d8"/>
    <path class="sprout__stem" d="M0,2 L0,36" stroke="#3f8a36" stroke-width="3" stroke-linecap="round"
          fill="none" stroke-dasharray="34" stroke-dashoffset="34"/>
    <rect x="-26" y="-30" width="52" height="72" fill="transparent"/>
    <g class="sprout__leaves">
      <use class="sprout__rim" href="#cloverLeaves" fill="var(--fourleaf-rim)" transform="scale(1.24)"/>
      <use href="#cloverLeaves" fill="#4ea343"/>
      <use href="#cloverLeaves" fill="#69c257" transform="scale(.82)"/>
    </g>`;
  meadow.appendChild(sprout);
  placeProp(sprout, 975, 208, 1.55);
  const sproutStem = sprout.querySelector(".sprout__stem");
  const sproutLeaves = sprout.querySelector(".sprout__leaves");
  const NOTCH_DASH = [34, 25, 16, 8, 0], NOTCH_SCALE = [0, 0, 0.45, 0.72, 1];

  const updateSprout = () => {
    const notch = game.unlocked ? 4 : clamp(state.fed - 1, 0, 4);
    sprout.style.display = notch === 0 ? "none" : "";
    sproutStem.style.strokeDashoffset = NOTCH_DASH[notch];
    sproutLeaves.style.transform = `scale(${NOTCH_SCALE[notch]})`;
    sprout.classList.toggle("open", notch === 4);
    sprout.setAttribute("tabindex", notch === 4 ? "0" : "-1");
    sprout.style.pointerEvents = notch === 4 ? "auto" : "none";
  };

  const unlockRiver = () => {
    if (game.unlocked) return;
    game.unlocked = true;
    if (!save.data.valley.unlocked.includes("riviere")) save.data.valley.unlocked.push("riviere");
    save.touch(true);
    updateSprout();
    sprout.classList.add("reveal");
    setTimeout(() => sfx.chime(), 350);
    // he notices it before you do
    setTimeout(() => { state.lookAt = now() + 1.4; kick("earL", -220); kick("earR", 220); }, 500);
    setTimeout(() => setHint("Un trèfle à quatre feuilles — touche-le", "a four-leaf clover — tap it"), 900);
    announce("Un trèfle à quatre feuilles a poussé dans le pré : touche-le pour la traversée.");
  };

  // the reward is a clover in the meadow, never a number on a screen
  const growReward = () => {
    const want = Math.min(3 + Math.min(game.solves, 3), CLOVER_X.length);
    while (clovers.length < want) addClover(CLOVER_X[clovers.length]);
    layoutProps();
  };

  /* ---- controls ---- */
  sprout.addEventListener("pointerdown", (e) => { e.stopPropagation(); enterCross(); });
  sprout.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); enterCross(); }
  });
  $("#crossRow").addEventListener("click", row);
  $("#crossUndo").addEventListener("click", undo);
  $("#crossReset").addEventListener("click", () => { resetBoard(); sfx.flutter(); });
  $("#crossExit").addEventListener("click", exitCross);

  const bindTok = (id) => {
    const node = game.tok?.[id];
    if (!node) return;
    node.addEventListener("pointerdown", (e) => { e.stopPropagation(); embark(id); });
    node.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); embark(id); }
    });
  };
  const bindBoat = () => {
    game.boatNode.addEventListener("pointerdown", (e) => { e.stopPropagation(); row(); });
    game.boatNode.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); row(); }
    });
  };
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "j") { game.on ? exitCross() : enterCross(); return; }
    if (!game.on) return;
    if (e.key === "Escape") { exitCross(); return; }
    if (k === "r") { resetBoard(); return; }
    if ((e.key === "z" && (e.ctrlKey || e.metaKey)) || e.key === "Backspace") { e.preventDefault(); undo(); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const wants = e.key === "ArrowRight" ? "L" : "R";
      if (game.boat === wants) row();
      else { game.shake = now() + 0.16; }     // wrong way: the hull just shrugs
    }
  });

  updateSprout();
  growReward();
  measureUI();
  addEventListener("resize", measureUI);

  /* ---- per-frame: crests, hull, oars, actors ---- */
  const gameFrame = (dt, t) => {
    if (!game.on) return;
    const rowing = now() < game.rowing;

    for (const c of crests) {
      c.wy = (c.wy + 0.42 * dt) % 5;
      const z = 0.35 + Math.sin(t * 2.1 + c.phase) * 0.02;
      c.node.setAttribute("points", [
        pt(c.wx - 0.6, c.wy - 0.07, z), pt(c.wx + 0.6, c.wy - 0.07, z),
        pt(c.wx + 0.6, c.wy + 0.07, z), pt(c.wx - 0.6, c.wy + 0.07, z),
      ].join(" "));
    }

    const bob = Math.sin(t * (rowing ? 5.7 : 1.96)) * (rowing ? 4 : 2) - (rowing ? 4 : 0);
    const shake = now() < (game.shake || 0) ? Math.sin(t * 90) * 4 : 0;
    const [bx, by2] = boatSpot(v("boatX"));
    game.boatNode.setAttribute("transform", `translate(${(bx + shake).toFixed(1)} ${(by2 + bob).toFixed(1)})`);
    const stroke = rowing && !REDUCED ? Math.sin(t * 12) * 16 : 0;
    game.oarNear.setAttribute("transform", `rotate(${stroke.toFixed(1)} 6 2)`);
    game.oarFar.setAttribute("transform", `rotate(${stroke.toFixed(1)} -8 -12)`);

    drawActors();
  };

  /* ------------------------------------------------------------------ *
   * The rig loop
   * ------------------------------------------------------------------ */
  const head = $("#head"), bodyG = $("#body"), shadow = $("#shadow");
  const earL = $("#earL"), earR = $("#earR"), tail = $("#tail");
  const eyeL = $("#eyeL"), eyeR = $("#eyeR");
  const lidL = eyeL.querySelector(".lid"), lidR = eyeR.querySelector(".lid");
  const arcL = eyeL.querySelector(".eye-arc"), arcR = eyeR.querySelector(".eye-arc");
  const browL = $("#browL"), browR = $("#browR");
  const mouth = $("#mouth"), blushL = $("#blushL"), blushR = $("#blushR");
  const petGlowEl = $("#petGlow"), rcBody = $("#rcBody");
  const bodyCore = $("#bodyCore"), bodySheen = $("#bodySheen");
  const ring = $("#ring"), chipState = $("#chipState"), chipTime = $("#chipTime");
  const woolChip = $("#woolChip"), woolRing = $("#woolRing"), woolState = $("#woolState"), woolPct = $("#woolPct");

  const RING_LEN = 2 * Math.PI * 13.6;
  for (const r of [ring, woolRing]) {
    r.setAttribute("stroke-dasharray", RING_LEN.toFixed(2));
    r.setAttribute("stroke-dashoffset", RING_LEN.toFixed(2));
  }

  const rainDrops = [];
  for (const i of [...Array(9).keys()]) {
    const node = el("line", { class: "drop" });
    $("#rain").appendChild(node);
    rainDrops.push({ node, x: rand(-42, 42), y: rand(0, 70), sp: rand(90, 150), len: rand(7, 14) });
  }

  let t = 0, last = performance.now(), lastMoodWrite = -1;
  let nextBlink = 2, blinkT = -1;
  let nextTwitch = 4, nextIdleHop = 4, nextTear = 22, nextBaa = 12, nextZ = 0, nextShake = 8;
  let bloomed = false;

  const writeMood = (m) => {
    if (Math.abs(m - lastMoodWrite) < 0.004) return;
    lastMoodWrite = m;
    document.documentElement.style.setProperty("--m", m.toFixed(3));
  };

  const frame = (ms) => {
    if (game.on) refreshCTM();
    const dt = Math.min(0.034, (ms - last) / 1000);
    last = ms; t += dt;

    /* ---- mood: the five-minute window, plus the live cuddle underneath ---- */
    const remaining = state.happyUntil - Date.now();
    const timerMood = remaining <= 0 ? 0 : clamp(remaining / FADE_MS, 0, 1);
    if (keyPetting) {
      state.cuddle = clamp(state.cuddle + dt * 0.62, 0, 1);
      if (state.cuddle >= 1) goHappy(remaining > 0);
    } else if (!state.petting) {
      state.cuddle = Math.max(0, state.cuddle - dt * (timerMood > 0 ? 0.25 : 0.5));
    }

    set("moodS", clamp(Math.max(state.cuddle * 0.96, timerMood), 0, 1));
    stepSpring(springs.moodS, dt);
    const m = state.mood = clamp(springs.moodS.v, 0, 1);
    writeMood(m);
    // holding Space with the shears in hand shears at a steady rate
    if (keyShearing && state.wool > 0.02 && state.mood >= SHEAR_CALM) {
      setWool(state.wool - dt * 0.42);
      saveWool(false);
      state.wool = woolNow();
      if (Math.random() < dt * 9) tuft(rand(150, 250), rand(205, 262));
      if (Math.random() < dt * 3.4) sfx.snip();
      if (state.wool <= 0.02) fleeceOff();
    }
    const w = state.wool = woolNow();

    if (now() - state.lastPoke > DOZE_AFTER && m < 0.2 && !game.on) state.dozing = true;
    const dozing = state.dozing;
    const chewing = now() < state.chewUntil;
    const bleating = now() < state.bleatUntil;
    const petting = state.petting;
    const shearing = state.shearing;
    const shivering = now() < state.shiverUntil;

    /* ---- what he looks at: your hand, else a butterfly, else a slow drift ---- */
    let gx, gy;
    const bfly = butterflies.find((b) => b.alive);
    if (dragging) {
      gx = 0; gy = 0.7;
    } else if (ptr.inside && now() - state.lastPointer < 2.2) {
      gx = clamp((ptr.x - 200) / 190, -1, 1);
      gy = clamp((ptr.y - 190) / 170, -1, 1);
    } else if (bfly && !dozing) {
      gx = clamp((bfly.x - 200) / 200, -1, 1);
      gy = clamp((bfly.y - 190) / 180, -1, 1);
    } else {
      gx = Math.sin(t * 0.31) * 0.35;
      gy = Math.sin(t * 0.23 + 1.4) * 0.2;
    }
    if (now() < state.lookAt) { gx = 0.92; gy = 0.35; }
    if (dozing) { gx *= 0.1; gy = 0.6; }
    set("gazeX", gx); set("gazeY", gy);

    /* ---- posture ---- */
    if (now() - ptr.at > 0.12) ptr.speed *= Math.max(0, 1 - dt * 6);
    if (state.tool === "shears") {
      const near = clamp(1 - Math.hypot(ptr.x - 200, (ptr.y - 240) * 1.5) / 150, 0, 1);
      set("nerve", m >= SHEAR_CALM ? near * (1 - clamp(ptr.speed / 300, 0, 1)) : -near);
    } else set("nerve", 0);
    const nerve = v("nerve");
    const toward = ptr.x < 200 ? -1 : 1;
    set("lean", dozing ? 7 : lerp(-2, 0, m) + gx * lerp(5, 9, m) + (petting ? gx * 5 : 0) + nerve * 4 * toward);
    set("mouth", lerp(-1, 1, m) + (petting ? 0.3 : 0));
    set("brow", clamp(1 - m + Math.max(0, -nerve) * 0.5, 0, 1));
    set("earL", dozing ? 14 : lerp(26, -12, m) + (petting ? -8 : 0) + (nerve < 0 ? -nerve * 22 : -nerve * 9));
    set("earR", dozing ? -14 : lerp(-26, 12, m) + (petting ? 8 : 0) - (nerve < 0 ? -nerve * 22 : -nerve * 9));
    set("tail", Math.sin(t * (2 + m * 7)) * lerp(4, 22, m));
    // he holds still while the blades are on him
    set("sway", Math.sin(t * (0.6 + m * 0.9)) * lerp(2, 7, m) * (shearing ? 0.25 : 1) + nerve * 3.5 * toward);
    set("open", bleating ? 1 : chewing ? 0.44 + Math.sin(t * 17) * 0.34 : 0);

    /* ---- scheduled life: blinks, twitches, hops, bleats, tears ---- */
    nextBlink -= dt;
    if (nextBlink <= 0 && !dozing) { blinkT = 0.16; nextBlink = rand(2.4, 6.5); }
    if (blinkT >= 0) blinkT -= dt;

    nextTwitch -= dt;
    if (nextTwitch <= 0) {
      nextTwitch = rand(3.5, 9);
      if (!dozing) kick(Math.random() < 0.5 ? "earL" : "earR", rand(-260, 260));
    }

    if (m > 0.55 && !REDUCED) {
      nextIdleHop -= dt;
      if (nextIdleHop <= 0) {
        nextIdleHop = rand(2.6, 5.4);
        kick("hop", -190);
        if (Math.random() < 0.5) sparkle(rand(140, 260), rand(190, 250));
      }
      nextBaa -= dt;
      if (nextBaa <= 0) { nextBaa = rand(12, 28); bleat(); }
    } else {
      nextTear -= dt;
      if (nextTear <= 0 && m < 0.25 && !dozing) {
        nextTear = rand(18, 34);
        tear(200 + (Math.random() < 0.5 ? -22 : 22), 188);
      }
    }
    if (dozing) {
      nextZ -= dt;
      if (nextZ <= 0) { nextZ = 2.3; zzz(234, 152); }
    }

    // an overgrown fleece itches: he shakes it out and loses a tuft or two
    if (w > 0.8 && !dozing && !REDUCED) {
      nextShake -= dt;
      if (nextShake <= 0) {
        nextShake = rand(9, 17);
        kick("sway", rand(-95, 95));
        kick("earL", -320); kick("earR", 320);
        for (const i of [...Array(3).keys()]) setTimeout(() => tuft(rand(160, 240), rand(200, 250)), i * 90);
      }
    }

    stepSprings(dt);

    /* ---- body: breathe, hop, squash ---- */
    const breathe = Math.sin(t * 1.35) * (1.6 + m * 0.8) * lerp(1, 0.45, Math.max(0, nerve));
    const hopY = v("hop");
    const squash = clamp(1 - springs.hop.vel / 2600, 0.9, 1.1);
    const by = hopY + breathe;
    const shiver = shivering ? Math.sin(t * 42) * 1.7 : 0;
    bodyG.setAttribute("transform",
      `translate(${(v("sway") + shiver).toFixed(2)} ${by.toFixed(2)}) translate(200 344) scale(${(2 - squash).toFixed(4)} ${squash.toFixed(4)}) translate(-200 -344)`);
    shadow.setAttribute("transform", `translate(200 352) scale(${(1 + hopY / 300).toFixed(3)} 1) translate(-200 -352)`);
    shadow.setAttribute("opacity", clamp(0.16 - hopY / 900, 0.05, 0.2).toFixed(3));

    /* ---- wool: the fleece length rescales the ring, the curls and the core ---- *
     * Every factor is written so that w = FIRST_FLEECE (0.45) reproduces exactly
     * the silhouette he shipped with: shorn is slimmer, full is comically fluffy. */
    const kRing = 0.865 + 0.30 * w, kRingY = 0.91 + 0.20 * w;
    const kCurl = 0.66 + 0.755 * w, kCore = 0.883 + 0.26 * w;
    const fringe = Math.max(0, w - 0.6) * 22;   // an overgrown forelock creeps down over his brows
    bodyCore.setAttribute("rx", (86 * kCore).toFixed(1));
    bodyCore.setAttribute("ry", (50 * kCore).toFixed(1));
    bodySheen.setAttribute("rx", (102 * kCore).toFixed(1));
    bodySheen.setAttribute("ry", (70 * kCore).toFixed(1));

    const hand = (petting || shearing) && !keyPetting;
    for (const b of blobs) {
      const isHead = b.part === "head";
      let x = b.cx + b.ca * b.rx * (isHead ? 1 : kRing);
      let y = b.cy + b.sa * b.ry * (isHead ? 1 : kRingY) + (isHead ? fringe : 0);
      const wob = Math.sin(t * b.speed + b.phase) * (1.6 + m * 1.4);
      if (hand) {
        const dx = x - ptr.x + v("sway"), dy = y - ptr.y + by;
        const d = Math.hypot(dx, dy) || 1;
        const reach = shearing ? 54 : 76;
        if (d < reach) { const f = (1 - d / reach) * (shearing ? 5 : 9); x += (dx / d) * f; y += (dy / d) * f; }
      }
      b.node.setAttribute("cx", (x + wob * 0.4).toFixed(2));
      b.node.setAttribute("cy", (y + wob).toFixed(2));
      b.node.setAttribute("r", (b.r * (isHead ? 0.62 + 0.62 * w : kCurl) + wob * 0.5).toFixed(2));
    }

    /* ---- head, ears, tail ---- */
    head.setAttribute("transform",
      `rotate(${v("lean").toFixed(2)} 200 216) translate(${(v("gazeX") * 4).toFixed(2)} ${(Math.sin(t * 1.35 + 0.6) * 1.2 + v("gazeY") * 2 + (1 - m) * 5).toFixed(2)})`);
    earL.setAttribute("transform", `translate(160 178) rotate(${(-16 + v("earL")).toFixed(2)})`);
    earR.setAttribute("transform", `translate(240 178) rotate(${(16 + v("earR")).toFixed(2)})`);
    tail.setAttribute("transform", `translate(${(300 + 26 * w).toFixed(1)} ${(248 - 4 * w).toFixed(1)}) rotate(${v("tail").toFixed(2)} -16 -4) scale(${(0.72 + 0.62 * w).toFixed(3)})`);

    /* ---- eyes ---- */
    const gxp = v("gazeX") * 3.2, gyp = v("gazeY") * 2.6;
    const blink = blinkT > 0 ? clamp(Math.abs(blinkT - 0.08) / 0.08, 0.05, 1) : 1;
    const lidOpen = dozing ? 0.06 : blink * lerp(0.84, 1, m);
    const beaming = m > 0.86 && (petting || bleating || springs.hop.vel < -60);
    const trusting = state.tool === "shears" && nerve > 0.45 && m >= SHEAR_CALM; // the consent beat
    const arcAmt = beaming || dozing || trusting ? 1 : 0;

    for (const [g, lid, arc, sx] of [[eyeL, lidL, arcL, -1], [eyeR, lidR, arcR, 1]]) {
      g.setAttribute("transform", `translate(${(200 + sx * 22 + gxp).toFixed(2)} ${(181 + gyp).toFixed(2)})`);
      lid.setAttribute("transform", `scale(${(1 + (1 - m) * 0.06).toFixed(3)} ${lidOpen.toFixed(3)})`);
      lid.setAttribute("opacity", (1 - arcAmt).toFixed(2));
      arc.setAttribute("opacity", arcAmt.toFixed(2));
      arc.setAttribute("transform", dozing || (trusting && m < 0.5) ? "scale(1 -0.8) translate(0 -3)" : "scale(1 1)");
    }

    const bt = v("brow");
    for (const [b, sx] of [[browL, -1], [browR, 1]]) {
      b.setAttribute("transform",
        `translate(${(200 + sx * 22 + gxp * 0.7).toFixed(2)} ${(160 + gyp * 0.6 - (1 - bt) * 3).toFixed(2)}) rotate(${(sx * -bt * 22).toFixed(2)})`);
      b.setAttribute("opacity", (0.25 + bt * 0.75).toFixed(2));
    }

    /* ---- mouth: one quadratic whose control point carries the whole mood ---- */
    const mc = v("mouth"), open = v("open");
    const my = 207 + gyp * 0.4 + open * 2;
    const halfW = 14 + open * 2;
    if (open > 0.06) {
      const oh = 4 + open * 9;
      mouth.setAttribute("fill", "#8c4b58");
      mouth.setAttribute("d", `M${200 - halfW},${my} Q200,${my + oh * 1.8} ${200 + halfW},${my} Q200,${my - oh * 0.3} ${200 - halfW},${my} Z`);
    } else {
      mouth.setAttribute("fill", "none");
      mouth.setAttribute("d", `M${200 - halfW},${my.toFixed(2)} Q200,${(my + mc * 7).toFixed(2)} ${200 + halfW},${my.toFixed(2)}`);
    }

    const blushA = clamp(m * 0.55 + (petting ? 0.35 : 0), 0, 0.85);
    blushL.setAttribute("opacity", blushA.toFixed(2));
    blushR.setAttribute("opacity", blushA.toFixed(2));

    petGlowEl.setAttribute("opacity", hand && !shearing ? "1" : "0");
    if (hand) { petGlowEl.setAttribute("cx", ptr.x.toFixed(1)); petGlowEl.setAttribute("cy", ptr.y.toFixed(1)); }

    /* ---- his weather: the cloud floats up and away as he cheers up ---- */
    rcBody.setAttribute("transform",
      `translate(${(Math.sin(t * 0.5) * 6).toFixed(2)} ${(Math.sin(t * 0.8) * 3 - m * 80).toFixed(2)}) scale(${(1 - m * 0.35).toFixed(3)})`);
    for (const d of rainDrops) {
      d.y += d.sp * dt * (1 - m);
      if (d.y > 64) { d.y = rand(-12, 8); d.x = rand(-44, 44); }
      const x = 200 + d.x, y = 64 + d.y - m * 80;
      d.node.setAttribute("x1", x.toFixed(1)); d.node.setAttribute("y1", y.toFixed(1));
      d.node.setAttribute("x2", (x - 1.5).toFixed(1)); d.node.setAttribute("y2", (y + d.len).toFixed(1));
      d.node.setAttribute("opacity", (0.75 * (1 - m)).toFixed(2));
    }

    /* ---- butterflies: one always, the others only when the sun is out ---- */
    butterflies.forEach((b, i) => {
      b.alive = i === 0 || m > 0.35;
      b.node.setAttribute("opacity", b.alive ? "1" : "0");
      if (!b.alive) return;
      if (b.flee > 0) {
        b.flee -= dt;
        b.y -= 130 * dt;
        b.x += Math.sin(t * 6 + i) * 70 * dt;
        if (b.y < -70) { b.y = 320; b.flee = 0; }
      } else {
        b.x = 200 + Math.sin(t * b.speed + b.seed) * 215 + Math.sin(t * b.speed * 2.3 + b.seed) * 45;
        b.y = 118 + Math.cos(t * b.speed * 1.4 + b.seed) * 62 + Math.sin(t * b.speed * 3.1) * 14;
      }
      const flap = Math.abs(Math.sin(t * 11 + i));
      b.node.setAttribute("transform",
        `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${(Math.sin(t * b.speed + b.seed) * 12).toFixed(1)}) scale(${(0.72 + i * 0.08).toFixed(2)})`);
      b.wingL.setAttribute("transform", `scale(${(0.4 + flap * 0.6).toFixed(2)} 1)`);
      b.wingR.setAttribute("transform", `scale(${(0.4 + flap * 0.6).toFixed(2)} 1)`);
    });

    gameFrame(dt, t);

    stepParticles(dt);

    /* ---- the meadow blooms when he does ---- */
    if (m > 0.5 !== bloomed) {
      bloomed = m > 0.5;
      for (const f of flowers) f.classList.toggle("bloom", bloomed);
    }

    /* ---- HUD: the fleece clock on the left, the happiness clock on the right ---- */
    woolRing.setAttribute("stroke-dashoffset", (RING_LEN * (1 - w)).toFixed(2));
    const ready = w >= WOOL_READY;
    const woolLabel = state.shearing ? "Tonte…" : ready ? "À tondre" : "Laine";
    if (woolState.textContent !== woolLabel) woolState.textContent = woolLabel;
    const pct = `${Math.round(w * 100)} %`;
    if (woolPct.textContent !== pct) woolPct.textContent = pct;
    woolChip.classList.toggle("ready", ready && !state.shearing);
    shearsNode.classList.toggle("ready", ready && state.tool !== "shears");
    hit.setAttribute("rx", sheepRX().toFixed(1));
    hit.setAttribute("ry", sheepRY().toFixed(1));

    const ratio = remaining > 0 ? clamp(remaining / HAPPY_MS, 0, 1) : state.cuddle;
    ring.setAttribute("stroke-dashoffset", (RING_LEN * (1 - ratio)).toFixed(2));
    if (remaining > 0) {
      const s = Math.ceil(remaining / 1000);
      chipState.textContent = "Heureux";
      chipTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} restantes`;
    } else if (state.cuddle > 0.02) {
      chipState.textContent = "Câlin…";
      chipTime.textContent = `${Math.round(state.cuddle * 100)} %`;
    } else if (dozing) {
      chipState.textContent = "Il somnole";
      chipTime.textContent = "réveille-le";
    } else {
      chipState.textContent = "Il boude";
      chipTime.textContent = "—:—";
    }

    requestAnimationFrame(frame);
  };

  /* when the five minutes run out, he says so */
  let wasHappy = state.happyUntil > Date.now();
  setInterval(() => {
    const isHappy = state.happyUntil > Date.now();
    if (wasHappy && !isHappy) {
      sfx.bleat(false);
      announce("Les cinq minutes sont passées : Nuage boude de nouveau.");
      if (!game.on) {
        hintText.innerHTML = "Encore un câlin ? <span class=\"en\">· one more cuddle?</span>";
        hintEl.classList.remove("gone");
      }
      save.data.sheep.happyUntil = 0;
      save.touch(true);
    }
    wasHappy = isHappy;
  }, 1000);

  requestAnimationFrame(frame);
})();
