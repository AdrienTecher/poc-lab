// A tiny synth: no samples, no files, and nothing ever plays without a
// gesture behind it — the AudioContext is only built on the first sound a
// player asks for, and the mute preference gates every voice.
import { state } from "../state.js";

export const sfx = (() => {
  let ctx = null;
  const AC = () => {
    if (!state.sound) return null;
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const env = (c, node, t, attack, decay, peak) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g); g.connect(c.destination);
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
      env(c, filt, t, 0.03, happy ? 0.5 : 0.8, 0.11);
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
        env(c, o, t + i * 0.075, 0.01, 0.5, 0.06);
        o.start(t + i * 0.075); o.stop(t + i * 0.075 + 0.62);
      });
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
        env(c, bp, t, 0.005, 0.09, 0.15);
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
        env(c, bp, t, 0.003, 0.05, 0.09);
        src.start(t);
      }
      const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = 3140;
      env(c, o, c.currentTime + 0.05, 0.004, 0.09, 0.022);
      o.start(c.currentTime + 0.05); o.stop(c.currentTime + 0.2);
    },
    /* the breathy dodge when he will not hold still */
    row() {
      const c = AC(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator(); o.type = "triangle";
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.24);
      env(c, o, t, 0.02, 0.22, 0.05);
      o.start(t); o.stop(t + 0.3);
      const buf = c.createBuffer(1, 8000, c.sampleRate);
      const d = buf.getChannelData(0);
      for (const k of [...Array(d.length).keys()]) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length);
      const src = c.createBufferSource(); src.buffer = buf;
      const lp = c.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.exponentialRampToValueAtTime(300, t + 0.3);
      src.connect(lp);
      env(c, lp, t, 0.03, 0.26, 0.045);
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
      env(c, lp, t, 0.02, 0.2, 0.05);
      src.start(t);
    },
    purr() {
      const c = AC(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = 138;
      env(c, o, t, 0.05, 0.3, 0.045);
      o.start(t); o.stop(t + 0.42);
    },
    flutter() {
      const c = AC(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(1720, t + 0.18);
      env(c, o, t, 0.01, 0.18, 0.03);
      o.start(t); o.stop(t + 0.26);
    },
  };
})();
