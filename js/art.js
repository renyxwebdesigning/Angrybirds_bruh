/* Drawing: textures, birds (with upgrade gear), pigs, blocks, slingshot,
 * terrain, props and the five world backdrops.
 * Functions named draw* work in local metres with +y up; the caller sets the
 * transform (main.js: local()). Backdrop functions work in screen pixels.
 */
(function () {
  "use strict";
  const TAU = Math.PI * 2;

  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function ellipse(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  /* ---------------- noise ---------------- */

  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return mix(mix(a, b, u), mix(c, d, u), v);
  }
  // tileable fbm: coordinates wrap every `p` units
  function tnoise(x, y, s, p) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const w = (k) => ((k % p) + p) % p;
    const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s), c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
    return mix(mix(a, b, u), mix(c, d, u), v);
  }
  function fbm(x, y, s, p, oct) {
    let t = 0, amp = 0.5, f = 1;
    for (let i = 0; i < (oct || 4); i++) { t += amp * tnoise(x * f, y * f, s + i, p * f); amp *= 0.5; f *= 2; }
    return t;
  }

  /* ---------------- textures ---------------- */

  const TEX_PX = 128;           // texture pixels per metre
  const texCache = {};

  function makeTex(size, fn) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const c = cv.getContext("2d");
    const img = c.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const p = fn(x, y);
      const i = (y * size + x) * 4;
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = p[3] == null ? 255 : p[3];
    }
    c.putImageData(img, 0, 0);
    return cv;
  }

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const lerpc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

  function woodTex(light, dark, seed) {
    const L = hex(light), D = hex(dark);
    const S = 256, P = 8;   // 2 m tile, noise period 8 cells
    return makeTex(S, (x, y) => {
      const u = x / S * P, v = y / S * P;
      const warp = fbm(u * 0.5, v * 2, seed, P * 0.5) * 2.2;
      const g = v * 3.2 + warp;
      const ring = Math.abs(Math.sin(g * Math.PI));
      const fine = tnoise(u * 16, v * 1.2, seed + 9, P * 16) * 0.5 + tnoise(u * 40, v * 4, seed + 3, P * 40) * 0.5;
      let t = clamp(0.25 + ring * 0.45 + (fine - 0.5) * 0.5, 0, 1);
      // knots
      const kn = tnoise(u * 1.5, v * 3, seed + 21, P * 1.5);
      if (kn > 0.82) t = clamp(t + (kn - 0.82) * 4, 0, 1);
      const c = lerpc(L, D, t);
      return c;
    });
  }

  function stoneTex(base, dark, seed) {
    const B = hex(base), D = hex(dark);
    const S = 256, P = 8;
    return makeTex(S, (x, y) => {
      const u = x / S * P, v = y / S * P;
      const n = fbm(u, v, seed, P, 5);
      const vein = Math.abs(fbm(u * 0.7, v * 0.7, seed + 40, P * 0.7, 3) - 0.5);
      const speck = hash(x, y, seed);
      let t = clamp(0.2 + n * 0.75, 0, 1);
      if (vein < 0.025) t += 0.35 * (1 - vein / 0.025);
      const c = lerpc(B, D, clamp(t, 0, 1));
      const s = speck > 0.97 ? 30 : speck < 0.03 ? -30 : 0;
      return [c[0] + s, c[1] + s, c[2] + s];
    });
  }

  function iceTex(seed) {
    const S = 256, P = 8;
    return makeTex(S, (x, y) => {
      const u = x / S * P, v = y / S * P;
      const n = fbm(u, v, seed, P, 4);
      const streak = Math.abs(Math.sin((u * 0.6 + v * 1.6 + n * 2) * 2.2));
      const a = 150 + n * 70 + (streak > 0.96 ? 40 : 0);
      return [200 + n * 40, 230 + n * 20, 250, a];
    });
  }

  function soilTex(top, bottom, seed, pebbles) {
    const A = hex(top), Bc = hex(bottom);
    const S = 256, P = 8;
    return makeTex(S, (x, y) => {
      const u = x / S * P, v = y / S * P;
      const n = fbm(u * 1.5, v * 1.5, seed, P * 1.5, 4);
      let c = lerpc(A, Bc, clamp(n * 1.2 - 0.1, 0, 1));
      const pb = tnoise(u * 6, v * 6, seed + 7, P * 6);
      if (pebbles && pb > 0.78) c = lerpc(c, hex(pebbles), clamp((pb - 0.78) * 6, 0, 0.8));
      const g = (hash(x, y, seed) - 0.5) * 18;
      return [c[0] + g, c[1] + g, c[2] + g];
    });
  }

  /* ---------------- world themes ---------------- */

  const THEMES = [
    { // Meadow Valley
      sky: ["#3f8fd8", "#8cc8ee", "#dff0ec"], sun: { x: 0.78, y: 0.2, r: 0.06, c: "#fff8dc", glow: "rgba(255,244,200,0.55)" },
      haze: "#cfe5e4", clouds: "rgba(255,255,255,0.95)", cloudShade: "rgba(190,205,220,0.9)",
      layers: [
        { kind: "hills", color: "#a9c9b2", amp: 0.30, f: 0.0028, ph: 1.7, par: 0.15, y: 0.98 },
        { kind: "trees", color: "#7fa98a", amp: 0.16, f: 0.006, ph: 0.4, par: 0.3, y: 0.99 },
        { kind: "hills", color: "#6f9d58", amp: 0.12, f: 0.0055, ph: 2.6, par: 0.5, y: 1.0 },
      ],
      surface: "grass", top: ["#5ba336", "#86c94c"], soil: ["#7a5532", "#3e2a18"], pebbles: "#a08766", strata: "rgba(40,25,10,0.25)",
      props: ["oak", "oak", "bush", "rock", "flowers", "bush"],
      wood: ["#d9a066", "#9a6232"], stone: ["#a7abae", "#5f6468"], ambient: "leaves", light: [1, 1],
    },
    { // Scorched Canyon
      sky: ["#2f7fcf", "#a9cde6", "#f6dcb0"], sun: { x: 0.7, y: 0.14, r: 0.055, c: "#fffbe8", glow: "rgba(255,236,190,0.7)" },
      haze: "#f1d6ad", clouds: "rgba(255,250,240,0.85)", cloudShade: "rgba(230,200,170,0.8)",
      layers: [
        { kind: "mesas", color: "#d9a27a", amp: 0.42, f: 0.002, ph: 0.3, par: 0.12, y: 0.98 },
        { kind: "mesas", color: "#c27a4c", amp: 0.26, f: 0.0035, ph: 2.1, par: 0.3, y: 0.99 },
        { kind: "dunes", color: "#d8a964", amp: 0.1, f: 0.006, ph: 0.9, par: 0.5, y: 1.0 },
      ],
      surface: "sand", top: ["#d9ab62", "#ecc98a"], soil: ["#c48448", "#7a4422"], pebbles: "#e0b07a", strata: "rgba(120,50,20,0.3)",
      props: ["cactus", "rock", "deadbush", "cactus", "rock"],
      wood: ["#d9b98c", "#8f6a46"], stone: ["#d8a874", "#9a6236"], ambient: "dust", light: [1, 1.1],
    },
    { // Frostpeak
      sky: ["#5f8fc6", "#b8d0e8", "#eef3f8"], sun: { x: 0.25, y: 0.22, r: 0.045, c: "#ffffff", glow: "rgba(240,248,255,0.6)" },
      haze: "#dfe8f1", clouds: "rgba(250,252,255,0.95)", cloudShade: "rgba(180,195,215,0.9)",
      layers: [
        { kind: "peaks", color: "#9fb2c8", snow: "#f2f6fb", amp: 0.55, f: 0.0026, ph: 0.2, par: 0.1, y: 0.98 },
        { kind: "peaks", color: "#7d93ad", snow: "#e9f0f7", amp: 0.34, f: 0.0042, ph: 1.4, par: 0.25, y: 0.99 },
        { kind: "pines", color: "#4f6b73", amp: 0.14, f: 0.006, ph: 0.6, par: 0.5, y: 1.0 },
      ],
      surface: "snow", top: ["#dfe9f3", "#ffffff"], soil: ["#7c8794", "#3d454f"], pebbles: "#a6b0ba", strata: "rgba(30,40,55,0.3)",
      props: ["pine", "pine", "rock", "pine"],
      wood: ["#b98a5e", "#6b4628"], stone: ["#9aa4ad", "#4f5861"], ambient: "snow", light: [-1, 1],
    },
    { // Coral Coast (sunset)
      sky: ["#2d3f7c", "#d9775a", "#ffcf87"], sun: { x: 0.62, y: 0.62, r: 0.07, c: "#fff1c8", glow: "rgba(255,190,120,0.6)" },
      haze: "#f3b98a", clouds: "rgba(255,214,190,0.9)", cloudShade: "rgba(170,100,120,0.8)",
      layers: [
        { kind: "sea", color: "#3d6f9c", par: 0, y: 0.82 },
        { kind: "islands", color: "#5a4a6a", amp: 0.16, f: 0.004, ph: 0.8, par: 0.15, y: 0.82 },
        { kind: "dunes", color: "#7a5a5a", amp: 0.07, f: 0.006, ph: 2.2, par: 0.35, y: 1.0 },
      ],
      surface: "beach", top: ["#e2c085", "#f3dcaa"], soil: ["#d4b075", "#8e6d42"], pebbles: "#f6e6c4", strata: "rgba(110,80,40,0.25)",
      props: ["palm", "rock", "palm", "shell", "bush"],
      wood: ["#d2b08a", "#7d5a3c"], stone: ["#b7aaa0", "#6e625a"], ambient: "spray", light: [-1, 0.6],
    },
    { // Mount Cinder (night, lava)
      sky: ["#0f0d1c", "#3a1d2c", "#a4412a"], sun: { x: 0.2, y: 0.16, r: 0.03, c: "#f4ead8", glow: "rgba(240,230,210,0.25)", moon: true },
      haze: "#6a2c22", clouds: "rgba(60,45,50,0.85)", cloudShade: "rgba(25,18,22,0.9)",
      layers: [
        { kind: "volcano", color: "#2a1f26", par: 0.08, y: 0.98 },
        { kind: "peaks", color: "#33242a", snow: null, amp: 0.3, f: 0.0045, ph: 0.9, par: 0.25, y: 0.99 },
        { kind: "hills", color: "#24191b", amp: 0.12, f: 0.006, ph: 0.3, par: 0.5, y: 1.0 },
      ],
      surface: "ash", top: ["#3b3330", "#57493f"], soil: ["#2e2626", "#100c0c"], pebbles: "#4b3f3a", strata: "rgba(255,90,20,0.35)",
      props: ["deadtree", "rock", "rock", "deadtree"],
      wood: ["#8a6748", "#3a2616"], stone: ["#4c4a4d", "#1e1d20"], ambient: "embers", light: [1, 0.7],
    },
  ];

  function texFor(kind, world) {
    const key = kind + world;
    if (texCache[key]) return texCache[key];
    const th = THEMES[world];
    let cv;
    if (kind === "wood") cv = woodTex(th.wood[0], th.wood[1], 11 + world);
    else if (kind === "stone") cv = stoneTex(th.stone[0], th.stone[1], 31 + world);
    else if (kind === "ice") cv = iceTex(51);
    else if (kind === "tnt") cv = woodTex("#d8442c", "#7a1a0c", 71);
    else if (kind === "soil") cv = soilTex(th.soil[0], th.soil[1], 91 + world, th.pebbles);
    texCache[key] = cv;
    return cv;
  }

  const patCache = new WeakMap();
  function pattern(c, kind, world) {
    let m = patCache.get(c);
    if (!m) { m = {}; patCache.set(c, m); }
    const key = kind + world;
    if (!m[key]) m[key] = c.createPattern(texFor(kind, world), "repeat");
    return m[key];
  }

  /* ---------------- birds ---------------- */

  const BIRD_COLORS = {
    red:    { body: "#d42a24", light: "#f0574a", dark: "#7e1410", belly: "#f1d8bd" },
    blue:   { body: "#4b9bd8", light: "#86c3f0", dark: "#1f5a8a", belly: "#dcecf8" },
    yellow: { body: "#f0c020", light: "#ffe066", dark: "#a8780a", belly: "#fff0bf" },
    black:  { body: "#2a2a30", light: "#55555f", dark: "#08080a", belly: "#4a4a52" },
    white:  { body: "#f2eee3", light: "#ffffff", dark: "#b8b09a", belly: "#ffffff" },
    big:    { body: "#a5221c", light: "#d0453a", dark: "#5a0f0b", belly: "#e3c3a0" },
  };

  function shadeBall(c, s, col, flash) {
    const g = c.createRadialGradient(-s * 0.35, s * 0.4, s * 0.05, 0, 0, s * 1.05);
    if (flash) { g.addColorStop(0, "#fff"); g.addColorStop(0.5, "#ffb070"); g.addColorStop(1, "#c03010"); }
    else { g.addColorStop(0, col.light); g.addColorStop(0.55, col.body); g.addColorStop(1, col.dark); }
    c.fillStyle = g;
  }

  function featherStrokes(c, s, color) {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = s * 0.025;
    c.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const a = 0.6 + i * 0.32, rr = s * (0.55 + (i % 3) * 0.12);
      c.beginPath();
      c.arc(Math.cos(a) * rr * 0.3 - s * 0.1, Math.sin(a) * rr * 0.3 + s * 0.1, s * 0.22, a + 2.2, a + 3.2);
      c.stroke();
    }
    c.restore();
  }

  // eyes + brows looking toward +x; s = bird radius
  function face(c, s, o) {
    const ex = o.ex, ey = o.ey, er = o.er;
    for (const side of [-1, 1]) {
      const x = ex * s + side * er * s * 0.95;
      const g = c.createRadialGradient(x - er * s * 0.3, ey * s + er * s * 0.3, er * s * 0.1, x, ey * s, er * s * 1.1);
      g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#d8d8d8");
      c.fillStyle = g;
      ellipse(c, x, ey * s, er * s, er * s * 1.1); c.fill();
      c.lineWidth = s * 0.035; c.strokeStyle = "rgba(0,0,0,0.4)"; c.stroke();
      if (o.closed) {
        c.strokeStyle = "#222"; c.lineWidth = s * 0.07;
        c.beginPath(); c.moveTo(x - er * s * 0.8, ey * s); c.lineTo(x + er * s * 0.8, ey * s); c.stroke();
      } else {
        const px = x + er * s * 0.35, py = ey * s - er * s * 0.05;
        c.fillStyle = "#3a2410"; circle(c, px, py, er * s * 0.5); c.fill();
        c.fillStyle = "#0b0b0b"; circle(c, px, py, er * s * 0.32); c.fill();
        c.fillStyle = "rgba(255,255,255,0.9)"; circle(c, px - er * s * 0.15, py + er * s * 0.2, er * s * 0.13); c.fill();
      }
    }
    // angry brows meeting in the middle
    c.fillStyle = o.brow || "#1b1b1b";
    const bx = ex * s, by = ey * s + er * s * 0.95;
    c.beginPath();
    c.moveTo(bx - er * s * 2.1, by + s * 0.2);
    c.lineTo(bx, by - s * 0.03);
    c.lineTo(bx + er * s * 2.1, by + s * 0.2);
    c.lineTo(bx + er * s * 2.1, by + s * 0.33);
    c.lineTo(bx, by + s * 0.12);
    c.lineTo(bx - er * s * 2.1, by + s * 0.33);
    c.closePath();
    c.fill();
  }

  function beak(c, s, x, y, size) {
    size = size || 1;
    const g = c.createLinearGradient(x, y + s * 0.15 * size, x, y - s * 0.25 * size);
    g.addColorStop(0, "#ffc142"); g.addColorStop(1, "#d97a08");
    c.fillStyle = g;
    c.strokeStyle = "#8a4e06";
    c.lineWidth = s * 0.03;
    c.beginPath();
    c.moveTo(x, y + s * 0.15 * size);
    c.quadraticCurveTo(x + s * 0.3 * size, y + s * 0.08, x + s * 0.5 * size, y - s * 0.03);
    c.lineTo(x, y - s * 0.08 * size);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#c46a06";
    c.beginPath();
    c.moveTo(x, y - s * 0.08 * size);
    c.lineTo(x + s * 0.38 * size, y - s * 0.06);
    c.quadraticCurveTo(x + s * 0.15, y - s * 0.22 * size, x + s * 0.02, y - s * 0.26 * size);
    c.closePath(); c.fill(); c.stroke();
  }

  function tail(c, s, color) {
    c.fillStyle = color;
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(-s * 0.85, i * s * 0.08);
      c.quadraticCurveTo(-s * 1.15, i * s * 0.25 + s * 0.1, -s * 1.38, i * s * 0.28 + s * 0.05);
      c.lineTo(-s * 1.3, i * s * 0.28 - s * 0.12);
      c.closePath();
      c.fill();
    }
  }

  // metal gradient for armour; gold for tier 5
  function metal(c, x0, y0, x1, y1, gold) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    if (gold) { g.addColorStop(0, "#fff3b0"); g.addColorStop(0.35, "#f2c335"); g.addColorStop(0.7, "#b8860b"); g.addColorStop(1, "#ffe27a"); }
    else { g.addColorStop(0, "#f2f5f7"); g.addColorStop(0.35, "#a9b2ba"); g.addColorStop(0.7, "#5d666e"); g.addColorStop(1, "#c9d0d6"); }
    return g;
  }

  // gear for upgrade tiers: 2 leather cap, 3 chest plate, 4 spiked helmet, 5 all in gold
  function gearBack(c, s, tier, type) {
    if (tier < 3) return;
    const gold = tier >= 5;
    // chest plate over the belly
    c.save();
    circle(c, 0, 0, s * 1.001); c.clip();
    c.fillStyle = metal(c, -s, -s * 0.3, s, -s, gold);
    c.beginPath();
    c.moveTo(-s, -s * 0.5);
    c.quadraticCurveTo(0, -s * 0.36, s, -s * 0.52);
    c.lineTo(s, -s); c.lineTo(-s, -s); c.closePath();
    c.fill();
    c.strokeStyle = gold ? "#8a6205" : "#3b4248"; c.lineWidth = s * 0.05;
    c.beginPath(); c.moveTo(-s, -s * 0.5); c.quadraticCurveTo(0, -s * 0.36, s, -s * 0.52); c.stroke();
    c.fillStyle = gold ? "#fff1a8" : "#e6eaee";
    for (const rx of [-0.5, -0.12, 0.26, 0.6]) { circle(c, rx * s, -s * 0.55, s * 0.045); c.fill(); }
    c.restore();
    void type;
  }

  function gearFront(c, s, tier, type, t) {
    if (tier < 2) return;
    const gold = tier >= 5;
    const topY = type === "yellow" ? s * 0.55 : type === "white" ? s * 0.85 : s * 0.62;
    const hw = type === "yellow" ? s * 0.55 : s * 0.78;
    if (tier < 4) {
      // leather cap with goggles strap
      const g = c.createLinearGradient(0, topY + s * 0.5, 0, topY - s * 0.1);
      g.addColorStop(0, "#a8723e"); g.addColorStop(1, "#5a3618");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-hw, topY);
      c.quadraticCurveTo(-hw * 0.9, topY + s * 0.55, 0, topY + s * 0.6);
      c.quadraticCurveTo(hw * 0.9, topY + s * 0.55, hw, topY);
      c.quadraticCurveTo(0, topY + s * 0.12, -hw, topY);
      c.closePath(); c.fill();
      c.strokeStyle = "#3a2210"; c.lineWidth = s * 0.04; c.stroke();
      c.strokeStyle = "rgba(255,230,190,0.5)"; c.lineWidth = s * 0.025;
      c.beginPath(); c.moveTo(-hw * 0.5, topY + s * 0.3); c.quadraticCurveTo(0, topY + s * 0.45, hw * 0.5, topY + s * 0.3); c.stroke();
      return;
    }
    // spiked helmet (gold at tier 5)
    c.fillStyle = metal(c, -hw, topY + s * 0.6, hw, topY, gold);
    c.beginPath();
    c.moveTo(-hw * 1.05, topY);
    c.quadraticCurveTo(-hw, topY + s * 0.62, 0, topY + s * 0.66);
    c.quadraticCurveTo(hw, topY + s * 0.62, hw * 1.05, topY);
    c.quadraticCurveTo(0, topY + s * 0.1, -hw * 1.05, topY);
    c.closePath(); c.fill();
    c.strokeStyle = gold ? "#7a5604" : "#2f353a"; c.lineWidth = s * 0.04; c.stroke();
    // spike
    c.fillStyle = metal(c, -s * 0.1, 0, s * 0.1, 0, gold);
    c.beginPath(); c.moveTo(-s * 0.1, topY + s * 0.6); c.lineTo(0, topY + s * 1.0); c.lineTo(s * 0.1, topY + s * 0.6); c.closePath(); c.fill(); c.stroke();
    // rim
    c.fillStyle = gold ? "#c9970f" : "#4c555c";
    c.beginPath(); c.moveTo(-hw * 1.08, topY + s * 0.02); c.quadraticCurveTo(0, topY + s * 0.16, hw * 1.08, topY + s * 0.02);
    c.lineTo(hw * 1.08, topY - s * 0.06); c.quadraticCurveTo(0, topY + s * 0.06, -hw * 1.08, topY - s * 0.06); c.closePath(); c.fill();
    if (gold) {
      // sparkle
      const k = (t * 1.5) % 2;
      if (k < 1) {
        const a = Math.sin(k * Math.PI);
        c.fillStyle = `rgba(255,255,230,${a})`;
        c.save(); c.translate(-hw * 0.4, topY + s * 0.45); c.rotate(k);
        c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.04 : s * 0.16; c.lineTo(Math.cos(i * Math.PI / 4) * rr, Math.sin(i * Math.PI / 4) * rr); } c.closePath(); c.fill();
        c.restore();
      }
    }
  }

  function drawBird(c, type, s, t, opts) {
    opts = opts || {};
    const col = BIRD_COLORS[type];
    const tier = opts.tier || 0;
    c.lineJoin = "round";
    if (type === "yellow") {
      c.fillStyle = "#222";
      c.beginPath(); c.moveTo(-s * 0.9, -s * 0.2); c.lineTo(-s * 1.35, -s * 0.05); c.lineTo(-s * 1.3, -s * 0.4); c.closePath(); c.fill();
      const g = c.createLinearGradient(-s * 0.4, s * 0.9, s * 0.4, -s * 0.8);
      g.addColorStop(0, col.light); g.addColorStop(0.5, col.body); g.addColorStop(1, col.dark);
      c.fillStyle = opts.flash ? "#fff" : g;
      c.strokeStyle = "rgba(90,60,0,0.6)";
      c.lineWidth = s * 0.05;
      c.beginPath();
      c.moveTo(-s * 1.0, -s * 0.75);
      c.lineTo(s * 1.05, -s * 0.75);
      c.quadraticCurveTo(s * 0.4, s * 0.4, -s * 0.15, s * 1.0);
      c.quadraticCurveTo(-s * 0.6, s * 0.2, -s * 1.0, -s * 0.75);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = col.belly;
      c.beginPath(); c.moveTo(-s * 0.7, -s * 0.72); c.lineTo(s * 0.7, -s * 0.72); c.quadraticCurveTo(0, -s * 0.2, -s * 0.7, -s * 0.72); c.fill();
      if (tier >= 3) {
        c.fillStyle = metal(c, -s, -s * 0.4, s, -s * 0.75, tier >= 5);
        c.beginPath(); c.moveTo(-s * 0.85, -s * 0.72); c.lineTo(s * 0.85, -s * 0.72); c.quadraticCurveTo(0, -s * 0.3, -s * 0.85, -s * 0.72); c.fill();
      }
      c.fillStyle = "#222";
      c.beginPath(); c.moveTo(-s * 0.15, s * 0.95); c.lineTo(-s * 0.25, s * 1.35); c.lineTo(s * 0.1, s * 1.1); c.closePath(); c.fill();
      face(c, s, { ex: 0.12, ey: 0.08, er: 0.2, closed: opts.blink });
      beak(c, s, s * 0.32, -s * 0.28, 1.1);
      gearFront(c, s, tier, type, t);
      return;
    }
    if (type === "white") {
      const g = c.createRadialGradient(-s * 0.3, s * 0.4, s * 0.1, 0, 0, s * 1.15);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.6, col.body); g.addColorStop(1, col.dark);
      c.fillStyle = g; c.strokeStyle = "rgba(120,110,90,0.6)"; c.lineWidth = s * 0.05;
      ellipse(c, 0, 0, s * 0.92, s * 1.08); c.fill(); c.stroke();
      c.fillStyle = "#222";
      c.beginPath(); c.moveTo(-s * 0.05, s * 1.0); c.lineTo(-s * 0.2, s * 1.35); c.lineTo(s * 0.15, s * 1.15); c.closePath(); c.fill();
      tail(c, s * 0.9, "#222");
      gearBack(c, s, tier, type);
      face(c, s, { ex: 0.2, ey: 0.28, er: 0.2, closed: opts.blink });
      beak(c, s, s * 0.42, -s * 0.05, 0.9);
      gearFront(c, s, tier, type, t);
      return;
    }
    if (type === "black") {
      c.strokeStyle = "#5a4a2a"; c.lineWidth = s * 0.1;
      c.beginPath(); c.moveTo(0, s * 0.95); c.quadraticCurveTo(s * 0.1, s * 1.25, s * 0.25, s * 1.3); c.stroke();
      if (opts.lit) {
        c.fillStyle = (t * 20 | 0) % 2 ? "#ffd23a" : "#ff6a1a";
        circle(c, s * 0.28, s * 1.32, s * 0.16); c.fill();
      }
    }
    if (type !== "black") tail(c, s, "#1b1b1b");
    shadeBall(c, s, col, opts.flash);
    circle(c, 0, 0, s); c.fill();
    c.strokeStyle = "rgba(0,0,0,0.5)"; c.lineWidth = s * 0.04; c.stroke();
    featherStrokes(c, s, "rgba(0,0,0,0.12)");
    // belly
    c.save();
    circle(c, 0, 0, s); c.clip();
    const bg = c.createRadialGradient(s * 0.15, -s * 0.6, s * 0.1, s * 0.15, -s * 0.85, s * 0.9);
    bg.addColorStop(0, col.belly); bg.addColorStop(1, type === "black" ? "#2a2a30" : "rgba(0,0,0,0.05)");
    c.fillStyle = bg;
    ellipse(c, s * 0.15, -s * 0.85, s * 0.8, s * 0.48); c.fill();
    // rim light
    c.strokeStyle = "rgba(255,255,255,0.25)"; c.lineWidth = s * 0.08;
    c.beginPath(); c.arc(0, 0, s * 0.94, 1.9, 2.9); c.stroke();
    c.restore();
    gearBack(c, s, tier, type);
    if ((type === "red" || type === "big" || type === "blue") && tier < 2) {
      c.fillStyle = col.body;
      c.strokeStyle = "rgba(0,0,0,0.4)";
      c.lineWidth = s * 0.03;
      for (const [dx, h] of [[-0.12, 0.45], [0.08, 0.38]]) {
        ellipse(c, dx * s, s * (0.95 + h * 0.35), s * 0.12, s * h * 0.55, -0.3);
        c.fill(); c.stroke();
      }
    }
    face(c, s, { ex: 0.2, ey: 0.2, er: type === "big" ? 0.17 : 0.21, closed: opts.blink, brow: type === "black" ? "#000" : "#1b1b1b" });
    beak(c, s, s * 0.45, -s * 0.15, type === "big" ? 0.85 : 1);
    gearFront(c, s, tier, type, t);
  }

  function drawEgg(c, s) {
    const g = c.createRadialGradient(-s * 0.3, s * 0.4, s * 0.05, 0, 0, s * 1.1);
    g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#d8ccb0");
    c.fillStyle = g; c.strokeStyle = "rgba(140,120,80,0.6)"; c.lineWidth = s * 0.05;
    ellipse(c, 0, 0, s * 0.85, s * 1.05); c.fill(); c.stroke();
  }

  /* ---------------- pigs ---------------- */

  function drawPig(c, e, t) {
    const s = e.r;
    const hurt = 1 - Math.max(0, e.hp) / e.maxHp;
    const king = e.size === "king", boss = e.size === "boss";
    c.lineJoin = "round";
    // ears
    for (const side of [-1, 1]) {
      const g = c.createRadialGradient(side * s * 0.55, s * 0.82, 0, side * s * 0.55, s * 0.78, s * 0.24);
      g.addColorStop(0, "#5f9a35"); g.addColorStop(1, "#78b947");
      c.fillStyle = g;
      circle(c, side * s * 0.55, s * 0.78, s * 0.22); c.fill();
      c.strokeStyle = "rgba(30,60,10,0.6)"; c.lineWidth = s * 0.04; c.stroke();
    }
    const g = c.createRadialGradient(-s * 0.35, s * 0.4, s * 0.05, 0, 0, s * 1.05);
    g.addColorStop(0, "#b4e67a"); g.addColorStop(0.55, "#7fc046"); g.addColorStop(1, "#3f7a1e");
    c.fillStyle = g;
    circle(c, 0, 0, s); c.fill();
    c.strokeStyle = "rgba(30,60,10,0.7)"; c.lineWidth = s * 0.045; c.stroke();
    // skin texture: faint spots
    c.fillStyle = "rgba(60,110,25,0.18)";
    for (const [x, y, r] of [[-0.45, -0.2, 0.08], [0.5, 0.1, 0.06], [-0.2, 0.55, 0.05], [0.3, -0.55, 0.07], [0.62, -0.25, 0.05]]) { circle(c, x * s, y * s, r * s); c.fill(); }
    if (hurt > 0.3) {
      c.fillStyle = "rgba(70,60,40,0.4)";
      circle(c, -s * 0.5, -s * 0.35, s * 0.18); c.fill();
      circle(c, s * 0.55, s * 0.45, s * 0.13); c.fill();
    }
    const blink = ((t + e.blink) % 4) < 0.12;
    for (const side of [-1, 1]) {
      const x = side * s * 0.42, y = s * 0.3;
      const eg = c.createRadialGradient(x - s * 0.05, y + s * 0.05, 0, x, y, s * 0.21);
      eg.addColorStop(0, "#ffffff"); eg.addColorStop(1, "#dcdcd0");
      c.fillStyle = eg;
      circle(c, x, y, s * 0.2); c.fill();
      c.strokeStyle = "rgba(30,60,10,0.6)"; c.lineWidth = s * 0.03; c.stroke();
      if (blink) {
        c.strokeStyle = "#1b3a08"; c.lineWidth = s * 0.06;
        c.beginPath(); c.moveTo(x - s * 0.15, y); c.lineTo(x + s * 0.15, y); c.stroke();
      } else {
        c.fillStyle = "#111";
        circle(c, x - s * 0.06, y - s * 0.02, s * 0.09); c.fill();
        c.fillStyle = "#fff"; circle(c, x - s * 0.09, y + s * 0.02, s * 0.03); c.fill();
      }
      if (hurt > 0.55 && side === 1) {
        c.fillStyle = "rgba(60,40,90,0.5)";
        ellipse(c, x, y - s * 0.02, s * 0.24, s * 0.22); c.fill();
      }
    }
    if (boss) {
      // moustache
      c.fillStyle = "#3a2410";
      c.beginPath();
      c.moveTo(0, -s * 0.3);
      c.bezierCurveTo(-s * 0.3, -s * 0.15, -s * 0.6, -s * 0.5, -s * 0.7, -s * 0.3);
      c.bezierCurveTo(-s * 0.55, -s * 0.6, -s * 0.2, -s * 0.5, 0, -s * 0.38);
      c.bezierCurveTo(s * 0.2, -s * 0.5, s * 0.55, -s * 0.6, s * 0.7, -s * 0.3);
      c.bezierCurveTo(s * 0.6, -s * 0.5, s * 0.3, -s * 0.15, 0, -s * 0.3);
      c.fill();
    }
    // snout
    const sg = c.createRadialGradient(-s * 0.08, -s * 0.05, 0, 0, -s * 0.12, s * 0.36);
    sg.addColorStop(0, "#c6f08e"); sg.addColorStop(1, "#7cb848");
    c.fillStyle = sg; c.strokeStyle = "rgba(40,80,15,0.7)"; c.lineWidth = s * 0.035;
    ellipse(c, 0, -s * 0.12, s * 0.33, s * 0.24); c.fill(); c.stroke();
    c.fillStyle = "#2f5c12";
    ellipse(c, -s * 0.12, -s * 0.12, s * 0.06, s * 0.1); c.fill();
    ellipse(c, s * 0.12, -s * 0.12, s * 0.06, s * 0.1); c.fill();
    c.strokeStyle = "#2f5c12"; c.lineWidth = s * 0.045;
    c.beginPath(); c.arc(0, -s * 0.38, s * 0.22, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
    if (king) {
      c.fillStyle = metal(c, -s * 0.6, s * 1.3, s * 0.6, s * 0.8, true); c.strokeStyle = "#7a5604"; c.lineWidth = s * 0.04;
      c.beginPath();
      c.moveTo(-s * 0.55, s * 0.8);
      c.lineTo(-s * 0.6, s * 1.35); c.lineTo(-s * 0.3, s * 1.1); c.lineTo(0, s * 1.45);
      c.lineTo(s * 0.3, s * 1.1); c.lineTo(s * 0.6, s * 1.35); c.lineTo(s * 0.55, s * 0.8);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "#e3342f"; circle(c, 0, s * 1.0, s * 0.09); c.fill();
      c.fillStyle = "#3b8be0"; circle(c, -s * 0.33, s * 0.95, s * 0.07); c.fill(); circle(c, s * 0.33, s * 0.95, s * 0.07); c.fill();
    } else if (e.helmet || boss) {
      const cracked = hurt > 0.45;
      c.fillStyle = boss ? (() => { const hg = c.createLinearGradient(0, s * 1.2, 0, s * 0.4); hg.addColorStop(0, "#ffd84a"); hg.addColorStop(1, "#d39a12"); return hg; })()
        : metal(c, -s * 0.6, s * 1.2, s * 0.6, s * 0.4, false);
      c.strokeStyle = "rgba(40,45,50,0.8)"; c.lineWidth = s * 0.04;
      c.beginPath();
      c.arc(0, s * 0.35, s * 0.9, 0.15, Math.PI - 0.15);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = boss ? "#b8840e" : "#6d767d";
      c.fillRect(-s * 0.95, s * 0.36, s * 1.9, s * 0.14);
      if (cracked) {
        c.strokeStyle = "#2c3034"; c.lineWidth = s * 0.05;
        c.beginPath(); c.moveTo(s * 0.1, s * 1.2); c.lineTo(s * 0.2, s * 0.9); c.lineTo(0, s * 0.75); c.lineTo(s * 0.15, s * 0.5); c.stroke();
      }
    }
  }

  /* ---------------- blocks ---------------- */

  function shapePath(c, e) {
    c.beginPath();
    if (e.shape === "ball") c.arc(0, 0, e.r, 0, TAU);
    else if (e.shape === "tri") { c.moveTo(e.pts[0][0], e.pts[0][1]); c.lineTo(e.pts[1][0], e.pts[1][1]); c.lineTo(e.pts[2][0], e.pts[2][1]); c.closePath(); }
    else c.rect(-e.w / 2, -e.h / 2, e.w, e.h);
  }
  function bounds(e) { return e.shape === "ball" ? [e.r * 2, e.r * 2] : [e.w, e.h]; }

  function cracks(e) {
    if (e.cracks) return e.cracks;
    const r = rng(e.seed || 1);
    const [w, h] = bounds(e);
    const list = [];
    for (let i = 0; i < 6; i++) {
      let x = (r() - 0.5) * w * 0.8, y = (r() - 0.5) * h * 0.8;
      const pts = [[x, y]];
      const ang = r() * TAU;
      const n = 3 + (r() * 3 | 0);
      const len = Math.max(w, h) * 0.12;
      for (let k = 0; k < n; k++) {
        x += Math.cos(ang + (r() - 0.5) * 1.6) * len;
        y += Math.sin(ang + (r() - 0.5) * 1.6) * len;
        pts.push([clamp(x, -w / 2, w / 2), clamp(y, -h / 2, h / 2)]);
      }
      list.push(pts);
    }
    return (e.cracks = list);
  }

  const MATRIX = typeof DOMMatrix !== "undefined" ? DOMMatrix : null;

  // angle: body angle, so lighting can stay world-fixed
  function drawBlock(c, e, px, world, angle) {
    const th = THEMES[world];
    const [w, h] = bounds(e);
    const ice = e.mat === "glass" && world === 2;
    shapePath(c, e);
    if (e.mat === "glass" && !ice) {
      const g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      g.addColorStop(0, "rgba(190,230,250,0.55)"); g.addColorStop(0.5, "rgba(225,245,255,0.35)"); g.addColorStop(1, "rgba(150,205,235,0.6)");
      c.fillStyle = g;
      c.fill();
    } else {
      const kind = ice ? "ice" : e.mat === "tnt" ? "tnt" : e.mat;
      const pat = pattern(c, kind, world);
      if (MATRIX && pat.setTransform) {
        const rot = (e.shape === "box" && h > w) ? 90 : 0;
        const off = (e.seed || 0) % 997 / 997 * 2;
        pat.setTransform(new MATRIX().rotate(rot).translate(off, off * 0.37).scale(1 / TEX_PX));
      }
      c.fillStyle = pat;
      c.fill();
    }
    c.save();
    shapePath(c, e);
    c.clip();
    // world-fixed lighting: light from above (and a bit from the sun's side)
    const lx = Math.sin(angle) * 1 + Math.cos(angle) * 0.35 * th.light[0];
    const ly = Math.cos(angle) * 1 - Math.sin(angle) * 0.35 * th.light[0];
    const ext = Math.max(w, h) / 2;
    const lg = c.createLinearGradient(-lx * ext, -ly * ext, lx * ext, ly * ext);
    lg.addColorStop(0, "rgba(0,0,0,0.32)");
    lg.addColorStop(0.55, "rgba(0,0,0,0)");
    lg.addColorStop(1, "rgba(255,250,235,0.22)");
    c.fillStyle = lg;
    c.fillRect(-w, -h, w * 2, h * 2);
    if (e.mat === "glass" || ice) {
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = Math.min(w, h) * 0.12;
      c.beginPath(); c.moveTo(-w / 2, -h * 0.1); c.lineTo(-w * 0.1, h / 2); c.stroke();
      c.lineWidth = Math.min(w, h) * 0.05;
      c.beginPath(); c.moveTo(-w * 0.15, -h / 2); c.lineTo(w * 0.25, h / 2); c.stroke();
    }
    if (e.mat === "tnt") {
      c.fillStyle = "rgba(0,0,0,0.35)";
      c.fillRect(-w / 2, h / 2 - h * 0.12, w, h * 0.12);
      c.fillRect(-w / 2, -h / 2, w, h * 0.12);
      c.save(); c.scale(1, -1);
      c.fillStyle = "#ffe9a8";
      c.font = `${h * 0.4}px "Lilita One", Impact, sans-serif`;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("TNT", 0, h * 0.02);
      c.restore();
    }
    // bevel: light inner edge on top, dark on bottom
    if (e.shape === "box") {
      const bw = Math.min(0.05, Math.min(w, h) * 0.18);
      c.fillStyle = "rgba(255,255,255,0.16)";
      c.fillRect(-w / 2, h / 2 - bw, w, bw);
      c.fillRect(-w / 2, -h / 2, bw, h);
      c.fillStyle = "rgba(0,0,0,0.2)";
      c.fillRect(-w / 2, -h / 2, w, bw);
      c.fillRect(w / 2 - bw, -h / 2, bw, h);
    }
    // cracks show the damage
    const hurt = 1 - Math.max(0, e.hp) / e.maxHp;
    const show = Math.min(6, Math.floor(hurt * 7));
    if (show) {
      const list = cracks(e);
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = pass ? (e.mat === "glass" || ice ? "#ffffff" : "rgba(15,8,0,0.85)") : "rgba(255,255,255,0.25)";
        c.lineWidth = Math.max(px * (pass ? 1.4 : 2.6), pass ? 0.018 : 0.03);
        for (let i = 0; i < show; i++) {
          c.beginPath();
          list[i].forEach((p, k) => k ? c.lineTo(p[0], p[1] - (pass ? 0 : 0.012)) : c.moveTo(p[0], p[1] - (pass ? 0 : 0.012)));
          c.stroke();
        }
      }
    }
    c.restore();
    shapePath(c, e);
    c.strokeStyle = e.mat === "glass" ? "rgba(235,250,255,0.9)" : ice ? "rgba(240,250,255,0.8)" : "rgba(20,12,4,0.55)";
    c.lineWidth = Math.max(px * 1.2, 0.015);
    c.stroke();
  }

  /* ---------------- slingshot (6 upgrade looks) ---------------- */

  const SL = { back: [0.26, 3.0], front: [-0.24, 2.95] };
  const SLING_LOOK = [
    { wood: ["#7d4b1f", "#5b3414"], band: "#3b200c" },                      // 0 plain
    { wood: ["#8a5426", "#5b3414"], band: "#3b200c", rope: "#c9a66b" },     // 1 rope wrapped
    { wood: ["#8a5426", "#5b3414"], band: "#262626", metal: "iron" },       // 2 iron bands
    { metalFrame: "steel", band: "#1d1d1d" },                               // 3 steel
    { metalFrame: "bronze", band: "#1d1d1d" },                              // 4 bronze
    { metalFrame: "gold", band: "#b0201a", gem: true },                     // 5 gold
  ];

  function frameStroke(c, look, path, wide, narrow) {
    if (look.metalFrame) {
      const cols = { steel: ["#2e3439", "#aeb7bf"], bronze: ["#5a3510", "#d8994a"], gold: ["#7a5604", "#ffd34a"] }[look.metalFrame];
      c.strokeStyle = cols[0]; c.lineWidth = wide; path(); c.stroke();
      c.strokeStyle = cols[1]; c.lineWidth = narrow; path(0.03); c.stroke();
    } else {
      c.strokeStyle = look.wood[1]; c.lineWidth = wide; path(); c.stroke();
      c.strokeStyle = look.wood[0]; c.lineWidth = narrow; path(0.03); c.stroke();
    }
  }

  function slingBack(c, tier) {
    const look = SLING_LOOK[tier || 0];
    c.lineCap = "round";
    frameStroke(c, look, (o) => { o = o || 0; c.beginPath(); c.moveTo(0.03 - o, 1.85); c.quadraticCurveTo(0.28 - o, 2.3, SL.back[0] - o, SL.back[1]); }, 0.3, 0.17);
    frameStroke(c, look, (o) => { o = o || 0; c.beginPath(); c.moveTo(-o, -0.3); c.lineTo(-o, 1.95); }, 0.42, 0.22);
    if (look.rope) {
      c.strokeStyle = look.rope; c.lineWidth = 0.05;
      for (let y = 0.5; y < 1.8; y += 0.11) { c.beginPath(); c.moveTo(-0.2, y); c.lineTo(0.2, y + 0.06); c.stroke(); }
    }
    if (look.metal) {
      c.fillStyle = "#4c555c";
      for (const y of [0.6, 1.3, 1.8]) c.fillRect(-0.23, y, 0.46, 0.09);
    }
  }

  function band(c, from, to, tier) {
    c.lineCap = "round";
    c.strokeStyle = SLING_LOOK[tier || 0].band;
    c.lineWidth = 0.15;
    c.beginPath(); c.moveTo(from[0], from[1]); c.lineTo(to.x, to.y); c.stroke();
  }

  function pouch(c, p, ang) {
    c.save();
    c.translate(p.x, p.y);
    c.rotate(ang);
    const g = c.createLinearGradient(-0.2, 0, 0.1, 0);
    g.addColorStop(0, "#2e1a08"); g.addColorStop(1, "#6a4020");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(-0.1, 0, 0.18, 0.36, 0, 0, TAU);
    c.fill();
    c.restore();
  }

  function slingFront(c, tier) {
    const look = SLING_LOOK[tier || 0];
    c.lineCap = "round";
    frameStroke(c, look, (o) => { o = o || 0; c.beginPath(); c.moveTo(-o, 1.85); c.quadraticCurveTo(-0.3 - o, 2.25, SL.front[0] - o, SL.front[1]); }, 0.32, 0.16);
    c.strokeStyle = look.band; c.lineWidth = 0.1;
    c.beginPath(); c.moveTo(-0.24, 2.75); c.lineTo(-0.22, 2.9); c.stroke();
    c.beginPath(); c.moveTo(0.2, 2.8); c.lineTo(0.26, 2.95); c.stroke();
    if (look.gem) {
      c.fillStyle = "#3fd0ff"; c.strokeStyle = "#0a5a80"; c.lineWidth = 0.02;
      c.beginPath(); c.moveTo(0, 1.95); c.lineTo(0.1, 1.85); c.lineTo(0, 1.72); c.lineTo(-0.1, 1.85); c.closePath(); c.fill(); c.stroke();
    }
  }

  /* ---------------- props ---------------- */

  function drawProp(c, kind, s, r, th) {
    switch (kind) {
      case "oak": {
        c.fillStyle = "#5a3d24";
        c.beginPath(); c.moveTo(-0.22 * s, 0); c.quadraticCurveTo(-0.1 * s, 1.4 * s, -0.12 * s, 2.2 * s); c.lineTo(0.12 * s, 2.2 * s); c.quadraticCurveTo(0.12 * s, 1.4 * s, 0.24 * s, 0); c.closePath(); c.fill();
        const blobs = [[0, 3.0, 1.2], [-0.9, 2.5, 0.9], [0.9, 2.6, 0.95], [-0.4, 3.6, 0.85], [0.5, 3.5, 0.9]];
        for (const [x, y, rr] of blobs) {
          const g = c.createRadialGradient((x - 0.3) * s, (y + 0.35) * s, 0, x * s, y * s, rr * s);
          g.addColorStop(0, "#7fbf4a"); g.addColorStop(0.7, "#4c8a2c"); g.addColorStop(1, "#2f5e1a");
          c.fillStyle = g; circle(c, x * s, y * s, rr * s); c.fill();
        }
        break;
      }
      case "bush": {
        for (const [x, y, rr] of [[-0.4, 0.3, 0.45], [0.3, 0.35, 0.5], [0, 0.6, 0.45]]) {
          const g = c.createRadialGradient((x - 0.15) * s, (y + 0.2) * s, 0, x * s, y * s, rr * s);
          g.addColorStop(0, th.surface === "beach" ? "#6aa04a" : "#78b347"); g.addColorStop(1, "#2f5e1a");
          c.fillStyle = g; circle(c, x * s, y * s, rr * s); c.fill();
        }
        break;
      }
      case "flowers": {
        for (let i = 0; i < 6; i++) {
          const x = (r() - 0.5) * 1.2 * s;
          c.strokeStyle = "#3f7a22"; c.lineWidth = 0.03;
          c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 0.3 * s); c.stroke();
          c.fillStyle = ["#fff", "#ffd23a", "#ff7aa8", "#b38bff"][(r() * 4) | 0];
          circle(c, x, 0.32 * s, 0.07 * s); c.fill();
        }
        break;
      }
      case "rock": {
        const n = 7, pts = [];
        for (let i = 0; i < n; i++) {
          const a = Math.PI * i / (n - 1);
          pts.push([Math.cos(a) * (0.7 + r() * 0.3) * s, Math.sin(a) * (0.45 + r() * 0.35) * s]);
        }
        const g = c.createLinearGradient(-0.5 * s, 0.7 * s, 0.4 * s, 0);
        const sc = th.stone;
        g.addColorStop(0, sc[0]); g.addColorStop(1, sc[1]);
        c.fillStyle = g;
        c.beginPath(); c.moveTo(pts[0][0], -0.05); pts.forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fill();
        if (th.surface === "snow") { c.fillStyle = "#f4f8fc"; c.beginPath(); c.ellipse(0, Math.max(...pts.map(p => p[1])) - 0.05 * s, 0.45 * s, 0.12 * s, 0, 0, TAU); c.fill(); }
        break;
      }
      case "pine": {
        c.fillStyle = "#4a3222"; c.fillRect(-0.1 * s, 0, 0.2 * s, 0.8 * s);
        for (let i = 0; i < 4; i++) {
          const y = 0.6 * s + i * 0.75 * s, w = (1.3 - i * 0.25) * s;
          const g = c.createLinearGradient(-w, y, w, y + s);
          g.addColorStop(0, "#2e5b4a"); g.addColorStop(1, "#173528");
          c.fillStyle = g;
          c.beginPath(); c.moveTo(-w, y); c.lineTo(0, y + 1.3 * s); c.lineTo(w, y); c.closePath(); c.fill();
          c.fillStyle = "rgba(245,250,255,0.95)";
          c.beginPath(); c.moveTo(-w * 0.45, y + 0.75 * s); c.lineTo(0, y + 1.3 * s); c.lineTo(w * 0.45, y + 0.75 * s); c.quadraticCurveTo(0, y + 0.9 * s, -w * 0.45, y + 0.75 * s); c.fill();
        }
        break;
      }
      case "cactus": {
        const g = c.createLinearGradient(-0.25 * s, 0, 0.25 * s, 0);
        g.addColorStop(0, "#3f7a3a"); g.addColorStop(0.5, "#6aa65a"); g.addColorStop(1, "#2f5a2a");
        c.strokeStyle = g; c.lineCap = "round";
        c.lineWidth = 0.42 * s;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 2.6 * s); c.stroke();
        c.lineWidth = 0.3 * s;
        c.beginPath(); c.moveTo(0, 1.2 * s); c.lineTo(-0.6 * s, 1.2 * s); c.lineTo(-0.6 * s, 1.9 * s); c.stroke();
        c.beginPath(); c.moveTo(0, 1.6 * s); c.lineTo(0.55 * s, 1.6 * s); c.lineTo(0.55 * s, 2.2 * s); c.stroke();
        c.strokeStyle = "rgba(20,50,20,0.4)"; c.lineWidth = 0.025;
        c.beginPath(); c.moveTo(-0.08 * s, 0.1); c.lineTo(-0.08 * s, 2.6 * s); c.moveTo(0.08 * s, 0.1); c.lineTo(0.08 * s, 2.6 * s); c.stroke();
        break;
      }
      case "deadbush": {
        c.strokeStyle = "#7a5a38"; c.lineWidth = 0.04; c.lineCap = "round";
        for (let i = 0; i < 7; i++) { const a = 0.4 + i * 0.35; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 0.7 * s, Math.sin(a) * 0.6 * s); c.stroke(); }
        break;
      }
      case "palm": {
        const lean = (r() - 0.3) * 0.8;
        c.strokeStyle = "#7a5a3a"; c.lineCap = "round"; c.lineWidth = 0.22 * s;
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(lean * 0.3 * s, 2 * s, lean * s, 3.8 * s); c.stroke();
        c.strokeStyle = "rgba(60,40,20,0.5)"; c.lineWidth = 0.03;
        for (let i = 1; i < 12; i++) { const k = i / 12; const x = lean * k * k * s * 1, y = 3.8 * k * s; c.beginPath(); c.moveTo(x - 0.1 * s, y); c.lineTo(x + 0.1 * s, y + 0.05); c.stroke(); }
        const tx = lean * s, ty = 3.8 * s;
        for (let i = 0; i < 7; i++) {
          const a = -0.3 + i * 0.6 + (r() - 0.5) * 0.2;
          const ex = tx + Math.cos(a) * 1.7 * s, ey = ty + Math.sin(a) * 0.5 * s - 0.5 * s;
          c.strokeStyle = i % 2 ? "#2f6b2a" : "#3e8a35"; c.lineWidth = 0.18 * s;
          c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo((tx + ex) / 2, ty + 0.5 * s, ex, ey); c.stroke();
        }
        c.fillStyle = "#5a3a1a"; circle(c, tx + 0.1 * s, ty - 0.15 * s, 0.13 * s); c.fill(); circle(c, tx - 0.12 * s, ty - 0.1 * s, 0.12 * s); c.fill();
        break;
      }
      case "shell": {
        c.fillStyle = "#f6d6c8"; c.strokeStyle = "#c79a88"; c.lineWidth = 0.02;
        c.beginPath(); c.moveTo(-0.2 * s, 0); c.quadraticCurveTo(0, 0.4 * s, 0.2 * s, 0); c.closePath(); c.fill(); c.stroke();
        break;
      }
      case "deadtree": {
        c.strokeStyle = "#1c1414"; c.lineCap = "round";
        const br = (x, y, a, len, w, d) => {
          const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
          c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
          if (d > 0) { br(x2, y2, a + 0.5 + r() * 0.2, len * 0.65, w * 0.6, d - 1); br(x2, y2, a - 0.5 - r() * 0.2, len * 0.65, w * 0.6, d - 1); }
        };
        br(0, 0, Math.PI / 2 + (r() - 0.5) * 0.2, 1.4 * s, 0.22 * s, 3);
        break;
      }
    }
  }

  /* ---------------- terrain (screen space) ---------------- */

  function surfaceAt(pts, x) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (x >= a[0] && x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / ((b[0] - a[0]) || 1);
    }
    return pts[x < pts[0][0] ? 0 : pts.length - 1][1];
  }

  // pts: terrain in screen pixels [[x, y], ...]; gyBottom: screen bottom
  function drawTerrain(c, pts, H, z, world, camX, t) {
    const th = THEMES[world];
    // soil body
    c.beginPath();
    c.moveTo(pts[0][0], H + 10);
    for (const p of pts) c.lineTo(p[0], p[1]);
    c.lineTo(pts[pts.length - 1][0], H + 10);
    c.closePath();
    const pat = pattern(c, "soil", world);
    if (MATRIX && pat.setTransform) pat.setTransform(new MATRIX().translate(-camX * z, 0).scale(z / TEX_PX));
    c.fillStyle = pat;
    c.fill();
    // depth darkening
    c.save();
    c.clip();
    const dg = c.createLinearGradient(0, Math.min(...pts.map(p => p[1])), 0, H);
    dg.addColorStop(0, "rgba(0,0,0,0)"); dg.addColorStop(1, "rgba(0,0,0,0.35)");
    c.fillStyle = dg; c.fillRect(0, 0, c.canvas.width, H);
    // strata lines following the surface
    c.strokeStyle = th.strata; c.lineWidth = Math.max(1, z * 0.06);
    for (const k of [0.9, 1.7, 2.6]) {
      c.beginPath();
      pts.forEach((p, i) => { const y = p[1] + k * z + Math.sin((p[0] / z + camX) * 0.7 + k) * z * 0.08; i ? c.lineTo(p[0], y) : c.moveTo(p[0], y); });
      c.stroke();
    }
    if (th.surface === "ash") {
      // glowing lava veins
      const pulse = 0.6 + 0.4 * Math.sin(t * 2);
      c.strokeStyle = `rgba(255,${110 + pulse * 60},30,${0.5 + pulse * 0.3})`;
      c.lineWidth = Math.max(1.5, z * 0.05);
      c.shadowColor = "#ff5a10"; c.shadowBlur = z * 0.3;
      const first = Math.floor(camX / 3) - 1;
      for (let k = first; k < first + c.canvas.width / (3 * z) + 3; k++) {
        if (hash(k, 3, 9) < 0.45) continue;
        let x = (k * 3 - camX) * z + hash(k, 4, 9) * z * 2;
        let y = surfaceAt(pts, x) + z * (0.35 + hash(k, 5, 9) * 0.3);
        c.beginPath(); c.moveTo(x, y);
        for (let j = 0; j < 6; j++) {
          x += (hash(k, 10 + j, 9) - 0.3) * z * 0.6;
          y += z * (0.15 + hash(k, 20 + j, 9) * 0.25);
          c.lineTo(x, y);
        }
        c.stroke();
      }
      c.shadowBlur = 0;
    }
    c.restore();
    // surface layer
    const thick = { grass: 0.3, sand: 0.22, snow: 0.38, beach: 0.25, ash: 0.18 }[th.surface] * z;
    c.lineJoin = "round"; c.lineCap = "round";
    const line = (off) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1] + off) : c.moveTo(p[0], p[1] + off)); };
    c.strokeStyle = th.top[0]; c.lineWidth = thick * 2; line(thick * 0.5); c.stroke();
    c.strokeStyle = th.top[1]; c.lineWidth = thick * 0.7; line(0); c.stroke();
    if (th.surface === "grass") {
      // blades
      c.strokeStyle = "#6fb83e"; c.lineWidth = Math.max(1, z * 0.025);
      const step = Math.max(3, z * 0.12);
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        for (let x = x0; x < x1; x += step) {
          const k = (x - x0) / (x1 - x0 || 1), y = y0 + (y1 - y0) * k;
          const hsh = hash(Math.round((x / z + camX) * 10), 1, 5);
          const hgt = (0.08 + hsh * 0.14) * z;
          c.beginPath(); c.moveTo(x, y + 1); c.lineTo(x + (hsh - 0.5) * z * 0.08, y - hgt); c.stroke();
        }
      }
    } else if (th.surface === "snow") {
      c.strokeStyle = "rgba(170,200,230,0.6)"; c.lineWidth = Math.max(1, z * 0.04); line(thick * 0.9); c.stroke();
    } else if (th.surface === "sand" || th.surface === "beach") {
      c.strokeStyle = "rgba(160,110,50,0.3)"; c.lineWidth = Math.max(1, z * 0.03); line(thick * 0.6); c.stroke();
    }
  }

  /* ---------------- backdrop (screen space) ---------------- */

  function cloud(c, x, y, s, th) {
    const parts = [[0, 4, 22], [24, -14, 28], [58, -20, 32], [90, -6, 26], [114, 6, 18], [44, 6, 24], [76, 8, 22]];
    c.beginPath();
    for (const [dx, dy, r] of parts) { c.moveTo(x + dx * s + r * s, y + dy * s); c.arc(x + dx * s, y + dy * s, r * s, 0, TAU); }
    const g = c.createLinearGradient(0, y - 52 * s, 0, y + 30 * s);
    g.addColorStop(0, th.clouds); g.addColorStop(0.55, th.clouds); g.addColorStop(1, th.cloudShade);
    c.fillStyle = g;
    c.fill();
  }

  function ridge(c, W, base, off, amp, f, ph, kind) {
    c.beginPath();
    c.moveTo(0, base + 2);
    for (let x = 0; x <= W + 24; x += kind === "peaks" ? 12 : 20) {
      const u = x + off;
      let y;
      if (kind === "peaks") {
        const a = Math.abs(((u * f + ph) % 2 + 2) % 2 - 1);
        const b = Math.abs(((u * f * 2.3 + ph * 3) % 2 + 2) % 2 - 1);
        y = base - amp * (0.25 + (1 - a) * 0.6 + (1 - b) * 0.25);
      } else if (kind === "mesas") {
        const v = Math.sin(u * f + ph) + 0.4 * Math.sin(u * f * 3.1 + ph);
        y = base - amp * (v > 0.35 ? 0.95 : v > 0.1 ? 0.95 * (v - 0.1) / 0.25 : 0.12 + v * 0.1);
      } else {
        y = base - amp * (0.55 + 0.3 * Math.sin(u * f + ph) + 0.15 * Math.sin(u * f * 2.7 + ph * 2));
      }
      c.lineTo(x, y);
    }
    c.lineTo(W, base + 2);
    c.closePath();
  }

  function backdrop(c, W, H, camX, z, gy, t, world) {
    const th = THEMES[world];
    const horizon = gy;
    const g = c.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, th.sky[0]); g.addColorStop(0.6, th.sky[1]); g.addColorStop(1, th.sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    if (world === 4) {
      // stars
      c.fillStyle = "rgba(255,255,255,0.8)";
      for (let i = 0; i < 70; i++) { const x = hash(i, 1, 4) * W, y = hash(i, 2, 4) * horizon * 0.6; const tw = 0.5 + 0.5 * Math.sin(t * 2 + i); c.globalAlpha = 0.3 + tw * 0.6; c.fillRect(x, y, 1.6, 1.6); }
      c.globalAlpha = 1;
    }
    // sun / moon with glow
    const sr = Math.min(W, H) * th.sun.r, sx = W * th.sun.x, sy = horizon * th.sun.y;
    const sg = c.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5);
    sg.addColorStop(0, th.sun.glow); sg.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = sg; c.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
    c.fillStyle = th.sun.c; circle(c, sx, sy, sr); c.fill();
    if (th.sun.moon) { c.fillStyle = "rgba(180,170,160,0.35)"; circle(c, sx - sr * 0.3, sy + sr * 0.2, sr * 0.25); c.fill(); circle(c, sx + sr * 0.35, sy - sr * 0.3, sr * 0.15); c.fill(); }
    // clouds
    const span = W + 500;
    const cs = Math.max(0.6, H / 720);
    for (let i = 0; i < 6; i++) {
      const x = ((i * 410 - camX * z * 0.08 + t * (5 + i * 2)) % span + span) % span - 250;
      cloud(c, x, horizon * (0.12 + (i % 3) * 0.12), (0.7 + (i % 2) * 0.5) * cs, th);
    }
    const hz = th.haze;
    for (const L of th.layers) {
      const base = horizon * L.y;
      const off = camX * z * L.par;
      if (L.kind === "sea") {
        const sg2 = c.createLinearGradient(0, base, 0, horizon);
        sg2.addColorStop(0, "#c78a7a"); sg2.addColorStop(0.15, L.color); sg2.addColorStop(1, "#1f3f66");
        c.fillStyle = sg2; c.fillRect(0, base, W, horizon - base + 2);
        // sun glitter
        for (let i = 0; i < 60; i++) {
          const f = hash(i, 1, 77), y = base + (horizon - base) * f;
          const spread = 20 + f * 160;
          const x = sx + (hash(i, 2, 77) - 0.5) * spread * 2;
          const a = 0.25 + 0.35 * Math.max(0, Math.sin(t * 2.5 + i * 2.1));
          c.fillStyle = `rgba(255,225,170,${a})`;
          c.fillRect(x, y, 4 + f * 18, 1.5);
        }
        // waves near the shore
        c.strokeStyle = "rgba(255,255,255,0.18)"; c.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const y = base + (horizon - base) * (0.55 + i * 0.12);
          c.beginPath();
          for (let x = 0; x <= W; x += 16) c.lineTo(x, y + Math.sin(x * 0.03 + t * 1.5 + i) * 2);
          c.stroke();
        }
        continue;
      }
      if (L.kind === "volcano") {
        const vx = W * 0.62 - off, top = horizon * 0.32, vw = W * 0.38;
        c.fillStyle = L.color;
        c.beginPath(); c.moveTo(vx - vw, base); c.lineTo(vx - vw * 0.14, top); c.lineTo(vx + vw * 0.14, top); c.lineTo(vx + vw, base); c.closePath(); c.fill();
        // lava glow and flows
        const pulse = 0.7 + 0.3 * Math.sin(t * 1.5);
        const lg = c.createRadialGradient(vx, top, 2, vx, top, vw * 0.35);
        lg.addColorStop(0, `rgba(255,140,40,${0.9 * pulse})`); lg.addColorStop(1, "rgba(255,80,20,0)");
        c.fillStyle = lg; c.fillRect(vx - vw * 0.4, top - vw * 0.4, vw * 0.8, vw * 0.8);
        c.save();
        c.shadowColor = "#ff5a10"; c.shadowBlur = 12;
        c.lineCap = "round"; c.lineJoin = "round";
        for (const [dx, wob] of [[-0.09, 1], [0.06, -1], [0.0, 0.6]]) {
          c.beginPath();
          for (let k = 0; k <= 20; k++) {
            const f = k / 20;
            const x = vx + dx * vw * (1 + f * 5) + Math.sin(f * 9 + wob * 2) * vw * 0.025 * f;
            const y = top + 2 + (base - top - 6) * f;
            k ? c.lineTo(x, y) : c.moveTo(x, y);
          }
          c.strokeStyle = `rgba(255,${80 + pulse * 70 | 0},20,0.9)`; c.lineWidth = 5; c.stroke();
          c.strokeStyle = "rgba(255,230,140,0.8)"; c.lineWidth = 1.5; c.stroke();
        }
        c.restore();
        // smoke plume
        for (let i = 0; i < 7; i++) {
          const k = ((t * 0.08 + i / 7) % 1);
          c.fillStyle = `rgba(70,55,60,${0.5 * (1 - k)})`;
          circle(c, vx + Math.sin(k * 4 + i) * 20 + k * 60, top - k * horizon * 0.35, 20 + k * 60); c.fill();
        }
        continue;
      }
      if (L.kind === "trees" || L.kind === "pines" || L.kind === "palms") {
        ridge(c, W, base, off, L.amp * horizon * 0.6, L.f, L.ph, "hills");
        c.fillStyle = L.color; c.fill();
        // silhouettes on top
        const step = 34;
        for (let x = -((off % step) + step) % step - step; x < W + step; x += step) {
          const u = Math.round((x + off) / step);
          const hh = hash(u, 7, world);
          const y = base - L.amp * horizon * 0.6 * (0.55 + 0.3 * Math.sin((x + off) * L.f + L.ph) + 0.15 * Math.sin((x + off) * L.f * 2.7 + L.ph * 2));
          const sz = (14 + hh * 14) * cs;
          c.fillStyle = L.color;
          if (L.kind === "trees") { circle(c, x, y - sz * 0.6, sz); c.fill(); }
          else if (L.kind === "pines") { c.beginPath(); c.moveTo(x - sz * 0.6, y + 2); c.lineTo(x, y - sz * 2.4); c.lineTo(x + sz * 0.6, y + 2); c.fill(); }
          else if (hh > 0.55) {
            c.strokeStyle = L.color; c.lineWidth = 3 * cs;
            c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 6, y - sz * 1.5, x + 10, y - sz * 3); c.stroke();
            for (let k = 0; k < 5; k++) { const a = -0.4 + k * 0.7; c.beginPath(); c.moveTo(x + 10, y - sz * 3); c.quadraticCurveTo(x + 10 + Math.cos(a) * sz, y - sz * 3 - sz * 0.4, x + 10 + Math.cos(a) * sz * 1.6, y - sz * 3 + Math.abs(Math.sin(a)) * sz * 0.5 + sz * 0.3); c.stroke(); }
          }
        }
        continue;
      }
      ridge(c, W, base, off, L.amp * horizon, L.f, L.ph, L.kind === "dunes" ? "hills" : L.kind);
      const lg = c.createLinearGradient(0, base - L.amp * horizon, 0, base);
      lg.addColorStop(0, L.color); lg.addColorStop(1, hz);
      c.fillStyle = lg; c.fill();
      if (L.kind === "peaks" && L.snow) {
        c.save(); c.clip();
        c.fillStyle = L.snow;
        c.fillRect(0, base - L.amp * horizon * 1.2, W, L.amp * horizon * 0.42);
        c.restore();
      }
      if (L.kind === "mesas") {
        c.save(); c.clip();
        c.strokeStyle = "rgba(120,50,20,0.25)"; c.lineWidth = 3;
        for (let k = 1; k < 5; k++) { const y = base - L.amp * horizon * k * 0.18; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        c.restore();
      }
    }
    // haze over the horizon
    const hg = c.createLinearGradient(0, horizon * 0.7, 0, horizon);
    hg.addColorStop(0, "rgba(255,255,255,0)"); hg.addColorStop(1, world === 4 ? "rgba(120,40,20,0.35)" : "rgba(255,255,255,0.25)");
    c.fillStyle = hg; c.fillRect(0, horizon * 0.7, W, horizon * 0.3);
  }

  window.ART = {
    THEMES, BIRD_COLORS, SL, SLING_LOOK,
    drawBird, drawEgg, drawPig, drawBlock, drawProp, slingBack, slingFront, band, pouch,
    drawTerrain, backdrop, circle, ellipse, rng, hash,
  };
})();
