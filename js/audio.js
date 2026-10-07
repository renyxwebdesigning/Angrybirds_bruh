/* Sound effects, all synthesised with WebAudio (no sound files). */
(function () {
  "use strict";
  let ctx = null, master = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem("ff_muted") === "1"; } catch (e) {}
  const last = {};

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function throttle(key, ms) {
    const t = performance.now();
    if (last[key] && t - last[key] < ms) return true;
    last[key] = t;
    return false;
  }

  function tone(freq, dur, opts) {
    if (!ctx || muted) return;
    opts = opts || {};
    const t = ctx.currentTime + (opts.delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const v = opts.vol || 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, opts) {
    if (!ctx || muted) return;
    opts = opts || {};
    const t = ctx.currentTime + (opts.delay || 0);
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.playbackRate.value = opts.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter || "lowpass";
    f.frequency.setValueAtTime(opts.freq || 1000, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    f.Q.value = opts.q || 0.8;
    const g = ctx.createGain();
    const v = opts.vol || 0.4;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const SFX = {
    init,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem("ff_muted", muted ? "1" : "0"); } catch (e) {}
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    click() { tone(660, 0.08, { type: "triangle", vol: 0.2 }); },
    stretch(k) {
      if (throttle("stretch", 90)) return;
      tone(180 + k * 260, 0.12, { type: "sawtooth", vol: 0.05, to: 220 + k * 300 });
    },
    launch(power) {
      noise(0.35, { filter: "bandpass", freq: 600, to: 2400, vol: 0.35 * (0.5 + power), q: 1.5 });
      tone(240, 0.18, { type: "triangle", to: 520, vol: 0.12 });
    },
    birdcall(type) {
      const base = { red: 700, blue: 1100, yellow: 900, black: 420, white: 800, big: 300 }[type] || 700;
      tone(base, 0.12, { type: "square", to: base * 1.5, vol: 0.08 });
      tone(base * 1.4, 0.18, { type: "square", to: base * 0.8, vol: 0.08, delay: 0.1 });
    },
    ability(type) {
      if (type === "yellow") noise(0.4, { filter: "bandpass", freq: 900, to: 4000, vol: 0.4, q: 2 });
      else if (type === "blue") { tone(1300, 0.1, { type: "square", vol: 0.06 }); tone(1600, 0.1, { type: "square", vol: 0.06, delay: 0.06 }); }
      else if (type === "white") { tone(500, 0.2, { type: "square", to: 1200, vol: 0.08 }); }
    },
    hit(mat, k) {
      if (throttle("hit" + mat, 45)) return;
      const v = Math.min(0.6, 0.12 + k * 0.03);
      if (mat === "wood" || mat === "tnt") { noise(0.12, { freq: 500, vol: v }); tone(140, 0.1, { type: "triangle", vol: v * 0.4 }); }
      else if (mat === "glass") { tone(2600 + Math.random() * 800, 0.15, { vol: v * 0.25 }); noise(0.06, { filter: "highpass", freq: 3000, vol: v * 0.4 }); }
      else { noise(0.14, { freq: 260, vol: v * 1.2 }); tone(90, 0.12, { type: "sine", vol: v * 0.6 }); }
    },
    break(mat) {
      if (throttle("break" + mat, 60)) return;
      if (mat === "glass") {
        noise(0.45, { filter: "highpass", freq: 2500, vol: 0.4 });
        for (let i = 0; i < 4; i++) tone(2000 + Math.random() * 2500, 0.25, { vol: 0.06, delay: i * 0.04 });
      } else if (mat === "stone") {
        noise(0.5, { freq: 300, to: 120, vol: 0.6 });
      } else {
        noise(0.35, { freq: 900, to: 250, vol: 0.5 });
        tone(110, 0.2, { type: "triangle", vol: 0.15 });
      }
    },
    pigHit() {
      if (throttle("pighit", 120)) return;
      tone(320, 0.15, { type: "sawtooth", to: 200, vol: 0.06 });
    },
    pigDie() {
      if (throttle("pigdie", 80)) return;
      noise(0.3, { filter: "bandpass", freq: 700, vol: 0.4, q: 1 });
      tone(500, 0.25, { type: "square", to: 160, vol: 0.07 });
    },
    explode() {
      noise(0.9, { freq: 1200, to: 60, vol: 0.9, rate: 0.6 });
      tone(70, 0.6, { type: "sine", to: 35, vol: 0.5 });
    },
    poof() { noise(0.2, { filter: "bandpass", freq: 1500, vol: 0.12 }); },
    coin() {
      if (throttle("coin", 70)) return;
      tone(1320, 0.08, { type: "square", vol: 0.05 }); tone(1760, 0.16, { type: "square", vol: 0.05, delay: 0.06 });
    },
    buy() { [988, 1319, 1568].forEach((f, i) => tone(f, 0.14, { type: "triangle", vol: 0.16, delay: i * 0.07 })); },
    cry() { tone(260, 0.5, { type: "sawtooth", to: 140, vol: 0.12 }); noise(0.4, { filter: "bandpass", freq: 500, vol: 0.25 }); },
    clank() {
      if (throttle("clank", 120)) return;
      tone(1900, 0.18, { type: "triangle", vol: 0.1 }); tone(2700, 0.12, { type: "sine", vol: 0.06 });
    },
    bonus() { tone(880, 0.12,{ type: "triangle", vol: 0.15 }); tone(1320, 0.18, { type: "triangle", vol: 0.15, delay: 0.08 }); },
    star(i) { tone(660 * Math.pow(1.26, i), 0.35, { type: "triangle", vol: 0.2 }); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, { type: "triangle", vol: 0.18, delay: i * 0.12 })); },
    lose() {
      // the pigs laugh
      for (let i = 0; i < 5; i++) tone(260 - i * 12, 0.11, { type: "sawtooth", to: 200 - i * 10, vol: 0.07, delay: i * 0.14 });
    },
  };
  window.SFX = SFX;
})();
