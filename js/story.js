/* Story scenes shown before world 1, between the worlds and after the last one.
 * Each scene is a few animated panels drawn with the game's own art.
 */
(function () {
  "use strict";
  const { THEMES } = ART;

  // A small stage: metres, +y up, x = 0 in the middle of the screen, ground at y = 0.
  function stage(c, W, H, D, world, t) {
    const z = Math.min(H / 8.5, W / 15);
    const gy = H * 0.74;
    const S = {
      z, gy,
      local(x, y, scale, angle) {
        c.setTransform(D * z * (scale || 1), 0, 0, -D * z * (scale || 1), D * (W / 2 + x * z), D * (gy - y * z));
        if (angle) c.rotate(angle);
      },
      backdrop(propList) {
        c.setTransform(D, 0, 0, D, 0, 0);
        ART.backdrop(c, W, H, t * 0.4, z, gy, t, world);
        if (propList) for (const [kind, x, s] of propList) { S.local(x, 0); ART.drawProp(c, kind, s, ART.rng(Math.round(x * 100) + 7), THEMES[world]); }
        c.setTransform(D, 0, 0, D, 0, 0);
        const pts = [];
        for (let x = -20; x <= W + 20; x += 20) pts.push([x, gy + Math.sin(x * 0.006) * z * 0.15]);
        ART.drawTerrain(c, pts, H, z, world, t * 0.4, t);
      },
      bird(type, x, y, s, o) {
        const r = FF.BIRDS[type].r * (s || 1.6);
        S.local(x, y + r, 1, (o && o.angle) || 0);
        if (o && o.flip) c.scale(-1, 1);
        ART.drawBird(c, type, r, t, o || {});
      },
      pig(x, y, size, o) {
        o = o || {};
        const r = FF.PIGS[size].r * (o.s || 1.4);
        S.local(x, y + r, 1, o.angle || 0);
        ART.drawPig(c, { r, size, helmet: !!o.helmet, hp: 1, maxHp: 1, blink: x }, t);
      },
      egg(x, y, s) { S.local(x, y + 0.35 * (s || 1)); ART.drawEgg(c, 0.35 * (s || 1)); },
      nest(x) {
        S.local(x, 0);
        c.strokeStyle = "#7a5530"; c.lineWidth = 0.08; c.lineCap = "round";
        for (let i = 0; i < 14; i++) {
          const a = i * 0.45;
          c.beginPath(); c.moveTo(-1.3 + Math.sin(a) * 0.1, 0.25 + Math.cos(a * 1.7) * 0.15); c.quadraticCurveTo(0, -0.2 + (i % 3) * 0.1, 1.3, 0.3 + Math.sin(a * 2) * 0.12); c.stroke();
        }
      },
      block(mat, x, y, w, h, angle) {
        S.local(x, y + h / 2, 1, angle || 0);
        ART.drawBlock(c, { mat, shape: "box", w, h, hp: 1, maxHp: 1, seed: Math.round(x * 997 + y * 31) }, 0.01, world, angle || 0);
      },
      dark(a) { c.setTransform(D, 0, 0, D, 0, 0); c.fillStyle = `rgba(5,8,25,${a})`; c.fillRect(0, 0, W, H); },
      lines(x, y, len) {
        S.local(x, y);
        c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 0.06; c.lineCap = "round";
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-0.6, i * 0.3 + 0.5); c.lineTo(-0.6 - len, i * 0.3 + 0.5); c.stroke(); }
      },
    };
    return S;
  }

  const hop = (t, k) => Math.abs(Math.sin(t * 5 + k)) * 0.35;
  const loop = (t, period) => (t % period) / period;

  const SCENES = {
    intro: [
      { world: 0, text: "Meadow Valley. The birds keep watch over their three precious eggs.",
        draw(S, t) {
          S.backdrop([["oak", -6, 1.1], ["bush", 5.5, 1.2], ["oak", 7.5, 0.9]]);
          S.nest(0);
          S.egg(-0.55, 0.15); S.egg(0.55, 0.15); S.egg(0, 0.35);
          S.bird("red", -2.6, hop(t, 0) * 0.3, 1.6, { blink: (t % 3) < 0.15 });
          S.bird("blue", 2.3, hop(t, 1) * 0.3, 1.6, { flip: true });
          S.bird("blue", 3.0, hop(t, 2) * 0.3, 1.5, { flip: true });
        } },
      { world: 0, text: "But one night, the pigs crept in…",
        draw(S, t) {
          S.backdrop([["oak", -6, 1.1], ["bush", 5.5, 1.2]]);
          S.nest(-3);
          const k = Math.min(1, t / 3);
          for (let i = 0; i < 3; i++) {
            const x = -2.4 + k * 9 + i * 1.6;
            S.pig(x, hop(t * 1.4, i) * 0.4, i === 1 ? "m" : "s");
            S.egg(x, 0.8 + hop(t * 1.4, i) * 0.4 + (i === 1 ? 0.3 : 0), 0.8);
          }
          S.dark(0.55);
        } },
      { world: 0, text: "The birds are FURIOUS. Grab the slingshot and get those eggs back!",
        draw(S, t) {
          S.backdrop([["oak", -6, 1.1], ["oak", 6.5, 1.0]]);
          S.nest(4);
          const shake = Math.sin(t * 40) * 0.05;
          S.bird("red", -0.4 + shake, hop(t, 0) * 0.6, 2.4, {});
          S.bird("blue", -2.4, hop(t, 1.3) * 0.6, 1.6, {});
          S.bird("blue", 1.9, hop(t, 2.1) * 0.6, 1.6, { flip: true });
        } },
    ],
    1: [
      { world: 1, text: "The valley is free, but the eggs are gone. Footprints lead into the desert.",
        draw(S, t) {
          S.backdrop([["cactus", -6.5, 1.0], ["rock", 6, 1.2], ["cactus", 7.5, 0.8]]);
          for (let i = 0; i < 9; i++) { S.local(-1 + i * 1.0, 0.05); ART.ellipse(S.c, 0, 0, 0.18, 0.06); S.c.fillStyle = "rgba(120,70,30,0.45)"; S.c.fill(); }
          S.bird("red", -4, hop(t, 0) * 0.2, 1.6, {});
          S.bird("blue", -5.2, hop(t, 1) * 0.2, 1.5, {});
        } },
      { world: 1, text: "In the Scorched Canyon a new friend joins: the yellow bird, faster than the wind.",
        draw(S, t) {
          S.backdrop([["cactus", -6.5, 1.0], ["rock", 6, 1.2]]);
          const x = ((t * 7) % 22) - 11;
          S.lines(x - 0.3, 1.6, 1.8);
          S.bird("yellow", x, 1.2, 1.8, {});
          S.bird("red", -3, hop(t, 0) * 0.2, 1.5, {});
        } },
      { world: 1, text: "The pigs hide behind forts of sun-dried wood. Time for target practice.",
        draw(S, t) {
          S.backdrop([["cactus", -7, 1.0], ["cactus", 7.2, 0.8]]);
          S.block("wood", 1.4, 0, 0.25, 1.8); S.block("wood", 3.6, 0, 0.25, 1.8); S.block("wood", 2.5, 1.8, 2.6, 0.25);
          S.pig(2.5, 0, "m", { helmet: true });
          S.pig(2.5, 2.05, "s");
          S.bird("yellow", -3.2, hop(t, 0) * 0.4, 1.6, {});
          S.bird("red", -4.6, hop(t, 1) * 0.4, 1.6, {});
        } },
    ],
    2: [
      { world: 2, text: "The pigs flee up the mountain, the eggs packed on a sled.",
        draw(S, t) {
          S.backdrop([["pine", -6.5, 1.0], ["pine", 6.8, 0.9]]);
          const x = -6 + loop(t, 4) * 12;
          S.local(x, 0.1);
          S.c.fillStyle = "#7a4a22"; S.c.fillRect(-1.2, 0, 2.4, 0.25);
          S.c.strokeStyle = "#444"; S.c.lineWidth = 0.08; S.c.beginPath(); S.c.moveTo(-1.3, -0.05); S.c.lineTo(1.2, -0.05); S.c.quadraticCurveTo(1.6, 0, 1.5, 0.3); S.c.stroke();
          S.pig(x - 0.5, 0.35, "s"); S.egg(x + 0.5, 0.35, 0.8);
        } },
      { world: 2, text: "Deep in the ice, the black bird has been waiting. It goes BOOM.",
        draw(S, t) {
          S.backdrop([["pine", -6.5, 1.0], ["rock", 5, 1.3]]);
          const flash = (t % 2) > 1.7;
          S.bird("black", 0, hop(t, 0) * 0.3, 2.2, { lit: true, flash });
          S.bird("red", -3, 0, 1.5, {});
        } },
      { world: 2, text: "Ice cracks, stone crumbles. Nothing stands in their way.",
        draw(S, t) {
          S.backdrop([["pine", -7, 1.0], ["pine", 7, 1.1]]);
          S.block("glass", 1.5, 0, 0.3, 1.6); S.block("glass", 3.5, 0, 0.3, 1.6); S.block("stone", 2.5, 1.6, 2.6, 0.35);
          S.pig(2.5, 0, "m");
          S.bird("black", -2.5, hop(t, 0) * 0.4, 1.7, { lit: true });
          S.bird("yellow", -4, hop(t, 1) * 0.4, 1.6, {});
        } },
    ],
    3: [
      { world: 3, text: "At the coast the pigs push off on a raft and sail into the sunset.",
        draw(S, t) {
          S.backdrop([["palm", -6.5, 1.0], ["rock", -3.5, 0.8]]);
          const x = 1 + loop(t, 8) * 5;
          S.local(x, 0.2 + Math.sin(t * 2) * 0.05);
          S.c.fillStyle = "#8a6038";
          for (let i = 0; i < 5; i++) S.c.fillRect(-1.25 + i * 0.5, 0, 0.45, 0.22);
          S.c.strokeStyle = "#5a3a1a"; S.c.lineWidth = 0.08; S.c.beginPath(); S.c.moveTo(0, 0.2); S.c.lineTo(0, 2.4); S.c.stroke();
          S.c.fillStyle = "#efe6d0"; S.c.beginPath(); S.c.moveTo(0.05, 2.3); S.c.lineTo(1.1, 0.8); S.c.lineTo(0.05, 0.7); S.c.fill();
          S.pig(x - 0.6, 0.42, "s"); S.egg(x - 0.1, 0.42, 0.7); S.pig(x + 0.6, 0.42, "s", { helmet: true });
        } },
      { world: 3, text: "The white bird knows these islands, and it drops a very nasty egg.",
        draw(S, t) {
          S.backdrop([["palm", -6, 1.0], ["palm", 6.5, 0.9]]);
          const k = loop(t, 2.5);
          S.bird("white", -1 + k * 2, 2.6, 1.7, {});
          S.egg(-1 + Math.min(k, 0.4) * 2, 2.2 - Math.max(0, k - 0.4) * 4, 0.8);
        } },
      { world: 3, text: "Along the beach, the flock gets ready.",
        draw(S, t) {
          S.backdrop([["palm", -7, 1.0], ["shell", 2, 1], ["palm", 6.8, 1.0]]);
          ["red", "blue", "yellow", "black", "white"].forEach((b, i) => S.bird(b, -4 + i * 2, hop(t, i) * 0.4, 1.5, {}));
        } },
    ],
    4: [
      { world: 4, text: "Beyond the sea rises Mount Cinder, the fortress of the King Pig.",
        draw(S, t) {
          S.backdrop([["deadtree", -6, 1.0], ["rock", 6, 1.2]]);
          S.block("stone", 0.6, 0, 0.4, 2.2); S.block("stone", 3.4, 0, 0.4, 2.2); S.block("stone", 2.0, 2.2, 3.4, 0.4);
          S.pig(2, 2.6, "king", { s: 1.3 });
          S.pig(2, 0, "l", { helmet: true });
        } },
      { world: 4, text: "Then the biggest bird of them all wakes up.",
        draw(S, t) {
          S.backdrop([["deadtree", -6.5, 1.0], ["rock", 5.5, 1.0]]);
          const rise = Math.min(1, t / 2);
          S.bird("big", 0, -1.6 + rise * 1.6 + hop(t, 0) * 0.15 * rise, 1.7, { blink: rise < 0.6 });
        } },
      { world: 4, text: "The final fight. Bring the eggs home!",
        draw(S, t) {
          S.backdrop([["deadtree", -7, 1.0], ["deadtree", 7, 0.9]]);
          ["white", "black", "big", "red", "yellow", "blue"].forEach((b, i) => S.bird(b, -5 + i * 2, hop(t, i) * 0.5, 1.4, { lit: b === "black" }));
        } },
    ],
    ending: [
      { world: 4, text: "The fortress falls. The King Pig runs off with nothing but his crown.",
        draw(S, t) {
          S.backdrop([["deadtree", -6, 1.0], ["rock", 5.5, 1.2]]);
          const x = -1 + loop(t, 4) * 9;
          S.pig(x, hop(t * 1.6, 0) * 0.5, "king", { s: 1.1 });
          S.block("stone", -4, 0, 2.2, 0.4, 0.2); S.block("stone", -2.5, 0, 0.4, 1.2, -0.4);
        } },
      { world: 0, text: "Three eggs, safe and sound, back in the nest.",
        draw(S, t) {
          S.backdrop([["oak", -6, 1.1], ["bush", 5.5, 1.2], ["flowers", 3.5, 1]]);
          S.nest(0);
          S.egg(-0.55, 0.15); S.egg(0.55, 0.15); S.egg(0, 0.35);
          ["red", "blue", "yellow"].forEach((b, i) => S.bird(b, -4.5 + i * 1.3, hop(t, i) * 0.9, 1.4, {}));
          ["black", "white", "big"].forEach((b, i) => S.bird(b, 2.2 + i * 1.5, hop(t, i + 3) * 0.9, 1.4, { flip: true }));
        } },
      { world: 0, text: "The end… for now.",
        draw(S, t) {
          S.backdrop([["bush", 2.5, 2.0], ["oak", -5, 1.1]]);
          const peek = Math.min(1, Math.max(0, (t - 1) / 1.5));
          S.pig(2.5, 0.2 + peek * 0.9, "s", { s: 1.3 });
          S.local(2.5, 0); ART.drawProp(S.c, "bush", 1.6, ART.rng(3), THEMES[0]);
        } },
    ],
  };

  // which scene to show before a world (index) or "ending"
  const BEFORE = { 0: "intro", 1: 1, 2: 2, 3: 3, 4: 4 };

  function draw(scene, panel, c, W, H, D, t) {
    const p = SCENES[scene][panel];
    const S = stage(c, W, H, D, p.world, t);
    S.c = c;
    p.draw(S, t);
    // soft vignette like a comic panel
    c.setTransform(D, 0, 0, D, 0, 0);
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  window.STORY = { SCENES, BEFORE, draw };
})();
