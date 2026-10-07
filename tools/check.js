// Headless level check: `node tools/check.js [level numbers...]`
// 1. stability: an untouched level must stay still and nothing may break.
// 2. playability: a greedy bot tries a grid of shots per bird and must win.
const path = require("path");
const FF = require(path.join(__dirname, "../js/core.js"));
const LEVELS = require(path.join(__dirname, "../js/levels.js"));

function play(level, shots) {
  const g = new FF.Game(level);
  for (const s of shots) {
    if (g.state !== "ready") break;
    const a = s.angle * Math.PI / 180;
    g.launch(-Math.cos(a) * s.power * FF.MAX_PULL, -Math.sin(a) * s.power * FF.MAX_PULL);
    const t0 = g.time;
    let n = 0;
    while (g.state === "flying" && n++ < 2000) {
      if (s.tap != null && g.time - t0 >= s.tap) { g.ability(); s.tapDone = true; }
      g.step();
    }
    while (g.state === "bonus" && n++ < 4000) g.step();
  }
  return g;
}

function stability(level) {
  const g = new FF.Game(level);
  const start = g.ents.filter(e => e.body && e.kind !== "ground").map(e => [e, e.body.getPosition().clone()]);
  const hp0 = g.score;
  for (let i = 0; i < 300; i++) g.step();
  let moved = 0;
  for (const [e, p] of start) {
    if (e.dead) return "something broke/died at rest";
    const q = e.body.getPosition();
    moved = Math.max(moved, Math.hypot(q.x - p.x, q.y - p.y));
  }
  if (g.score !== hp0) return "took damage at rest (score " + g.score + ")";
  if (moved > 0.05) return "moved " + moved.toFixed(2) + " m at rest";
  return null;
}

function solve(level) {
  const shots = [];
  const angles = [];
  for (let a = -6; a <= 72; a += 3) angles.push(a);
  for (let turn = 0; turn < level.birds.length; turn++) {
    const type = level.birds[turn];
    const taps = { blue: [0.5, 0.8, 1.1], yellow: [0.35, 0.6, 0.9], white: [0.6, 0.9, 1.2, 1.5] }[type] || [null];
    let best = null;
    for (const angle of angles) for (const power of [0.7, 0.85, 1.0]) for (const tap of taps) {
      const g = play(level, shots.concat([{ angle, power, tap }]));
      const val = (g.state === "won" || g.state === "bonus" ? 1e7 : 0) - g.pigCount * 1e5 + g.score;
      if (!best || val > best.val) best = { val, angle, power, tap, g };
    }
    shots.push({ angle: best.angle, power: best.power, tap: best.tap });
    if (best.g.state === "won") return { won: true, score: best.g.score, shots };
  }
  const g = play(level, shots);
  return { won: false, pigs: g.pigCount, score: g.score, shots };
}

const pick = process.argv.slice(2).map(Number);
LEVELS.forEach((lv, i) => {
  if (pick.length && !pick.includes(i + 1)) return;
  const t = Date.now();
  const st = stability(lv);
  const res = process.env.NOSOLVE ? null : solve(lv);
  const g = new FF.Game(lv);
  console.log(`level ${lv.name}: ${st ? "UNSTABLE: " + st : "stable"}` +
    (res ? ` | ${res.won ? "WON" : "LOST (" + res.pigs + " pigs left)"} score ${res.score} with ${res.shots.length} birds` : "") +
    ` | stars ${g.stars()} | ${((Date.now() - t) / 1000).toFixed(0)}s` +
    (res ? " | " + res.shots.map(s => `${s.angle}°/${s.power}${s.tap != null ? "/t" + s.tap : ""}`).join(" ") : ""));
});
