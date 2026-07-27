// The synth: what it promises, and what actually reaches the audio graph.
//
// This is the part of Phase 4 the handoff called unassertable, on the grounds that
// the suite runs muted and nobody can hear a test. That is true of *timbre* and false
// of everything else. Instrumenting the browser's own Web Audio API — not the app —
// makes three real claims checkable: nothing is built without a gesture, the context
// is built once and reused, and every level that reaches a gain node comes from the
// declared mix rather than from a number somebody typed next to a sound.
//
// What it still cannot judge is whether the mix sounds good. Levels were set against
// a 1kHz reference correcting for band and richness; that reasoning is in audio.js
// and only ears can confirm it.
const SAVE = (sound) => JSON.stringify({
  v: 4, sheep: { happyUntil: 0, woolFrom: Date.now() - 60 * 1000 },
  care: { fed: 5, shorn: 3 },
  valley: { at: "pre", visited: ["pre"], unlocked: ["riviere", "grange"], solves: {}, boards: {} },
  prefs: { sound },
});

/** Count AudioContexts and capture every peak asked of a gain ramp. */
const listen = (page) => page.addInitScript(() => {
  window.__audio = { contexts: 0, peaks: [], destinations: 0 };
  const Real = window.AudioContext || window.webkitAudioContext;
  // Only GAIN ramps. exponentialRampToValueAtTime lives on AudioParam, which every
  // parameter shares — a first pass recorded the bleat's pitch sweep as a level and
  // reported a 4128x mix. So the gain params are tagged where they are created, and
  // nothing else is counted.
  const ramp = AudioParam.prototype.exponentialRampToValueAtTime;
  AudioParam.prototype.exponentialRampToValueAtTime = function (v, t) {
    // 0.0001 is the floor every envelope returns to; the other end is the peak
    if (this.__isLevel && v > 0.001) window.__audio.peaks.push(v);
    return ramp.call(this, v, t);
  };
  window.AudioContext = class extends Real {
    constructor(...a) {
      super(...a);
      window.__audio.contexts += 1;
      // how many nodes reach the speakers directly: the whole point of a bus is
      // that this is exactly one, whatever else is playing
      const madeGain = this.createGain.bind(this);
      this.createGain = () => { const g = madeGain(); g.gain.__isLevel = true; return g; };
      const connect = AudioNode.prototype.connect;
      const dest = this.destination;
      AudioNode.prototype.connect = function (to, ...rest) {
        if (to === dest) window.__audio.destinations += 1;
        return connect.call(this, to, ...rest);
      };
    }
  };
  window.webkitAudioContext = window.AudioContext;
});

const audio = (page) => page.evaluate(() => window.__audio);

export default async ({ newPage, check, APP }) => {
  /* ---- muted: nothing is even built ---- */
  let page = await newPage({ viewport: { width: 1280, height: 800 } });
  await listen(page);
  await page.addInitScript((s) => localStorage.setItem("nuage:save", s), SAVE(false));
  await page.goto(APP);
  await page.waitForTimeout(900);
  const box = await page.locator("#sheep").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.62);
  await page.waitForTimeout(600);
  check("muted, no audio context is ever built", (await audio(page)).contexts === 0,
    JSON.stringify(await audio(page)));
  await page.close();

  /* ---- and with sound on, it is built once, on the first thing you do ---- */
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await listen(page);
  await page.addInitScript((s) => localStorage.setItem("nuage:save", s), SAVE(true));
  await page.goto(APP);
  await page.waitForTimeout(900);
  check("nothing is built before you touch anything", (await audio(page)).contexts === 0,
    "the context is meant to wait for a gesture");

  const at = await page.locator("#sheep").boundingBox();
  for (const i of [...Array(4).keys()]) {
    await page.mouse.click(at.x + at.width / 2, at.y + at.height * 0.62);
    await page.waitForTimeout(280);
  }
  const after = await audio(page);
  check("the first sound builds one context", after.contexts === 1, String(after.contexts));
  check("and it is reused rather than rebuilt per voice", after.contexts === 1);

  /* ---- everything goes through the bus ---- */
  // Before there was one, every voice connected its own envelope straight to the
  // destination, so overlapping sounds were summed with nothing watching the total.
  check("only the bus reaches the speakers", after.destinations === 1,
    `${after.destinations} nodes connected to destination`);

  /* ---- and every level comes from the declared mix ---- */
  check("something actually played", after.peaks.length > 0, String(after.peaks.length));
  const CEILING = 0.12;   // the loudest single entry in LEVEL, which is purr
  const tooLoud = after.peaks.filter((v) => v > CEILING);
  check("no voice asks for more than the mix allows", tooLoud.length === 0,
    `${tooLoud.length} of ${after.peaks.length} over ${CEILING}: ${tooLoud.slice(0, 5).join(", ")}`);
  // and the spread is bounded: the point of levelling is that no voice is an outlier
  const loud = Math.max(...after.peaks), quiet = Math.min(...after.peaks);
  check("and the mix is levelled, not scattered", loud / quiet < 8,
    `${quiet.toFixed(3)}…${loud.toFixed(3)} is a ${(loud / quiet).toFixed(1)}x spread`);
  await page.close();

  /* ---- muting mid-play stops it, and does not tear anything down ---- */
  const quietly = await newPage({ viewport: { width: 1280, height: 800 } });
  await listen(quietly);
  await quietly.addInitScript((s) => localStorage.setItem("nuage:save", s), SAVE(true));
  await quietly.goto(APP);
  await quietly.waitForTimeout(900);
  const b2 = await quietly.locator("#sheep").boundingBox();
  await quietly.mouse.click(b2.x + b2.width / 2, b2.y + b2.height * 0.62);
  await quietly.waitForTimeout(400);
  await quietly.locator("#sound").click();
  await quietly.waitForTimeout(300);
  const before = (await audio(quietly)).peaks.length;
  for (const i of [...Array(3).keys()]) {
    await quietly.mouse.click(b2.x + b2.width / 2, b2.y + b2.height * 0.62);
    await quietly.waitForTimeout(250);
  }
  check("muting stops every voice at once", (await audio(quietly)).peaks.length === before,
    `${(await audio(quietly)).peaks.length - before} sounds played after muting`);
  check("and the preference is written down",
    (await quietly.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).prefs.sound)) === false);
  await quietly.close();
};
