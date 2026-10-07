/* Feather Fury worlds and their levels.
 *
 * 5 worlds x 20 levels. Levels are generated from a seed: terrain with
 * plateaus and valleys, then structures picked from the world's templates.
 * tools/check.js searches for seeds whose levels stand still on their own and
 * can be won by a bot without upgrades, and writes them to js/seeds.js.
 */
(function (root) {
  "use strict";

  const WORLDS = [
    { id: 0, name: "Meadow Valley", sub: "Where the eggs were taken",
      newBird: { 0: "red", 8: "blue" }, roster: ["red", "blue"],
      pal: { main: "wood", alt: "glass", strong: "stone", altP: 0.25, strongP: 0.05, tnt: 0.0 },
      templates: ["hut", "tower", "pyramid", "wall", "hut", "poles"], slingH: [0, 0.4, 0.8], plateau: [0, 1.6] },
    { id: 1, name: "Scorched Canyon", sub: "Tracks in the sand",
      newBird: { 0: "yellow" }, roster: ["red", "blue", "yellow"],
      pal: { main: "wood", alt: "glass", strong: "stone", altP: 0.3, strongP: 0.2, tnt: 0.1 },
      templates: ["hut", "tower", "pyramid", "bridge", "wall", "bunker"], slingH: [0, 0.8, 1.6], plateau: [-0.6, 2.6] },
    { id: 2, name: "Frostpeak", sub: "Up into the ice",
      newBird: { 0: "black" }, roster: ["red", "blue", "yellow", "black"],
      pal: { main: "glass", alt: "wood", strong: "stone", altP: 0.35, strongP: 0.3, tnt: 0.1 },
      templates: ["tower", "bunker", "pyramid", "bridge", "poles", "hut"], slingH: [0.6, 1.4, 2.2], plateau: [-1.0, 3.0] },
    { id: 3, name: "Coral Coast", sub: "The pigs set sail",
      newBird: { 0: "white" }, roster: ["red", "blue", "yellow", "black", "white"],
      pal: { main: "wood", alt: "stone", strong: "stone", altP: 0.3, strongP: 0.25, tnt: 0.2 },
      templates: ["shelter", "hut", "tower", "bridge", "wall", "shelter"], slingH: [0, 0.6, 1.2], plateau: [-0.4, 2.0] },
    { id: 4, name: "Mount Cinder", sub: "The king's fortress",
      newBird: { 0: "big" }, roster: ["red", "blue", "yellow", "black", "white", "big"],
      pal: { main: "stone", alt: "wood", strong: "stone", altP: 0.45, strongP: 0.4, tnt: 0.3 },
      templates: ["bunker", "pyramid", "tower", "shelter", "wall", "bridge"], slingH: [0.8, 1.8, 2.8], plateau: [-1.2, 3.4] },
  ];
  const PER_WORLD = 20;

  const POST = 0.22;
  const PIG_R = { s: 0.32, m: 0.44, l: 0.58, boss: 0.68, king: 0.78 };

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function builder(items) {
    const L = {
      block(mat, x, y, w, h) { items.push([mat, x, y + h / 2, w, h, 0]); return y + h; },
      post(mat, x, y, h) { return L.block(mat, x, y, POST, h || 1.6); },
      plank(mat, x, y, w) { return L.block(mat, x, y, w || 2.0, POST); },
      cube(mat, x, y, s) { return L.block(mat, x, y, s || 0.5, s || 0.5); },
      tri(mat, x, y, w, h) { items.push(["tri", mat, x, y + h / 2, w, h]); return y + h; },
      tnt(x, y) { return L.block("tnt", x, y, 0.62, 0.62); },
      pig(x, y, size, helmet) { items.push(["pig", x, y + PIG_R[size] + 0.01, size, !!helmet]); },
      frame(mat, x, y, w, h, top) {
        L.post(mat, x - w / 2 + POST / 2, y, h);
        L.post(mat, x + w / 2 - POST / 2, y, h);
        return L.plank(top || mat, x, y + h, w);
      },
      row(mat, x0, y, n, w, h, top) {
        let t = y;
        for (let i = 0; i < n; i++) t = L.frame(mat, x0 + i * w, y, w, h, top);
        return t;
      },
    };
    return L;
  }

  /* ---------- structure templates ----------
   * plan(o) returns { w, build(L, cx, y) }. o: { r, d, pal, mat(), pig(L, x, y, maxR, roof) }
   */
  const T = {
    hut(o) {
      const { r, d } = o;
      const n = 1 + (r() < d ? 1 : 0) + (r() < d * 0.4 ? 1 : 0);
      const w = 2.0 + Math.round(r() * 3) * 0.2, h = 1.3 + Math.round(r() * 2) * 0.15;
      const m = o.mat(), roof = o.mat();
      return {
        w: n * w,
        build(L, cx, y) {
          const x0 = cx - (n - 1) * w / 2;
          const t = L.row(m, x0, y, n, w, h, roof);
          for (let i = 0; i < n; i++) o.fill(L, x0 + i * w, y, Math.min((w - 0.5) / 2, (h - 0.05) / 2));
          const top = (r() * n) | 0;
          if (r() < 0.55) o.pig(L, x0 + top * w, t, 0.44, true);
          else L.tri(o.mat(), x0 + top * w, t, Math.min(1.6, w - 0.4), 0.8);
        },
      };
    },

    tower(o) {
      const { r, d } = o;
      const n = 2 + ((r() * (1 + d * 3)) | 0);
      const w0 = 2.0 + r() * 0.4, h = 1.3 + Math.round(r() * 2) * 0.1;
      return {
        w: w0,
        build(L, cx, y) {
          let t = y, w = w0;
          for (let i = 0; i < n; i++) {
            const base = t;
            t = L.frame(o.mat(), cx, base, w, h, o.mat());
            if (i % 2 === 0 || r() < 0.4) o.fill(L, cx, base, Math.min((w - 0.5) / 2, (h - 0.05) / 2));
            w = Math.max(1.4, w - 0.2);
          }
          if (r() < 0.6) o.pig(L, cx, t, 0.44, true);
          else L.tri(o.mat(), cx, t, Math.min(1.4, w), 0.8);
        },
      };
    },

    pyramid(o) {
      const { r, d } = o;
      const rows = 2 + (d > 0.4 ? 1 : 0) + (r() < d * 0.5 ? 1 : 0);
      const w = 2.0, h = 1.3;
      return {
        w: rows * w,
        build(L, cx, y) {
          let t = y;
          for (let k = 0; k < rows; k++) {
            const n = rows - k;
            const x0 = cx - (n - 1) * w / 2;
            const base = t;
            t = L.row(o.mat(), x0, base, n, w, h);
            for (let i = 0; i < n; i++) if (r() < 0.55) o.fill(L, x0 + i * w, base, 0.6);
          }
          o.pig(L, cx, t, 0.58, true);
        },
      };
    },

    wall(o) {
      const { r } = o;
      const rows = 2 + ((r() * 2) | 0), s = 0.6;
      const inner = T.hut(o);
      const m = r() < 0.5 ? o.pal.strong : o.mat();
      return {
        w: s + 0.4 + inner.w,
        build(L, cx, y) {
          const wx = cx - (s + 0.4 + inner.w) / 2 + s / 2;
          let t = y;
          for (let i = 0; i < rows; i++) t = L.cube(m, wx, t, s);
          inner.build(L, wx + s / 2 + 0.4 + inner.w / 2, y);
        },
      };
    },

    poles(o) {
      const { r, d } = o;
      const n = 2 + (r() < d ? 1 : 0);
      const gap = 1.6;
      return {
        w: n * 0.9 + (n - 1) * gap,
        build(L, cx, y) {
          const x0 = cx - ((n - 1) * (0.9 + gap)) / 2;
          for (let i = 0; i < n; i++) {
            const h = 1.6 + r() * 1.4;
            const t = L.frame(o.mat(), x0 + i * (0.9 + gap), y, 0.9, h, o.mat());
            o.pig(L, x0 + i * (0.9 + gap), t, 0.32, true);
          }
        },
      };
    },

    bunker(o) {
      const { r, d } = o;
      const w = 2.6 + Math.round(r() * 3) * 0.2, h = 1.4;
      const upper = r() < 0.4 + d * 0.4;
      const m = o.pal.strong;
      return {
        w,
        build(L, cx, y) {
          L.block(m, cx - w / 2 + 0.2, y, 0.4, h);
          L.block(m, cx + w / 2 - 0.2, y, 0.4, h);
          const t = L.block(m, cx, y + h, w, 0.34);
          o.pig(L, cx, y, Math.min((w - 0.9) / 2, 0.58));
          if (upper) {
            const t2 = L.frame(o.mat(), cx, t, w - 0.6, 1.2, o.mat());
            o.fill(L, cx, t, 0.44);
            if (r() < 0.5) o.pig(L, cx, t2, 0.44, true);
          } else if (r() < 0.5) o.pig(L, cx, t, 0.44, true);
        },
      };
    },

    shelter(o) {
      const { r, d } = o;
      const n = 1 + (r() < 0.6 ? 1 : 0) + (r() < d * 0.5 ? 1 : 0);
      const w = 2.2, h = 1.25;
      const m = o.pal.strong;
      return {
        w: n * w + (n - 1) * 0.8,
        build(L, cx, y) {
          const x0 = cx - ((n - 1) * (w + 0.8)) / 2;
          for (let i = 0; i < n; i++) {
            const x = x0 + i * (w + 0.8);
            L.post(m, x - w / 2 + 0.11 + 0.15, y, h);
            L.post(m, x + w / 2 - 0.11 - 0.15, y, h);
            L.block(m, x, y + h, w + 0.2, 0.3);
            o.pig(L, x, y, 0.58);
          }
        },
      };
    },

    bridge(o) {
      const { r } = o;
      const span = 1.8 + r() * 0.8, tw = 1.6, h = 1.3;
      const floors = 2 + (r() < o.d ? 1 : 0);
      return {
        w: tw * 2 + span,
        build(L, cx, y) {
          const xs = [cx - span / 2 - tw / 2, cx + span / 2 + tw / 2];
          let top = y;
          for (const x of xs) {
            let t = y;
            for (let i = 0; i < floors; i++) {
              const base = t;
              t = L.frame(o.mat(), x, base, tw, h, o.mat());
              if (i === 0 || r() < 0.4) o.fill(L, x, base, 0.44);
            }
            top = t;
          }
          L.plank(o.mat(), cx, top, span + tw);
          o.pig(L, cx, top + POST, 0.44, true);
          if (r() < 0.7) o.pig(L, cx, y, 0.58);
        },
      };
    },

    castle(o) {
      const { r } = o;
      const keepW = 4.0, tw = 1.6;
      const m = o.pal.strong;
      return {
        w: keepW + 2 * (tw + 0.8),
        build(L, cx, y) {
          for (const dx of [-(keepW / 2 + 0.8 + tw / 2), keepW / 2 + 0.8 + tw / 2]) {
            let t = y;
            for (let i = 0; i < 3; i++) {
              const base = t;
              t = L.frame(i === 0 ? m : o.mat(), cx + dx, base, tw, 1.3, o.mat());
              if (i === 1) o.pig(L, cx + dx, base, 0.44, false, true);
            }
            L.tri(m, cx + dx, t, 1.4, 0.9);
          }
          let t = L.frame(m, cx, y, keepW, 1.8);
          L.pig(cx, y, o.boss, true);
          t = L.row(o.mat(), cx - 1.0, t, 2, 2.0, 1.4, o.mat());
          o.pig(L, cx - 1.0, t - 1.62, 0.44); o.pig(L, cx + 1.0, t - 1.62, 0.44);
          const t2 = L.frame(o.mat(), cx, t, 2.4, 1.3, m);
          o.pig(L, cx, t, 0.44, true);
          if (o.pal.tnt > 0) { L.tnt(cx - keepW / 2 - 0.42, y); L.tnt(cx + keepW / 2 + 0.42, y); }
          void t2; void r;
        },
      };
    },
  };

  /* ---------- terrain ---------- */

  function smooth(a, b, k) { const s = (1 - Math.cos(Math.PI * k)) / 2; return a + (b - a) * s; }

  // zones: [{x0, x1, h}] flat parts in order; between them a smooth slope, maybe a valley.
  function terrain(zones, r) {
    const pts = [];
    const push = (x, y) => pts.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      push(z.x0, z.h);
      push(z.x1, z.h);
      const n = zones[i + 1];
      if (!n) break;
      const gap = n.x0 - z.x1;
      const dip = gap > 3 && r() < 0.6 ? 0.6 + r() * 1.4 : 0;
      const steps = Math.max(2, Math.round(gap / 0.5));
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        let h = smooth(z.h, n.h, t);
        if (dip) h -= dip * Math.sin(Math.PI * t) ** 2;
        push(z.x1 + gap * t, h);
      }
    }
    return pts;
  }

  /* ---------- a level ---------- */

  function generate(wi, li, seed) {
    const W = WORLDS[wi];
    const r = rng(seed * 7919 + wi * 104729 + li * 1299709 + 17);
    const d = li / (PER_WORLD - 1);                  // 0..1 inside the world
    const hard = Math.min(1, d * 0.75 + wi * 0.08);  // overall difficulty
    const boss = li === PER_WORLD - 1;
    const pal = W.pal;

    const helmetP = Math.max(0, hard - 0.2) * 0.8;
    const o = {
      r, d: hard, pal,
      boss: wi === 4 ? "king" : "boss",
      mat() {
        const x = r();
        if (x < pal.strongP * hard * 1.4) return pal.strong;
        if (x < pal.strongP * hard * 1.4 + pal.altP) return pal.alt;
        return pal.main;
      },
      pig(L, x, y, maxR, roof) {
        const opts = ["s"];
        if (maxR >= 0.44 && hard > 0.15) opts.push("m");
        if (maxR >= 0.58 && hard > 0.35 && !roof) opts.push("l");
        const size = opts[(r() * opts.length) | 0];
        L.pig(x, y, size, r() < helmetP);
      },
      // inside a frame: a pig, sometimes TNT, sometimes nothing
      fill(L, x, y, maxR) {
        const k = r();
        if (k < pal.tnt * (0.5 + hard)) L.tnt(x, y);
        else if (k < 0.85) o.pig(L, x, y, maxR);
      },
    };

    const slingY = W.slingH[(r() * W.slingH.length) | 0];
    const plans = [];
    if (boss) {
      plans.push(T.castle(o));
    } else {
      const count = hard < 0.15 ? 1 : hard < 0.55 ? (r() < 0.6 ? 2 : 1) : 2 + (r() < hard - 0.4 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const name = W.templates[(r() * W.templates.length) | 0];
        plans.push(T[name](o));
      }
    }

    // lay out plateaus
    const items = [];
    const L = builder(items);
    const zones = [{ x0: -60, x1: 2.5, h: slingY }];
    let x = 12.5 + r() * 3 + hard * 3;
    const [pLo, pHi] = W.plateau;
    for (const p of plans) {
      if (zones.length > 1 && x + p.w > 36) break;      // keep levels on one screen
      const h = Math.round((pLo + (pHi - pLo) * r() * (0.4 + hard * 0.6)) * 10) / 10;
      const x0 = x, x1 = x + p.w + 1.6;
      zones.push({ x0, x1, h });
      p.build(L, (x0 + x1) / 2, h);
      x = x1 + 2.5 + r() * 3.5;
    }
    zones.push({ x0: x + 2, x1: x + 80, h: zones[zones.length - 1].h + (r() - 0.5) });

    const pigs = items.filter(i => i[0] === "pig");
    if (!pigs.length) {
      const z = zones[1];
      L.pig((z.x0 + z.x1) / 2, z.h, "s");
    }
    const pigN = items.filter(i => i[0] === "pig").length;

    // birds
    const mats = { wood: 0, glass: 0, stone: 0 };
    for (const it of items) if (mats[it[0]] != null) mats[it[0]] += it[3] * it[4];
    const best = { wood: "yellow", glass: "blue", stone: "black" };
    let n = Math.max(3, Math.min(6, Math.round(pigN * 0.5 + 1.6 + r())));
    if (boss) n = Math.max(n, 5);
    const roster = W.roster.filter(b => b !== "big" || wi === 4);
    const featured = W.roster[W.roster.length - 1];
    const pick = () => {
      if (wi > 0 && r() < (featured === "big" ? 0.15 : 0.25)) return featured;
      const k = r();
      if (k < 0.35) return "red";
      if (k < 0.75) {
        const m = Object.keys(mats).sort((a, b) => mats[b] - mats[a])[(r() < 0.7 ? 0 : 1)];
        const b = best[m];
        if (roster.includes(b)) return b;
      }
      return roster[(r() * roster.length) | 0];
    };
    const birds = [];
    let intro = null;
    for (const k of Object.keys(W.newBird)) if (li >= +k && li < +k + 3) intro = W.newBird[k];
    if (wi === 0 && li < 8) intro = "red";
    for (let i = 0; i < n; i++) {
      if (intro && (i < 2 || wi === 0 && li < 8)) birds.push(intro);
      else birds.push(pick());
    }
    if (wi === 4 && li >= 1 && !birds.includes("big") && r() < 0.35) birds[0] = "big";

    return {
      name: `${wi + 1}-${li + 1}`, world: wi, index: li, seed,
      birds, items, sling: { x: 0, y: slingY },
      terrain: terrain(zones, r),
    };
  }

  const SEEDS = root.FF_SEEDS || (typeof require !== "undefined" ? (() => { try { return require("./seeds.js"); } catch (e) { return null; } })() : null);

  function level(wi, li) {
    const s = SEEDS && SEEDS[wi] && SEEDS[wi][li];
    const lv = generate(wi, li, s ? s[0] : 1);
    if (s && s[1]) lv.stars = [s[1], s[2]];
    return lv;
  }

  const API = { WORLDS, PER_WORLD, generate, level };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.WORLDGEN = API;
})(typeof window !== "undefined" ? window : globalThis);
