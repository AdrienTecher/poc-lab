// A tiny synth: no samples, no files, and nothing ever plays without a
// gesture behind it — the AudioContext is only built on the first sound a
// player asks for, and the mute preference gates every voice.
import { state } from "../state.js";

/**
 * The mix, in one place.
 *
 * These were nine magic numbers scattered through the voices, spread 0.022 to 0.15
 * and each chosen while writing the sound it belonged to — so they were relative to
 * nothing. Amplitude is not loudness: the ear is far less sensitive at the bottom of
 * its range than in the 1–4kHz band, and a sawtooth carries harmonics all the way up
 * where a sine carries none. So `purr`, a 138Hz sine at 0.045, was nearly inaudible
 * beside `bleat`, which is TWO sawtooths at 0.11 summing into a band the ear is wide
 * open to.
 *
 * Levelled against a 1kHz reference, correcting for three things: where the voice
 * sits (low needs more, 2–4kHz needs less), how rich it is (noise and saw read louder
 * than sine at equal amplitude), and how many oscillators sum at once.
 */
const LEVEL = {
  bleat: 0.055,   // x2 saws, and their harmonics land mid-band — halved from 0.11
  chime: 0.042,   // four triangles overlap 75ms apart, so they stack
  bell: 0.075,    // three inharmonic partials summing to ~1.6x the fundamental
  strike: 0.038,  // the knock inside a bell
  munch: 0.10,    // broadband noise, three bursts in sequence rather than together
  snip: 0.055,    // 2.6–3.5kHz noise, the most sensitive band there is
  ping: 0.018,    // the little metal ring after the blades
  row: 0.05,
  rowNoise: 0.045,
  whiff: 0.05,
  purr: 0.11,     // 138Hz sine: the ear needs roughly triple down here to match
  flutter: 0.035, // 880–1720Hz, sensitive band, so a small number goes a long way
};

/** Headroom, and a ceiling nothing can shout past. */
const MASTER = 0.85;

export const sfx = (() => {
  let ctx = null, bus = null;
  const AC = () => {
    if (!state.sound) return null;
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Everything goes through one bus, so overlapping voices cannot sum past full
      // scale — which they could before, when each connected straight to the
      // destination: a bleat under a chime under three sparkle-driven bells was
      // simply added together and clipped. The compressor is a safety net rather
      // than an effect; at these levels it should almost never engage.
      bus = ctx.createGain();
      bus.gain.value = MASTER;
      const guard = ctx.createDynamicsCompressor();
      guard.threshold.value = -6;
      guard.knee.value = 6;
      guard.ratio.value = 8;
      guard.attack.value = 0.003;
      guard.release.value = 0.12;
      bus.connect(guard);
      guard.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const env = (c, node, t, attack, decay, peak) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g); g.connect(bus);
    return g;
  };
  return {
    /* a bleat is a detuned saw pair under heavy vibrato — the wobble is the sheep */
    bleat(happy = true) {
      const c = AC(); if (!c) return;
      const t = c.currentTime;
      const base = happy ? 430 : 262;
      const filt = c.createBiquadFilter();
      filt.type = "lowpass"; filt.frequency.value = happy ? 2200 : 1150;
      env(c, filt, t, 0.03, happy ? 0.5 : 0.8, LEVEL.bleat);
      const lfo = c.createOscillator(); lfo.frequency.value = happy ? 19 : 12;
      const lfoGain = c.createGain(); lfoGain.gain.value = happy ? 26 : 15;
      lfo.connect(lfoGain);
      for (const detune of [0, 7]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(base + detune, t);
        o.frequency.exponentialRampToValueAtTime(base * (happy ? 1.14 : 0.84) + detune, t + 0.16);
        o.frequency.exponentialRampToValueAtTime(base * (happy ? 0.94 : 0.7) + detune, t + (happy ? 0.5 : 0.8));
        lfoGain.connect(o.frequency);
        o.connect(filt); o.start(t); o.stop(t + (happy ? 0.66 : 0.95));
      }
      lfo.start(t); lfo.stop(t + 1);
    },
    chime() {
      const c = AC(); if (!c) return;
      const t = c.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = f;
        env(c, o, t + i * 0.075, 0.01, 0.5, LEVEL.chime);
        o.start(t + i * 0.075); o.stop(t + i * 0.075 + 0.62);
      });
    },
    /* A struck bell, at whatever pitch is asked for — the one voice here that
     * takes an argument, because le clocher rings phrases and a fixed arpeggio
     * cannot spell one.
     *
     * What makes it a bell rather than a tone is that its partials are NOT
     * harmonic: a cast bell rings at roughly x2.76 and x5.40 above its hum, which
     * is why a bell is recognisable in one strike and why stacking octaves never
     * sounds like one. `when` is an offset in seconds so a phrase is scheduled on
     * the audio clock in one go, rather than walked out with setTimeout and left
     * to drift against it. */
    bell(freq, when = 0) {
      const c = AC(); if (!c) return;
      const t = c.currentTime + when;
      for (const [ratio, share, decay] of [[1, 1, 1.9], [2.76, 0.45, 1.15], [5.4, 0.21, 0.66]]) {
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = freq * ratio;
        env(c, o, t, 0.004, decay, LEVEL.bell * share);
        o.start(t); o.stop(t + decay + 0.12);
      }
      // the strike: a short filtered knock, which is what says struck metal
      const buf = c.createBuffer(1, 900, c.sampleRate);
      const d = buf.getChannelData(0);
      for (const k of [...Array(d.length).keys()]) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length) ** 3;
      const src = c.createBufferSource(); src.buffer = buf;
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq * 3.4; bp.Q.value = 2;
      src.connect(bp);
      env(c, bp, t, 0.002, 0.07, LEVEL.strike);
      src.start(t);
    },
    munch() {
      const c = AC(); if (!c) return;
      for (const i of [...Array(3).keys()]) {
        const t = c.currentTime + i * 0.17;
        const buf = c.createBuffer(1, 2048, c.sampleRate);
        const d = buf.getChannelData(0);
        for (const k of [...Array(d.length).keys()]) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length);
        const src = c.createBufferSource(); src.buffer = buf;
        const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900 + i * 240; bp.Q.value = 3;
        src.connect(bp);
        env(c, bp, t, 0.005, 0.09, LEVEL.munch);
        src.start(t);
      }
    },
    /* two blade chirps and a metal ping: the shears closing */
    snip() {
      const c = AC(); if (!c) return;
      for (const i of [0, 1]) {
        const t = c.currentTime + i * 0.055;
        const buf = c.createBuffer(1, 1024, c.sampleRate);
        const d = buf.getChannelData(0);
        for (const k of [...Array(d.length).keys()]) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length) ** 2;
        const src = c.createBufferSource(); src.buffer = buf;
        const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2600 + i * 900; bp.Q.value = 6;
        src.connect(bp);
        env(c, bp, t, 0.003, 0.05, LEVEL.snip);
        src.start(t);
      }
      const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = 3140;
      env(c, o, c.currentTime + 0.05, 0.004, 0.09, LEVEL.ping);
      o.start(c.currentTime + 0.05); o.stop(c.currentTime + 0.2);
    },
    /* the breathy dodge when he will not hold still */
    row() {
      const c = AC(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator(); o.type = "triangle";
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.24);
      env(c, o, t, 0.02, 0.22, LEVEL.row);
      o.start(t); o.stop(t + 0.3);
      const buf = c.createBuffer(1, 8000, c.sampleRate);
      const d = buf.getChannelData(0);
      for (const k of [...Array(d.length).keys()]) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length);
      const src = c.createBufferSource(); src.buffer = buf;
      const lp = c.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.exponentialRampToValueAtTime(300, t + 0.3);
      src.connect(lp);
      env(c, lp, t, 0.03, 0.26, LEVEL.rowNoise);
      src.start(t);
    },
    whiff() {
      const c = AC(); if (!c) return;
      const t = c.currentTime;
      const buf = c.createBuffer(1, 6000, c.sampleRate);
      const d = buf.getChannelData(0);
      for (const k of [...Array(d.length).keys()]) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length);
      const src = c.createBufferSource(); src.buffer = buf;
      const lp = c.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(1400, t);
      lp.frequency.exponentialRampToValueAtTime(420, t + 0.22);
      src.connect(lp);
      env(c, lp, t, 0.02, 0.2, LEVEL.whiff);
      src.start(t);
    },
    purr() {
      const c = AC(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = 138;
      env(c, o, t, 0.05, 0.3, LEVEL.purr);
      o.start(t); o.stop(t + 0.42);
    },
    flutter() {
      const c = AC(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(1720, t + 0.18);
      env(c, o, t, 0.01, 0.18, LEVEL.flutter);
      o.start(t); o.stop(t + 0.26);
    },
  };
})();
