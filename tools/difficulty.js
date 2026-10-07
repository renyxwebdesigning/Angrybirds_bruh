// How forgiving is the first shot? Prints the share of a shot grid that kills
// k pigs with the first bird. `node tools/difficulty.js [levels...]`
const path = require("path");
const FF = require(path.join(__dirname, "../js/core.js"));
const LEVELS = require(path.join(__dirname, "../js/levels.js"));
const pick = process.argv.slice(2).map(Number);
LEVELS.forEach((lv, i) => {
  if (pick.length && !pick.includes(i + 1)) return;
  let n = 0, wins = 0, kills = 0;
  const total = new FF.Game(lv).pigCount;
  for (let a = -6; a <= 72; a += 3) for (const p of [0.7, 0.85, 1]) {
    const g = new FF.Game(lv);
    const r = a * Math.PI / 180;
    g.launch(-Math.cos(r) * p * 2, -Math.sin(r) * p * 2);
    const tap = { blue: 0.7, yellow: 0.5, white: 1.0 }[lv.birds[0]];
    let k = 0;
    while (g.state === "flying" && k++ < 2000) { if (tap && g.time - g.launchTime >= tap) g.ability(); g.step(); }
    n++; kills += total - g.pigCount; if (g.pigCount === 0) wins++;
  }
  console.log(`level ${lv.name}: one-shot wins ${(100 * wins / n).toFixed(0)}%, avg pigs killed ${(kills / n).toFixed(1)}/${total}`);
});
