/* Feather Fury levels.
 *
 * Built with small helpers so stacks line up exactly. Every y passed to a
 * helper is the height the piece stands on; the helpers work out centres.
 * Run `node tools/check.js` after editing: it checks that every level stands
 * still on its own and that a simple bot can win it.
 */
(function (root) {
  "use strict";

  const POST = 0.22;          // thickness of posts and planks

  function make(name, birds, build, extra) {
    const items = [];
    const L = {
      block(mat, x, y, w, h, a) { items.push([mat, x, y + h / 2, w, h, a || 0]); return y + h; },
      post(mat, x, y, h) { return L.block(mat, x, y, POST, h || 1.6); },
      plank(mat, x, y, w) { return L.block(mat, x, y, w || 2.0, POST); },
      cube(mat, x, y, s) { return L.block(mat, x, y, s || 0.5, s || 0.5); },
      ball(mat, x, y, r) { items.push(["ball", mat, x, y + r, r]); return y + 2 * r; },
      tri(mat, x, y, w, h) { items.push(["tri", mat, x, y + h / 2, w, h]); return y + h; },
      tnt(x, y) { return L.block("tnt", x, y, 0.62, 0.62); },
      pig(x, y, size, helmet) {
        const r = { s: 0.32, m: 0.44, l: 0.58, king: 0.78 }[size || "s"];
        items.push(["pig", x, y + r + 0.01, size || "s", !!helmet]);
      },
      hill(x, w, h) { items.push(["ground", x, h / 2, w, h]); return h; },
      // two posts with a plank across; returns the height of the plank's top
      frame(mat, x, y, w, h, top) {
        w = w || 2.0; h = h || 1.6;
        L.post(mat, x - w / 2 + POST / 2, y, h);
        L.post(mat, x + w / 2 - POST / 2, y, h);
        return L.plank(top || mat, x, y + h, w);
      },
      // a row of frames sharing posts' footprint, returns top height
      row(mat, x0, y, n, w, h, top) {
        let t = y;
        for (let i = 0; i < n; i++) t = L.frame(mat, x0 + i * w, y, w, h, top);
        return t;
      },
    };
    build(L);
    return Object.assign({ name, birds, items }, extra || {});
  }

  const LEVELS = [
    // 1: two little huts
    make("1", ["red", "red", "red"], L => {
      let t = L.frame("wood", 16, 0);
      L.pig(16, 0, "s");
      L.pig(16, t, "s");
      t = L.frame("wood", 19.5, 0);
      L.pig(19.5, 0, "m");
    }),

    // 2: a two storey house of glass and wood
    make("2", ["red", "red", "red"], L => {
      let t = L.frame("wood", 17, 0, 2.4, 1.6);
      L.pig(17, 0, "s");
      t = L.frame("glass", 17, t, 2.4, 1.4, "wood");
      L.pig(17, t - 1.62, "s");
      L.pig(17, t, "m");
      L.cube("glass", 20, 0, 0.8);
      L.pig(20, 0.8, "s");
    }),

    // 3: a pyramid of frames
    make("3", ["red", "red", "red", "red"], L => {
      const x = 18;
      let t1 = L.row("wood", x - 2, 0, 3, 2.0, 1.4);
      L.pig(x - 2, 0, "s"); L.pig(x + 2, 0, "s");
      let t2 = L.row("wood", x - 1, t1, 2, 2.0, 1.4);
      L.pig(x - 1, t1, "s"); L.pig(x + 1, t1, "s");
      let t3 = L.frame("wood", x, t2, 2.0, 1.4);
      L.pig(x, t2, "m");
      L.tri("wood", x, t3, 1.4, 0.9);
    }),

    // 4: glass greenhouses (blue birds arrive)
    make("4", ["blue", "blue", "red", "blue"], L => {
      for (const x of [15, 18, 21]) {
        const t = L.frame("glass", x, 0, 2.0, 1.4);
        L.pig(x, 0, "s");
        const t2 = L.frame("glass", x, t, 2.0, 1.2);
        if (x !== 18) L.pig(x, t, "s");
        L.tri("glass", x, t2, 1.6, 0.8);
      }
    }),

    // 5: glass tower on a hill
    make("5", ["blue", "blue", "blue", "red"], L => {
      const h = L.hill(19, 6, 2.2);
      let t = h;
      t = L.frame("wood", 19, t, 2.6, 1.3, "glass");
      L.pig(19, h, "m");
      t = L.frame("glass", 19, t, 2.2, 1.3);
      L.pig(19, t - 1.52, "s");
      t = L.frame("glass", 19, t, 1.8, 1.3);
      L.pig(19, t - 1.52, "s");
      L.pig(19, t, "s");
      L.cube("glass", 16.6, h, 0.7);
      L.cube("glass", 21.4, h, 0.7);
    }),

    // 6: stone footing, glass walls, wooden roof
    make("6", ["blue", "red", "blue", "red"], L => {
      const x = 18;
      L.block("stone", x, 0, 6.6, 0.4);
      let t = L.row("glass", x - 1.6, 0.4, 2, 3.2, 1.5, "wood");
      L.pig(x - 1.6, 0.4, "m"); L.pig(x + 1.6, 0.4, "m");
      t = L.frame("glass", x, t, 2.4, 1.3, "wood");
      L.pig(x, t - 1.52, "s", true);
      L.tri("wood", x - 0.7, t, 1.0, 0.8);
      L.tri("wood", x + 0.7, t, 1.0, 0.8);
    }),

    // 7: tall wooden towers far away (yellow birds arrive)
    make("7", ["yellow", "yellow", "red"], L => {
      for (const x of [21, 26]) {
        let t = 0;
        for (let i = 0; i < 4; i++) {
          t = L.frame("wood", x, t, 1.8, 1.4);
          if (i % 2 === 1) L.pig(x, t - 1.62, "s");
        }
        L.pig(x, t, "m");
      }
      L.plank("wood", 23.5, 0, 2.4);
    }),

    // 8: wooden fort on a hill with helmet pigs
    make("8", ["yellow", "red", "yellow", "blue"], L => {
      const h = L.hill(21, 8, 1.6);
      const x = 21;
      for (const dx of [-2.6, 2.6]) {
        let t = L.frame("wood", x + dx, h, 1.4, 2.2);
        L.pig(x + dx, h, "s", true);
        L.cube("wood", x + dx, t, 0.6);
      }
      let t = L.frame("wood", x, h, 2.2, 1.6);
      L.pig(x, h, "m", true);
      t = L.frame("wood", x, t, 2.2, 1.4);
      L.pig(x, t - 1.62, "s");
      L.tri("wood", x, t, 1.8, 1.0);
    }),

    // 9: twin towers with TNT
    make("9", ["yellow", "blue", "red", "yellow"], L => {
      for (const x of [17, 22]) {
        let t = L.frame("wood", x, 0, 2.0, 1.5);
        L.tnt(x, 0);
        t = L.frame("glass", x, t, 2.0, 1.5, "wood");
        L.pig(x, t - 1.72, "m");
        t = L.frame("wood", x, t, 1.6, 1.2);
        L.pig(x, t, "s");
      }
      L.pig(19.5, 0, "s", true);
    }),

    // 10: stone bunker (black birds arrive)
    make("10", ["black", "black", "red"], L => {
      const x = 19;
      let t = L.row("stone", x - 1.2, 0, 2, 2.4, 1.3);
      L.pig(x - 1.2, 0, "m"); L.pig(x + 1.2, 0, "m");
      t = L.frame("stone", x, t, 2.4, 1.2);
      L.pig(x, t - 1.42, "s", true);
      L.block("stone", x, t, 0.6, 0.6);
    }),

    // 11: stone castle
    make("11", ["black", "yellow", "black", "red"], L => {
      const x = 20;
      const h = L.hill(x, 9, 1.0);
      for (const dx of [-3, 3]) {
        let t = h;
        for (let i = 0; i < 3; i++) t = L.frame("stone", x + dx, t, 1.4, 1.2);
        L.pig(x + dx, t - 1.42, "s", true);
        L.block("stone", x + dx - 0.45, t, 0.4, 0.4);
        L.block("stone", x + dx + 0.45, t, 0.4, 0.4);
      }
      let t = L.frame("wood", x, h, 3.0, 1.6, "stone");
      L.pig(x, h, "l");
      t = L.frame("glass", x, t, 2.2, 1.3, "stone");
      L.pig(x, t - 1.52, "m", true);
    }),

    // 12: stone pyramid with TNT in the middle
    make("12", ["black", "blue", "yellow", "black"], L => {
      const x = 19.5;
      let t1 = L.row("stone", x - 3, 0, 4, 2.0, 1.3);
      L.pig(x - 3, 0, "s"); L.pig(x + 3, 0, "s");
      L.pig(x - 1, 0, "s", true); L.cube("stone", x + 1, 0, 0.6);
      let t2 = L.row("wood", x - 2, t1, 3, 2.0, 1.3);
      L.pig(x - 2, t1, "s", true); L.pig(x + 2, t1, "s", true);
      L.tnt(x, t1);
      let t3 = L.row("glass", x - 1, t2, 2, 2.0, 1.3);
      L.pig(x - 1, t2, "m"); L.pig(x + 1, t2, "m");
      L.frame("stone", x, t3, 2.0, 1.2);
      L.pig(x, t3, "m", true);
    }),

    // 13: pigs under stone roofs (white birds arrive)
    make("13", ["white", "white", "red", "white"], L => {
      for (const x of [16, 20, 24]) {
        L.post("stone", x - 1.0, 0, 1.3);
        L.post("stone", x + 1.0, 0, 1.3);
        L.block("stone", x, 1.3, 2.6, 0.32);
        L.pig(x, 0, x === 20 ? "m" : "s", x === 24);
      }
    }),

    // 14: the fortress, every bird
    make("14", ["red", "blue", "yellow", "black", "white"], L => {
      const h = L.hill(22, 12, 1.4);
      let t = L.row("stone", 18, h, 2, 2.0, 1.4);
      L.pig(18, h, "m"); L.pig(20, h, "s", true);
      t = L.row("glass", 18, t, 2, 2.0, 1.2, "wood");
      L.pig(19, t - 1.42, "s");
      L.tnt(18, t);
      let u = L.frame("wood", 24.5, h, 2.2, 2.0);
      L.pig(24.5, h, "l");
      u = L.frame("wood", 24.5, u, 2.2, 1.6, "stone");
      L.pig(24.5, u - 1.82, "m", true);
      L.pig(24.5, u, "s");
      L.plank("wood", 22.25, h, 1.4);
      L.post("glass", 26.6, h, 1.0);
    }),

    // 15: the king's castle
    make("15", ["big", "black", "yellow", "blue", "white"], L => {
      const x = 23;
      const h = L.hill(x, 12, 1.2);
      // outer towers
      for (const dx of [-4.2, 4.2]) {
        let t = h;
        for (let i = 0; i < 3; i++) t = L.frame(i === 0 ? "stone" : "wood", x + dx, t, 1.6, 1.3);
        L.pig(x + dx, t - 1.52, "s", true);
        L.tri("stone", x + dx, t, 1.4, 0.9);
      }
      // keep
      let t = L.frame("stone", x, h, 4.0, 1.8);
      L.pig(x, h, "king");
      t = L.row("glass", x - 1.0, t, 2, 2.0, 1.4, "wood");
      L.pig(x - 1.0, t - 1.62, "s"); L.pig(x + 1.0, t - 1.62, "m");
      t = L.frame("wood", x, t, 2.4, 1.3, "stone");
      L.pig(x, t - 1.52, "m", true);
      L.tnt(x - 2.5, h); L.tnt(x + 2.5, h);
    }),
  ];

  if (typeof module !== "undefined" && module.exports) module.exports = LEVELS;
  else root.LEVELS = LEVELS;
})(typeof window !== "undefined" ? window : globalThis);
