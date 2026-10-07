/* Drawing of birds, pigs, blocks, slingshot and scenery.
 * Every function draws in local metres with +y up; the caller sets up the
 * transform (see main.js: toLocal).
 */
(function () {
  "use strict";
  const TAU = Math.PI * 2;

  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function ellipse(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  /* ---------------- birds ---------------- */

  const BIRD_COLORS = {
    red:    { body: "#d9302b", dark: "#9c1d19", belly: "#f3dcc0" },
    blue:   { body: "#56a8e6", dark: "#2d6fa6", belly: "#e2f0fb" },
    yellow: { body: "#f4c623", dark: "#c18f0e", belly: "#fff1c2" },
    black:  { body: "#2a2a2e", dark: "#111114", belly: "#55555c" },
    white:  { body: "#f5f2e9", dark: "#c7c0ad", belly: "#ffffff" },
    big:    { body: "#b5251f", dark: "#741612", belly: "#e8c9a6" },
  };

  // eyes + brows looking toward +x; s = bird radius
  function face(c, s, opts) {
    const ex = opts.ex || 0.18, ey = opts.ey || 0.18, er = opts.er || 0.22;
    const look = opts.look || 0;
    for (const side of [-1, 1]) {
      const x = ex * s + side * er * s * 0.95;
      c.fillStyle = "#fff";
      ellipse(c, x, ey * s, er * s, er * s * 1.1);
      c.fill();
      c.lineWidth = s * 0.05;
      c.strokeStyle = "rgba(0,0,0,0.35)";
      c.stroke();
      if (opts.closed) {
        c.strokeStyle = "#222"; c.lineWidth = s * 0.07;
        c.beginPath(); c.moveTo(x - er * s * 0.8, ey * s); c.lineTo(x + er * s * 0.8, ey * s); c.stroke();
      } else {
        c.fillStyle = "#151515";
        circle(c, x + er * s * 0.35 + look * s * 0.05, ey * s - er * s * 0.05, er * s * 0.45);
        c.fill();
      }
    }
    // angry brows meeting in the middle
    c.fillStyle = opts.brow || "#1b1b1b";
    const bx = ex * s, by = ey * s + er * s * 0.95;
    c.beginPath();
    c.moveTo(bx - er * s * 2.1, by + s * 0.2);
    c.lineTo(bx - er * s * 0.1, by - s * 0.02);
    c.lineTo(bx + er * s * 0.1, by - s * 0.02);
    c.lineTo(bx + er * s * 2.1, by + s * 0.2);
    c.lineTo(bx + er * s * 2.1, by + s * 0.33);
    c.lineTo(bx, by + s * 0.12);
    c.lineTo(bx - er * s * 2.1, by + s * 0.33);
    c.closePath();
    c.fill();
  }

  function beak(c, s, x, y, size) {
    size = size || 1;
    c.fillStyle = "#f6a21a";
    c.strokeStyle = "#a8640a";
    c.lineWidth = s * 0.04;
    c.beginPath();
    c.moveTo(x, y + s * 0.15 * size);
    c.lineTo(x + s * 0.48 * size, y - s * 0.02);
    c.lineTo(x, y - s * 0.08 * size);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#e08a0c";
    c.beginPath();
    c.moveTo(x, y - s * 0.08 * size);
    c.lineTo(x + s * 0.36 * size, y - s * 0.06);
    c.lineTo(x + s * 0.02, y - s * 0.26 * size);
    c.closePath(); c.fill(); c.stroke();
  }

  function tail(c, s, color) {
    c.fillStyle = color;
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(-s * 0.85, i * s * 0.08);
      c.lineTo(-s * 1.35, i * s * 0.28 + s * 0.05);
      c.lineTo(-s * 1.3, i * s * 0.28 - s * 0.12);
      c.closePath();
      c.fill();
    }
  }

  function drawBird(c, type, s, t, opts) {
    opts = opts || {};
    const col = BIRD_COLORS[type];
    c.lineJoin = "round";
    if (type === "yellow") {
      // a wedge with a crest
      c.fillStyle = "#222";
      c.beginPath(); c.moveTo(-s * 0.9, -s * 0.2); c.lineTo(-s * 1.35, -s * 0.05); c.lineTo(-s * 1.3, -s * 0.4); c.closePath(); c.fill();
      c.fillStyle = col.body;
      c.strokeStyle = col.dark;
      c.lineWidth = s * 0.08;
      c.beginPath();
      c.moveTo(-s * 1.0, -s * 0.75);
      c.lineTo(s * 1.05, -s * 0.75);
      c.quadraticCurveTo(s * 0.4, s * 0.4, -s * 0.15, s * 1.0);
      c.quadraticCurveTo(-s * 0.6, s * 0.2, -s * 1.0, -s * 0.75);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = col.belly;
      c.beginPath(); c.moveTo(-s * 0.7, -s * 0.72); c.lineTo(s * 0.7, -s * 0.72); c.quadraticCurveTo(0, -s * 0.2, -s * 0.7, -s * 0.72); c.fill();
      c.fillStyle = "#222";
      c.beginPath(); c.moveTo(-s * 0.15, s * 0.95); c.lineTo(-s * 0.25, s * 1.35); c.lineTo(s * 0.1, s * 1.1); c.closePath(); c.fill();
      face(c, s, { ex: 0.12, ey: 0.08, er: 0.2, closed: opts.blink });
      beak(c, s, s * 0.32, -s * 0.28, 1.1);
      return;
    }
    if (type === "white") {
      c.fillStyle = col.body; c.strokeStyle = col.dark; c.lineWidth = s * 0.07;
      ellipse(c, 0, 0, s * 0.92, s * 1.08); c.fill(); c.stroke();
      c.fillStyle = "#222";
      c.beginPath(); c.moveTo(-s * 0.05, s * 1.0); c.lineTo(-s * 0.2, s * 1.35); c.lineTo(s * 0.15, s * 1.15); c.closePath(); c.fill();
      tail(c, s * 0.9, "#222");
      face(c, s, { ex: 0.2, ey: 0.28, er: 0.2, closed: opts.blink });
      beak(c, s, s * 0.42, -s * 0.05, 0.9);
      return;
    }
    if (type === "black") {
      // fuse
      c.strokeStyle = "#5a4a2a"; c.lineWidth = s * 0.1;
      c.beginPath(); c.moveTo(0, s * 0.95); c.quadraticCurveTo(s * 0.1, s * 1.25, s * 0.25, s * 1.3); c.stroke();
      if (opts.lit) {
        c.fillStyle = (t * 20 | 0) % 2 ? "#ffd23a" : "#ff6a1a";
        circle(c, s * 0.28, s * 1.32, s * 0.16); c.fill();
      }
    }
    if (type !== "black") tail(c, s, "#1b1b1b");
    // body
    const g = c.createRadialGradient(-s * 0.3, s * 0.35, s * 0.1, 0, 0, s * 1.05);
    g.addColorStop(0, opts.flash ? "#fff" : col.body);
    g.addColorStop(1, opts.flash ? "#ff8040" : col.dark);
    c.fillStyle = g;
    circle(c, 0, 0, s);
    c.fill();
    c.strokeStyle = "rgba(0,0,0,0.45)";
    c.lineWidth = s * 0.06;
    c.stroke();
    // belly
    c.save();
    circle(c, 0, 0, s); c.clip();
    c.fillStyle = col.belly;
    ellipse(c, s * 0.15, -s * 0.85, s * 0.8, s * 0.48); c.fill();
    c.restore();
    // head feathers
    if (type === "red" || type === "big" || type === "blue") {
      c.fillStyle = col.body;
      c.strokeStyle = "rgba(0,0,0,0.4)";
      c.lineWidth = s * 0.04;
      for (const [dx, h] of [[-0.12, 0.45], [0.08, 0.38]]) {
        ellipse(c, dx * s, s * (0.95 + h * 0.35), s * 0.12, s * h * 0.55, -0.3);
        c.fill(); c.stroke();
      }
    }
    face(c, s, { ex: 0.2, ey: 0.2, er: type === "big" ? 0.17 : 0.21, closed: opts.blink,
      brow: type === "black" ? "#000" : "#1b1b1b" });
    beak(c, s, s * 0.45, -s * 0.15, type === "big" ? 0.85 : 1);
  }

  function drawEgg(c, s) {
    c.fillStyle = "#fbf6e8"; c.strokeStyle = "#c9bd9b"; c.lineWidth = s * 0.08;
    ellipse(c, 0, 0, s * 0.85, s * 1.05); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.8)";
    ellipse(c, -s * 0.3, s * 0.35, s * 0.15, s * 0.25, 0.4); c.fill();
  }

  /* ---------------- pigs ---------------- */

  function drawPig(c, e, t) {
    const s = e.r;
    const hurt = 1 - Math.max(0, e.hp) / e.maxHp;
    const king = e.size === "king";
    c.lineJoin = "round";
    // ears
    c.fillStyle = "#6fb83a"; c.strokeStyle = "#3a6e19"; c.lineWidth = s * 0.06;
    for (const side of [-1, 1]) {
      circle(c, side * s * 0.55, s * 0.78, s * 0.22); c.fill(); c.stroke();
    }
    const g = c.createRadialGradient(-s * 0.3, s * 0.35, s * 0.1, 0, 0, s * 1.05);
    g.addColorStop(0, "#9ad85a");
    g.addColorStop(1, "#5ea42e");
    c.fillStyle = g;
    circle(c, 0, 0, s); c.fill();
    c.strokeStyle = "#356616"; c.lineWidth = s * 0.07; c.stroke();
    // bruises
    if (hurt > 0.3) {
      c.fillStyle = "rgba(70,90,30,0.45)";
      circle(c, -s * 0.5, -s * 0.35, s * 0.18); c.fill();
      circle(c, s * 0.55, s * 0.45, s * 0.13); c.fill();
    }
    // eyes
    const blink = ((t + e.blink) % 4) < 0.12;
    for (const side of [-1, 1]) {
      const x = side * s * 0.42, y = s * 0.3;
      c.fillStyle = "#fff";
      circle(c, x, y, s * 0.2); c.fill();
      c.strokeStyle = "#356616"; c.lineWidth = s * 0.04; c.stroke();
      if (blink) {
        c.strokeStyle = "#1b3a08"; c.lineWidth = s * 0.06;
        c.beginPath(); c.moveTo(x - s * 0.15, y); c.lineTo(x + s * 0.15, y); c.stroke();
      } else {
        c.fillStyle = "#111";
        circle(c, x - s * 0.06, y - s * 0.02, s * 0.09); c.fill();
      }
      if (hurt > 0.55 && side === 1) {
        c.fillStyle = "rgba(60,40,90,0.55)";
        ellipse(c, x, y - s * 0.02, s * 0.24, s * 0.22); c.fill();
      }
    }
    // snout
    c.fillStyle = "#a6e36b"; c.strokeStyle = "#4b8a22"; c.lineWidth = s * 0.05;
    ellipse(c, 0, -s * 0.12, s * 0.33, s * 0.24); c.fill(); c.stroke();
    c.fillStyle = "#2f5c12";
    ellipse(c, -s * 0.12, -s * 0.12, s * 0.06, s * 0.1); c.fill();
    ellipse(c, s * 0.12, -s * 0.12, s * 0.06, s * 0.1); c.fill();
    // mouth
    c.strokeStyle = "#2f5c12"; c.lineWidth = s * 0.05;
    c.beginPath(); c.arc(0, -s * 0.38, s * 0.22, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
    if (king) {
      // beard-ish chin and a crown
      c.fillStyle = "#f2c230"; c.strokeStyle = "#a07a10"; c.lineWidth = s * 0.05;
      c.beginPath();
      c.moveTo(-s * 0.55, s * 0.8);
      c.lineTo(-s * 0.6, s * 1.35); c.lineTo(-s * 0.3, s * 1.1); c.lineTo(0, s * 1.45);
      c.lineTo(s * 0.3, s * 1.1); c.lineTo(s * 0.6, s * 1.35); c.lineTo(s * 0.55, s * 0.8);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "#e3342f"; circle(c, 0, s * 1.0, s * 0.09); c.fill();
      c.fillStyle = "#3b8be0"; circle(c, -s * 0.33, s * 0.95, s * 0.07); c.fill(); circle(c, s * 0.33, s * 0.95, s * 0.07); c.fill();
    } else if (e.helmet) {
      const cracked = hurt > 0.45;
      c.fillStyle = "#9ea6ad"; c.strokeStyle = "#5c6369"; c.lineWidth = s * 0.06;
      c.beginPath();
      c.arc(0, s * 0.35, s * 0.9, 0.15, Math.PI - 0.15);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "#c4cbd1";
      ellipse(c, -s * 0.3, s * 0.9, s * 0.25, s * 0.1, 0.4); c.fill();
      c.fillStyle = "#7e868c";
      c.fillRect(-s * 0.95, s * 0.38, s * 1.9, s * 0.14);
      if (cracked) {
        c.strokeStyle = "#3d4247"; c.lineWidth = s * 0.05;
        c.beginPath(); c.moveTo(s * 0.1, s * 1.2); c.lineTo(s * 0.2, s * 0.9); c.lineTo(0, s * 0.75); c.lineTo(s * 0.15, s * 0.5); c.stroke();
      }
    }
  }

  /* ---------------- blocks ---------------- */

  const MAT = {
    wood:  { fill: ["#e0a05a", "#b9712e"], edge: "#6e3f14", line: "rgba(110,60,20,0.45)", crack: "#4a2808" },
    glass: { fill: ["rgba(205,240,255,0.75)", "rgba(140,205,240,0.6)"], edge: "#eafaff", line: "rgba(255,255,255,0.7)", crack: "#ffffff" },
    stone: { fill: ["#b3b8bd", "#80868c"], edge: "#4c5157", line: "rgba(60,64,70,0.35)", crack: "#2c3035" },
    tnt:   { fill: ["#e8452c", "#b02a16"], edge: "#5e1407", line: "rgba(0,0,0,0.3)", crack: "#2a0800" },
  };

  function shapePath(c, e) {
    c.beginPath();
    if (e.shape === "ball") c.arc(0, 0, e.r, 0, TAU);
    else if (e.shape === "tri") { c.moveTo(e.pts[0][0], e.pts[0][1]); c.lineTo(e.pts[1][0], e.pts[1][1]); c.lineTo(e.pts[2][0], e.pts[2][1]); c.closePath(); }
    else c.rect(-e.w / 2, -e.h / 2, e.w, e.h);
  }

  function bounds(e) {
    if (e.shape === "ball") return [e.r * 2, e.r * 2];
    return [e.w, e.h];
  }

  function cracks(e) {
    if (e.cracks) return e.cracks;
    const r = rng(e.seed);
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
        pts.push([Math.max(-w / 2, Math.min(w / 2, x)), Math.max(-h / 2, Math.min(h / 2, y))]);
      }
      list.push(pts);
    }
    return (e.cracks = list);
  }

  function drawBlock(c, e, px) {
    const m = MAT[e.mat];
    const [w, h] = bounds(e);
    const g = c.createLinearGradient(0, h / 2, 0, -h / 2);
    g.addColorStop(0, m.fill[0]);
    g.addColorStop(1, m.fill[1]);
    shapePath(c, e);
    c.fillStyle = g;
    c.fill();
    c.save();
    c.clip();
    // texture
    c.strokeStyle = m.line;
    c.lineWidth = Math.max(px * 1.2, 0.015);
    if (e.mat === "wood") {
      const long = w >= h;
      const n = Math.max(1, Math.round((long ? h : w) / 0.12));
      for (let i = 1; i < n + 1; i++) {
        const k = (i / (n + 1) - 0.5);
        c.beginPath();
        if (long) { c.moveTo(-w / 2, k * h); c.bezierCurveTo(-w / 6, k * h + 0.03, w / 6, k * h - 0.03, w / 2, k * h); }
        else { c.moveTo(k * w, -h / 2); c.bezierCurveTo(k * w + 0.03, -h / 6, k * w - 0.03, h / 6, k * w, h / 2); }
        c.stroke();
      }
    } else if (e.mat === "stone") {
      const r = rng(e.seed + 7);
      c.fillStyle = "rgba(60,64,70,0.25)";
      const n = Math.ceil(w * h * 30);
      for (let i = 0; i < n; i++) { circle(c, (r() - 0.5) * w, (r() - 0.5) * h, 0.02 + r() * 0.04); c.fill(); }
    } else if (e.mat === "glass") {
      c.strokeStyle = "rgba(255,255,255,0.75)";
      c.lineWidth = Math.min(w, h) * 0.12;
      c.beginPath(); c.moveTo(-w / 2, -h * 0.1); c.lineTo(-w * 0.1, h / 2); c.stroke();
      c.lineWidth = Math.min(w, h) * 0.05;
      c.beginPath(); c.moveTo(-w * 0.2, -h / 2); c.lineTo(w * 0.2, h / 2); c.stroke();
    } else if (e.mat === "tnt") {
      c.save();
      c.scale(1, -1);
      c.fillStyle = "#fff2c4";
      c.font = `${h * 0.42}px "Lilita One", Impact, sans-serif`;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("TNT", 0, h * 0.02);
      c.restore();
      c.fillStyle = "rgba(0,0,0,0.25)";
      c.fillRect(-w / 2, h / 2 - h * 0.12, w, h * 0.12);
      c.fillRect(-w / 2, -h / 2, w, h * 0.12);
    }
    // cracks show the damage
    const hurt = 1 - Math.max(0, e.hp) / e.maxHp;
    const show = Math.min(6, Math.floor(hurt * 7));
    if (show) {
      c.strokeStyle = m.crack;
      c.lineWidth = Math.max(px * 1.5, 0.02);
      const list = cracks(e);
      for (let i = 0; i < show; i++) {
        c.beginPath();
        list[i].forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
        c.stroke();
      }
    }
    c.restore();
    shapePath(c, e);
    c.strokeStyle = m.edge;
    c.lineWidth = Math.max(px * 2, 0.03);
    c.stroke();
  }

  /* ---------------- slingshot ---------------- */

  const SL = { back: [0.26, 3.0], front: [-0.24, 2.95] };

  function slingBack(c) {
    c.lineCap = "round";
    c.strokeStyle = "#5b3414";
    c.lineWidth = 0.3;
    c.beginPath(); c.moveTo(0.03, 1.85); c.quadraticCurveTo(0.28, 2.3, SL.back[0], SL.back[1]); c.stroke();
    c.strokeStyle = "#7d4b1f"; c.lineWidth = 0.18;
    c.beginPath(); c.moveTo(0.03, 1.85); c.quadraticCurveTo(0.28, 2.3, SL.back[0], SL.back[1]); c.stroke();
    // trunk
    c.strokeStyle = "#5b3414"; c.lineWidth = 0.42;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 1.95); c.stroke();
    c.strokeStyle = "#8c5826"; c.lineWidth = 0.24;
    c.beginPath(); c.moveTo(-0.04, 0); c.lineTo(-0.04, 1.9); c.stroke();
  }

  function band(c, from, to) {
    c.lineCap = "round";
    c.strokeStyle = "#3b200c";
    c.lineWidth = 0.17;
    c.beginPath(); c.moveTo(from[0], from[1]); c.lineTo(to.x, to.y); c.stroke();
  }

  function pouch(c, p, ang) {
    c.save();
    c.translate(p.x, p.y);
    c.rotate(ang);
    c.fillStyle = "#4a2a10";
    c.beginPath();
    c.ellipse(-0.1, 0, 0.18, 0.36, 0, 0, TAU);
    c.fill();
    c.restore();
  }

  function slingFront(c) {
    c.lineCap = "round";
    c.strokeStyle = "#5b3414"; c.lineWidth = 0.32;
    c.beginPath(); c.moveTo(0, 1.85); c.quadraticCurveTo(-0.3, 2.25, SL.front[0], SL.front[1]); c.stroke();
    c.strokeStyle = "#9a6430"; c.lineWidth = 0.16;
    c.beginPath(); c.moveTo(-0.02, 1.85); c.quadraticCurveTo(-0.32, 2.25, SL.front[0] - 0.02, SL.front[1]); c.stroke();
    // binding
    c.strokeStyle = "#3b200c"; c.lineWidth = 0.1;
    c.beginPath(); c.moveTo(-0.24, 2.75); c.lineTo(-0.22, 2.9); c.stroke();
    c.beginPath(); c.moveTo(0.2, 2.8); c.lineTo(0.26, 2.95); c.stroke();
  }

  /* ---------------- scenery ---------------- */

  function cloud(c, x, y, s) {
    c.beginPath();
    c.arc(x, y, 26 * s, Math.PI * 0.5, Math.PI * 1.5);
    c.arc(x + 30 * s, y - 22 * s, 30 * s, Math.PI, Math.PI * 1.9);
    c.arc(x + 70 * s, y - 14 * s, 26 * s, Math.PI * 1.2, Math.PI * 1.95);
    c.arc(x + 92 * s, y, 22 * s, Math.PI * 1.5, Math.PI * 0.5);
    c.closePath();
    c.fill();
  }

  // background in screen space; camX in metres, z = px per metre, gy = screen y of ground
  function sky(c, W, H, camX, z, gy, t) {
    const g = c.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, "#5fb8ec");
    g.addColorStop(0.7, "#bfe6f7");
    g.addColorStop(1, "#e9f6e4");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // sun
    c.fillStyle = "rgba(255,248,210,0.5)";
    circle(c, W * 0.82, gy * 0.22, Math.min(W, H) * 0.09); c.fill();
    c.fillStyle = "#fff6cf";
    circle(c, W * 0.82, gy * 0.22, Math.min(W, H) * 0.06); c.fill();
    // clouds drift slowly
    c.fillStyle = "rgba(255,255,255,0.9)";
    const span = W + 400;
    for (let i = 0; i < 6; i++) {
      const sx = ((i * 380 - camX * z * 0.1 + t * (6 + i * 2)) % span + span) % span - 200;
      cloud(c, sx, gy * (0.15 + (i % 3) * 0.13), (0.7 + (i % 2) * 0.5) * Math.max(0.6, H / 720));
    }
    // far hills
    hills(c, W, gy, camX * z * 0.25, gy * 0.32, "#a8d98c", 0.0031, 1.7);
    hills(c, W, gy, camX * z * 0.5, gy * 0.18, "#7fc463", 0.0057, 0.6);
  }

  function hills(c, W, gy, off, amp, color, f, ph) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, gy);
    for (let x = 0; x <= W + 20; x += 20) {
      const u = x + off;
      const y = gy - amp * (0.55 + 0.3 * Math.sin(u * f + ph) + 0.15 * Math.sin(u * f * 2.7 + ph * 2));
      c.lineTo(x, y);
    }
    c.lineTo(W, gy);
    c.closePath();
    c.fill();
  }

  function ground(c, W, H, gy, z, camX) {
    const g = c.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, "#8a5a2b");
    g.addColorStop(1, "#5b3818");
    c.fillStyle = g;
    c.fillRect(0, gy, W, H - gy);
    // pebbles
    c.fillStyle = "rgba(40,22,8,0.25)";
    const off = camX * z;
    for (let i = 0; i < 40; i++) {
      const x = ((i * 137 - off) % (W + 50) + W + 50) % (W + 50) - 25;
      const y = gy + 0.35 * z + ((i * 53) % 100) / 100 * Math.max(10, H - gy - 0.5 * z);
      c.beginPath(); c.ellipse(x, y, 0.12 * z, 0.07 * z, 0, 0, TAU); c.fill();
    }
    grassStrip(c, 0, W, gy, z, off);
  }

  function grassStrip(c, x0, x1, gy, z, off) {
    c.fillStyle = "#5dae2f";
    c.fillRect(x0, gy - 0.05 * z, x1 - x0, 0.32 * z);
    c.fillStyle = "#7ccb44";
    c.beginPath();
    c.moveTo(x0, gy + 0.1 * z);
    const step = Math.max(6, 0.3 * z);
    for (let x = x0; x <= x1 + step; x += step) {
      const k = Math.floor((x + off) / step);
      c.lineTo(x, gy - (0.12 + (k % 3) * 0.06) * z);
      c.lineTo(x + step / 2, gy - 0.02 * z);
    }
    c.lineTo(x1, gy + 0.1 * z);
    c.closePath();
    c.fill();
  }

  window.ART = { drawBird, drawEgg, drawPig, drawBlock, slingBack, slingFront, band, pouch, SL, sky, ground, grassStrip, circle, BIRD_COLORS, MAT };
})();
