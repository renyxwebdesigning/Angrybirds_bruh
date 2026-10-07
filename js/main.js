/* Feather Fury: screens, progress, shop, camera, input, rendering and effects. */
(function () {
  "use strict";
  const { Game, BIRDS, MAX_PULL, DT, TIERS } = FF;
  const { WORLDS, PER_WORLD } = WORLDGEN;
  const cv = document.getElementById("c");
  const ctx = cv.getContext("2d");
  const $ = (id) => document.getElementById(id);

  let W = 0, H = 0, D = 1;
  let screen = "title";
  let game = null, worldIdx = 0, levelIdx = 0;
  let paused = false;
  const cam = { x: -6, y: -2, z: 30, fitX: -6 };
  let particles = [], popups = [], ambient = [], props = [];
  let shake = 0, realT = 0;
  let drag = null, hopStart = 0, snap = null, resultTimer = null, hintShown = false;
  let story = null;          // { scene, panel, t, then }

  /* ---------- progress ---------- */

  const KEY = "ff2_progress";
  let P = { stars: {}, best: {}, coins: 0, upg: { sling: 0, scope: 0, birds: {} }, seen: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) P = Object.assign(P, saved, { upg: Object.assign(P.upg, saved.upg || {}) });
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} }
  const lkey = (w, l) => w + "-" + l;
  const starsOf = (w, l) => P.stars[lkey(w, l)] || 0;
  const worldOpen = (w) => w === 0 || starsOf(w - 1, PER_WORLD - 1) > 0;
  const levelOpen = (w, l) => worldOpen(w) && (l === 0 || starsOf(w, l - 1) > 0);
  function worldStars(w) { let s = 0; for (let l = 0; l < PER_WORLD; l++) s += starsOf(w, l); return s; }

  // where each bird joins the flock: [world, level]
  const BIRD_JOIN = { red: [0, 0], blue: [0, 8], yellow: [1, 0], black: [2, 0], white: [3, 0], big: [4, 0] };
  const birdMet = (b) => levelOpen(BIRD_JOIN[b][0], BIRD_JOIN[b][1]);

  function updateCoins() {
    document.querySelectorAll(".coin-count").forEach(el => el.textContent = P.coins.toLocaleString("en-US"));
  }

  /* ---------- layout ---------- */

  function resize() {
    D = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * D); cv.height = Math.round(H * D);
    if (game) fitCamera(true);
  }
  window.addEventListener("resize", resize);

  function fitCamera(jump) {
    const x0 = Math.min(-4.8, birdSpot(game.level.birds.length - 2, game.level.birds.slice(1)).x - 1.2);
    const x1 = Math.max(game.maxX + 1.4, 21);
    let top = game.pouch.y + 1, low = Infinity;
    for (const e of game.ents) {
      if (e.dead || !e.body || e.kind === "bird") continue;
      const p = e.body.getPosition();
      top = Math.max(top, p.y + (e.r || (e.h || 0) / 2));
    }
    for (let x = x0; x <= x1; x += 0.5) low = Math.min(low, game.groundY(x));
    const bottom = low - 1.6;
    const needH = Math.max(10, top + 3.2 - bottom);
    const z = Math.min(W / (x1 - x0), H / needH);
    const spare = W / z - (x1 - x0);
    cam.z = z;
    cam.y = bottom;
    cam.fitX = x0 - Math.max(0, spare) * 0.35;
    if (jump) cam.x = cam.fitX;
  }

  const sx = (x) => (x - cam.x) * cam.z;
  const sy = (y) => H - (y - cam.y) * cam.z;
  function toWorld(px, py) { return { x: cam.x + px / cam.z, y: cam.y + (H - py) / cam.z }; }

  function local(x, y, angle, scale) {
    const k = D * cam.z * (scale || 1);
    const ox = shake ? (Math.random() - 0.5) * shake : 0, oy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(k, 0, 0, -k, D * (sx(x) + ox), D * (sy(y) + oy));
    if (angle) ctx.rotate(angle);
  }
  function screenSpace() { ctx.setTransform(D, 0, 0, D, 0, 0); }

  /* ---------- screens ---------- */

  const SCREENS = ["title", "worlds", "levels", "shop", "story", "pause", "result"];
  function show(id) { for (const s of SCREENS) $(s).classList.toggle("on", s === id); }

  function menuMode(name) {
    screen = name; paused = false;
    $("hud").classList.remove("on");
    document.body.classList.remove("playing");
    show(name);
    updateCoins();
  }

  function goTitle() { menuMode("title"); backdropGame(0); }

  function goWorlds() {
    if (!P.seen.intro) { playStory("intro", goWorlds); return; }
    menuMode("worlds");
    buildWorlds();
    backdropGame(highestWorld());
  }

  function goLevels(w) {
    worldIdx = w;
    const scene = STORY.BEFORE[w];
    if (w > 0 && !P.seen[scene]) { playStory(scene, () => goLevels(w)); return; }
    menuMode("levels");
    buildGrid();
    backdropGame(w);
  }

  let shopReturn = null;
  function goShop(back) {
    shopReturn = back;
    menuMode("shop");
    buildShop();
  }

  function highestWorld() { let h = 0; for (let w = 0; w < WORLDS.length; w++) if (worldOpen(w)) h = w; return h; }

  function backdropGame(w) {
    game = new Game(WORLDGEN.level(w, 4), () => {}, P.upg);
    worldIdx = w;
    particles = []; popups = [];
    makeProps();
    fitCamera(true);
  }

  const STAR = (lit) => `<svg viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7L12 17.8 5.8 21.1 7 14.1 1.9 9.2l7-1z" fill="${lit ? "#ffd23a" : "#5a4632"}" stroke="#2b1606" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  const LOCK = `<svg viewBox="0 0 24 24" width="40%" height="40%"><rect x="5" y="10" width="14" height="11" rx="2" fill="#2b1606"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#2b1606" stroke-width="3"/></svg>`;

  function buildWorlds() {
    const list = $("world-list");
    list.innerHTML = "";
    WORLDS.forEach((wd, w) => {
      const b = document.createElement("button");
      b.className = "world";
      const open = worldOpen(w);
      b.disabled = !open;
      const c = document.createElement("canvas");
      c.width = 320; c.height = 240;
      paintThumb(c, w);
      b.appendChild(c);
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<span class="name outline">${w + 1}. ${wd.name}</span><span class="sub">${open ? wd.sub : "Beat level " + w + "-20 to unlock"}</span><span class="count">★ ${worldStars(w)} / ${PER_WORLD * 3}</span>`;
      b.appendChild(meta);
      b.setAttribute("aria-label", `World ${w + 1}, ${wd.name}${open ? "" : ", locked"}`);
      if (open) b.onclick = () => { SFX.click(); goLevels(w); };
      list.appendChild(b);
    });
  }

  function paintThumb(c, w) {
    const k = c.getContext("2d");
    const tw = c.width, th = c.height, z = th / 9, gy = th * 0.72;
    ART.backdrop(k, tw, th, 0, z, gy, 3, w);
    const ground = (x) => gy + Math.sin(x * 0.03 + w) * 6;
    const pts = [];
    for (let x = -10; x <= tw + 10; x += 10) pts.push([x, ground(x)]);
    ART.drawTerrain(k, pts, th, z, w, 0, 3);
    const put = (x, y) => k.setTransform(z, 0, 0, -z, x, y);
    put(tw * 0.15, ground(tw * 0.15)); ART.drawProp(k, ART.THEMES[w].props[0], 0.9, ART.rng(w + 1), ART.THEMES[w]);
    put(tw * 0.68, ground(tw * 0.68) - 0.62 * z);
    ART.drawPig(k, { r: w === 4 ? 0.78 : 0.58, size: w === 4 ? "king" : "l", helmet: w > 1, hp: 1, maxHp: 1, blink: 1 }, 1);
    const bird = WORLDS[w].roster[WORLDS[w].roster.length - 1];
    put(tw * 0.38, ground(tw * 0.38) - 0.55 * z);
    ART.drawBird(k, bird, 0.55, 1, { tier: 0 });
    k.setTransform(1, 0, 0, 1, 0, 0);
  }

  function buildGrid() {
    const w = worldIdx;
    $("levels-title").textContent = `${w + 1}. ${WORLDS[w].name}`;
    const grid = $("grid");
    grid.innerHTML = "";
    for (let l = 0; l < PER_WORLD; l++) {
      const st = starsOf(w, l);
      const b = document.createElement("button");
      b.className = "tile" + (l === PER_WORLD - 1 ? " boss" : "");
      if (levelOpen(w, l)) {
        b.innerHTML = `<span>${l + 1}</span><span class="stars">${STAR(st > 0) + STAR(st > 1) + STAR(st > 2)}</span>`;
        b.setAttribute("aria-label", `Level ${w + 1}-${l + 1}${l === PER_WORLD - 1 ? ", boss" : ""}, ${st} of 3 stars`);
        b.onclick = () => { SFX.click(); startLevel(w, l); };
      } else {
        b.disabled = true;
        b.innerHTML = LOCK;
        b.setAttribute("aria-label", `Level ${w + 1}-${l + 1}, locked`);
      }
      grid.appendChild(b);
    }
    $("total-stars").textContent = `★ ${worldStars(w)} / ${PER_WORLD * 3}`;
  }

  /* ---------- shop ---------- */

  const BIRD_COST = [80, 200, 400, 700, 1100];
  const SLING_COST = [120, 300, 600, 1000, 1500];
  const SCOPE_COST = [100, 250, 500, 800, 1200];
  const BIRD_NAMES = { red: "Red", blue: "The Blues", yellow: "Dash", black: "Boomer", white: "Matron", big: "Big Brother" };
  const TIER_TEXT = [
    "Grows bigger: hits harder and wider.",
    "Leather helmet: +20% damage.",
    "Iron chest plate: heavier, smashes deeper.",
    "Spiked steel helmet: even bigger, +45% damage.",
  ];
  const GOLD_TEXT = {
    red: "Golden armour and a battle cry: tap in flight to shove everything ahead.",
    blue: "Golden armour: splits into five instead of three.",
    yellow: "Golden armour: a far stronger dash.",
    black: "Golden armour: a bigger, stronger blast.",
    white: "Golden armour: drops two eggs.",
    big: "Golden armour and a huge battle cry: tap in flight.",
  };
  const SLING_NAMES = ["Wooden", "Rope-wrapped", "Iron-banded", "Steel", "Bronze", "Golden"];

  function pips(n) { let s = '<div class="pips">'; for (let i = 0; i < 5; i++) s += `<i class="${i < n ? "on" : ""}"></i>`; return s + "</div>"; }

  function shopItem(parent, opts) {
    const el = document.createElement("div");
    el.className = "item";
    const c = document.createElement("canvas");
    c.width = c.height = 184;
    opts.paint(c.getContext("2d"), 184);
    el.appendChild(c);
    const body = document.createElement("div");
    const maxed = opts.tier >= 5;
    body.innerHTML = `<div class="iname outline">${opts.name}</div>${pips(opts.tier)}` +
      (opts.locked ? `<div class="locked">${opts.locked}</div>` : `<p class="desc">${maxed ? "Fully upgraded." : opts.next}</p>`);
    if (!opts.locked && !maxed) {
      const btn = document.createElement("button");
      btn.className = "btn small";
      btn.innerHTML = `<svg class="coin"><use href="#coin"/></svg>${opts.cost.toLocaleString("en-US")}`;
      btn.disabled = P.coins < opts.cost;
      btn.setAttribute("aria-label", `Buy for ${opts.cost} coins`);
      btn.onclick = () => {
        if (P.coins < opts.cost) return;
        P.coins -= opts.cost;
        opts.buy();
        save();
        SFX.buy();
        buildShop();
        updateCoins();
      };
      body.appendChild(btn);
    }
    el.appendChild(body);
    parent.appendChild(el);
  }

  function buildShop() {
    const sl = $("shop-sling"), bl = $("shop-birds");
    sl.innerHTML = ""; bl.innerHTML = "";
    const u = P.upg;
    const nextS = Math.min(5, u.sling + 1), nextC = Math.min(5, u.scope + 1);
    shopItem(sl, {
      name: `${SLING_NAMES[u.sling]} slingshot`, tier: u.sling, cost: SLING_COST[Math.min(4, u.sling)],
      next: `${SLING_NAMES[nextS]}: launch power +${Math.round((TIERS.sling[nextS] - 1) * 100)}% (now +${Math.round((TIERS.sling[u.sling] - 1) * 100)}%).`,
      buy: () => { u.sling++; },
      paint: (k, s) => paintSling(k, s, u.sling),
    });
    shopItem(sl, {
      name: "Aiming sight", tier: u.scope, cost: SCOPE_COST[Math.min(4, u.scope)],
      next: `A longer aiming line: ${TIERS.scope[nextC]} dots instead of ${TIERS.scope[u.scope]}.`,
      buy: () => { u.scope++; },
      paint: (k, s) => paintScope(k, s, u.scope),
    });
    for (const b of Object.keys(BIRDS)) {
      const t = u.birds[b] || 0;
      const met = birdMet(b);
      shopItem(bl, {
        name: BIRD_NAMES[b], tier: t, cost: BIRD_COST[Math.min(4, t)],
        next: t < 4 ? TIER_TEXT[t] : GOLD_TEXT[b],
        locked: met ? null : `Joins in world ${BIRD_JOIN[b][0] + 1}${BIRD_JOIN[b][1] ? ", level " + (BIRD_JOIN[b][1] + 1) : ""}.`,
        buy: () => { u.birds[b] = t + 1; },
        paint: (k, s) => {
          const r = BIRDS[b].r * TIERS.size[t];
          const kk = s * 0.3 / 0.6;
          k.setTransform(kk, 0, 0, -kk, s * 0.5, s * 0.52);
          if (!met) k.filter = "brightness(0)";
          ART.drawBird(k, b, Math.min(r, 0.62), realT, { tier: t });
          k.filter = "none";
        },
      });
    }
  }

  function paintSling(k, s, tier) {
    const z = s / 3.8;
    k.setTransform(z, 0, 0, -z, s * 0.5, s * 0.95);
    ART.slingBack(k, tier);
    const p = { x: -0.05, y: 2.75 };
    ART.band(k, ART.SL.back, p, tier);
    ART.pouch(k, p, 0);
    ART.band(k, ART.SL.front, p, tier);
    ART.slingFront(k, tier);
  }

  function paintScope(k, s, tier) {
    k.setTransform(1, 0, 0, 1, 0, 0);
    const n = TIERS.scope[tier];
    k.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < n; i++) {
      const u = i / 34;
      if (u > 1) break;
      const x = s * 0.12 + u * s * 0.85, y = s * 0.8 - Math.sin(u * Math.PI) * s * 0.6;
      k.beginPath(); k.arc(x, y, s * 0.02, 0, Math.PI * 2); k.fill();
    }
  }

  /* ---------- story ---------- */

  function playStory(scene, then) {
    story = { scene, panel: 0, t: 0, then };
    screen = "story";
    $("hud").classList.remove("on");
    document.body.classList.remove("playing");
    show("story");
    showPanel();
  }

  function showPanel() {
    const sc = STORY.SCENES[story.scene];
    $("story-text").textContent = sc[story.panel].text;
    $("story-dots").innerHTML = sc.map((_, i) => `<i class="${i === story.panel ? "on" : ""}"></i>`).join("");
    $("story-next").textContent = story.panel === sc.length - 1 ? "Let's go!" : "Next";
    story.t = 0;
  }

  function storyNext(skip) {
    if (!story) return;
    const sc = STORY.SCENES[story.scene];
    if (!skip && story.panel < sc.length - 1) { story.panel++; showPanel(); return; }
    P.seen[story.scene] = true;
    save();
    const then = story.then;
    story = null;
    then();
  }

  /* ---------- level ---------- */

  function startLevel(w, l) {
    bank();
    worldIdx = w; levelIdx = l;
    screen = "play"; paused = false;
    clearTimeout(resultTimer);
    show(null);
    $("hud").classList.add("on");
    document.body.classList.add("playing");
    particles = []; popups = []; drag = null; snap = null; shake = 0;
    game = new Game(WORLDGEN.level(w, l), onEvent, P.upg);
    game.real = true;
    makeProps();
    hopStart = realT;
    fitCamera(true);
    $("levelname").textContent = `${WORLDS[w].name} ${w + 1}-${l + 1}`;
    const best = P.best[lkey(w, l)];
    $("best").textContent = best ? `Best ${best.toLocaleString("en-US")}` : "";
    $("level-coins").textContent = "+0";
    lastScore = -1; lastCoins = -1;
    setHint(introHint(w, l));
  }

  // move the coins of the current level into the purse (also when quitting)
  function bank() {
    if (!game || game.banked || !game.real) return;
    game.banked = true;
    if (game.coins) { P.coins += game.coins; save(); }
  }

  function introHint(w, l) {
    if (w === 0 && l === 0) return "Drag the bird back and let go";
    const nb = WORLDS[w].newBird[l];
    const hints = {
      blue: "Tap while the blue bird flies: it splits in three. Great on glass",
      yellow: "Tap while the yellow bird flies: it dashes forward. Great on wood",
      black: "The black bird explodes. Tap, or wait after it hits",
      white: "Tap above the pigs: the white bird drops an egg bomb",
      big: "Big Brother is heavy. Just aim, and watch the walls fall",
    };
    if (nb && hints[nb]) return hints[nb];
    if (l === PER_WORLD - 1) return "Boss level!";
    if (w === 0 && l === 2) return "Pop pigs for coins, then visit the shop";
    return "";
  }

  function setHint(t) {
    $("hint").textContent = t;
    $("hint").style.opacity = t ? 1 : 0;
    hintShown = !!t;
  }

  function pause(on) {
    if (screen !== "play" || game.state === "won" || game.state === "lost") return;
    paused = on;
    show(on ? "pause" : null);
    drag = null;
  }

  function showResult(won) {
    const w = worldIdx, l = levelIdx, key = lkey(w, l);
    const firstClear = won && !starsOf(w, l);
    const card = $("result-card");
    card.classList.toggle("fail", !won);
    $("result-title").textContent = won ? (l === PER_WORLD - 1 ? "Boss defeated!" : "Level cleared!") : "Level failed";
    const starsEl = $("result-stars");
    starsEl.innerHTML = "";
    $("result-best").textContent = "";
    const btns = $("result-buttons");
    btns.innerHTML = "";
    const mk = (label, cls, fn) => {
      const b = document.createElement("button");
      b.className = "btn " + cls; b.textContent = label;
      b.onclick = () => { SFX.click(); fn(); };
      btns.appendChild(b);
      return b;
    };
    let bonus = 0;
    if (won) {
      const [s2, s3] = game.stars();
      const n = game.score >= s3 ? 3 : game.score >= s2 ? 2 : 1;
      for (let i = 0; i < 3; i++) {
        const wrap = document.createElement("span");
        wrap.innerHTML = STAR(i < n);
        const svg = wrap.firstChild;
        if (i < n) { svg.classList.add("lit"); svg.style.animationDelay = (0.35 + i * 0.35) + "s"; setTimeout(() => SFX.star(i), 350 + i * 350); }
        starsEl.appendChild(svg);
      }
      // new stars pay a little extra
      bonus = Math.max(0, n - starsOf(w, l)) * 10 + (firstClear ? 20 : 0);
      if (game.score > (P.best[key] || 0)) {
        if (P.best[key]) $("result-best").textContent = "New highscore!";
        P.best[key] = game.score;
      }
      P.stars[key] = Math.max(starsOf(w, l), n);
      SFX.win();
    } else {
      $("result-best").textContent = "The pigs are laughing at you.";
      SFX.lose();
    }
    const earned = game.coins + bonus;
    bank();
    P.coins += bonus;
    save();
    $("result-coins").innerHTML = `<svg class="coin"><use href="#coin"/></svg>+${earned}`;
    $("result-score").textContent = game.score.toLocaleString("en-US");

    mk("Levels", "wood", () => goLevels(w));
    mk("Shop", "wood", () => goShop(showResultAgain));
    if (won) {
      const last = l === PER_WORLD - 1;
      if (last && w === WORLDS.length - 1) mk("The end", "", () => playStory("ending", goWorlds)).focus();
      else if (last) mk("Next world", "", () => goLevels(w + 1)).focus();
      else mk("Next", "", () => startLevel(w, l + 1)).focus();
      mk("Retry", "wood", () => startLevel(w, l));
    } else {
      mk("Retry", "", () => startLevel(w, l)).focus();
    }
    show("result");
  }

  // back from the shop to the result card of the level just played
  function showResultAgain() {
    screen = "play";
    $("hud").classList.add("on");
    document.body.classList.add("playing");
    show("result");
    updateCoins();
  }

  /* ---------- game events → effects ---------- */

  const MAT_BITS = {
    wood: ["#d79650", "#a8652a", "#e9b77a"],
    glass: ["#d9f3ff", "#a9dcf5", "#ffffff"],
    stone: ["#a3a9ae", "#7a8086", "#c4c9cd"],
    tnt: ["#e8452c", "#ffcf5a", "#5e1407"],
  };

  function burst(x, y, n, kind, colors, speed, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + speed * 0.4,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
        life: 0, max: 0.8 + Math.random() * 0.8, kind,
        color: colors[(Math.random() * colors.length) | 0],
        size: size * (0.5 + Math.random()),
      });
    }
  }

  function puff(x, y, n, size, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x: x + Math.cos(a) * size * 0.4, y: y + Math.sin(a) * size * 0.4,
        vx: Math.cos(a) * 0.8, vy: Math.sin(a) * 0.8 + 0.4,
        life: 0, max: 0.6 + Math.random() * 0.5, kind: "smoke",
        color: color || "#ffffff", size: size * (0.4 + Math.random() * 0.4),
      });
    }
  }

  function popup(x, y, text, color, big) { popups.push({ x, y, text, color, life: 0, big }); }

  function onEvent(type, d) {
    switch (type) {
      case "launch":
        SFX.launch(d.power); SFX.birdcall(d.type);
        if (hintShown && worldIdx === 0 && levelIdx === 0) setHint("");
        break;
      case "ability":
        SFX.ability(d.type);
        burst(d.x, d.y, 8, "feather", [ART.BIRD_COLORS[d.type].body, "#fff"], 3, 0.18);
        if (d.cry) { SFX.cry(); shake = 8; }
        if (d.type === "white") puff(d.x, d.y, 5, 0.5);
        if (hintShown) setHint("");
        break;
      case "birdhit":
        if (d.j > 2) burst(d.x, d.y, 6, "feather", [ART.BIRD_COLORS[d.type].body, ART.BIRD_COLORS[d.type].dark], 2.5, 0.16);
        if (d.tier >= 3 && d.j > 4) { SFX.clank(); burst(d.x, d.y, 4, "spark", ["#fff6c0", "#ffd23a"], 4, 0.05); }
        break;
      case "blockhit":
        SFX.hit(d.mat, d.dmg);
        burst(d.x, d.y, Math.min(5, d.dmg | 0), "chip", MAT_BITS[d.mat], 2, 0.08);
        break;
      case "pighit":
        SFX.pigHit();
        break;
      case "pigdie":
        SFX.pigDie();
        puff(d.x, d.y, 10, d.r * 2.2, "#ffffff");
        popup(d.x, d.y + 0.4, d.score.toLocaleString("en-US"), "#8ee050", true);
        popup(d.x, d.y - 0.4, `+${d.coins} coins`, "#ffd23a", false);
        SFX.coin();
        break;
      case "break": {
        SFX.break(d.e.mat);
        const e = d.e;
        burst(d.x, d.y, Math.min(16, 5 + Math.round((e.area || 0.4) * 10)), e.mat === "glass" ? "shard" : "chunk", MAT_BITS[e.mat], 3, e.mat === "stone" ? 0.16 : 0.13);
        if (e.mat === "stone" || e.mat === "wood") puff(d.x, d.y, 3, 0.5, e.mat === "stone" ? "#c8c4be" : "#d8c4a4");
        popup(d.x, d.y, d.score.toLocaleString("en-US"), e.mat === "glass" ? "#bfe9ff" : e.mat === "stone" ? "#e6e9ec" : "#ffd28a");
        break;
      }
      case "explode":
        if (d.cry) { particles.push({ x: d.x, y: d.y, life: 0, max: 0.4, kind: "ring", size: d.r }); break; }
        SFX.explode();
        shake = 16;
        particles.push({ x: d.x, y: d.y, life: 0, max: 0.5, kind: "blast", size: d.r });
        puff(d.x, d.y, 14, 1.4, worldIdx === 4 ? "#5a4c48" : "#c9c2b8");
        burst(d.x, d.y, 14, "chip", ["#ffcf5a", "#ff7a1a", "#3a3a3a"], 7, 0.12);
        break;
      case "poof":
        SFX.poof();
        puff(d.x, d.y, 6, 0.6);
        break;
      case "bonus": {
        SFX.bonus();
        const p = birdSpot(game.bonusLeft.length);
        popup(p.x, game.groundY(p.x) + 1.2, "10,000", "#ffd23a", true);
        puff(p.x, game.groundY(p.x) + 0.4, 6, 0.6);
        break;
      }
      case "won":
        resultTimer = setTimeout(() => { if (screen === "play") showResult(true); }, 700);
        break;
      case "lost":
        resultTimer = setTimeout(() => { if (screen === "play") showResult(false); }, 900);
        break;
    }
  }

  /* ---------- scenery ---------- */

  function makeProps() {
    props = [];
    const th = ART.THEMES[worldIdx];
    const r = ART.rng((game.level.seed || 1) * 31 + worldIdx * 7 + (game.level.index || 0) * 101);
    const busy = game.ents.filter(e => e.kind === "block" || e.kind === "pig").map(e => e.body.getPosition().x);
    for (let x = -16; x < game.maxX + 24; x += 2.2 + r() * 4) {
      if (Math.abs(x) < 2.2) continue;
      const kind = th.props[(r() * th.props.length) | 0];
      const near = busy.some(b => Math.abs(b - x) < 2.2);
      if (near && kind !== "flowers" && kind !== "shell" && kind !== "rock") continue;
      props.push({ x, kind, s: 0.7 + r() * 0.6, seed: (r() * 1e6) | 0, back: r() < 0.5 });
    }
  }

  function updateAmbient(dt) {
    const kind = ART.THEMES[worldIdx].ambient;
    const want = screen === "story" ? 0 : ({ leaves: 14, dust: 30, snow: 90, spray: 0, embers: 45 }[kind] || 0);
    while (ambient.length < want) ambient.push({ x: Math.random() * W, y: Math.random() * H, v: Math.random(), ph: Math.random() * 6 });
    if (ambient.length > want) ambient.length = want;
    for (const a of ambient) {
      if (kind === "snow") { a.y += (30 + a.v * 50) * dt; a.x += Math.sin(realT + a.ph) * 20 * dt - 10 * dt; }
      else if (kind === "leaves") { a.y += (25 + a.v * 25) * dt; a.x += (30 + Math.sin(realT * 1.3 + a.ph) * 40) * dt; }
      else if (kind === "dust") { a.x += (40 + a.v * 60) * dt; a.y += Math.sin(realT + a.ph) * 10 * dt; }
      else if (kind === "embers") { a.y -= (20 + a.v * 50) * dt; a.x += Math.sin(realT * 2 + a.ph) * 25 * dt; }
      if (a.y > H + 10) a.y = -10; if (a.y < -10) a.y = H + 10;
      if (a.x > W + 10) a.x = -10; if (a.x < -10) a.x = W + 10;
    }
  }

  function drawAmbient() {
    const kind = ART.THEMES[worldIdx].ambient;
    screenSpace();
    for (const a of ambient) {
      if (kind === "snow") { ctx.fillStyle = "rgba(255,255,255,0.85)"; ART.circle(ctx, a.x, a.y, 1 + a.v * 2.2); ctx.fill(); }
      else if (kind === "leaves") {
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(realT * 2 + a.ph);
        ctx.fillStyle = a.v > 0.5 ? "#7cb342" : "#d9a13a"; ART.ellipse(ctx, 0, 0, 5, 2.2); ctx.fill(); ctx.restore();
      } else if (kind === "dust") { ctx.fillStyle = "rgba(230,190,130,0.35)"; ART.circle(ctx, a.x, a.y, 1 + a.v * 1.5); ctx.fill(); }
      else if (kind === "embers") {
        const f = 0.5 + 0.5 * Math.sin(realT * 6 + a.ph);
        ctx.fillStyle = `rgba(255,${120 + f * 100 | 0},40,${0.5 + f * 0.5})`; ART.circle(ctx, a.x, a.y, 1 + a.v * 1.8); ctx.fill();
      }
    }
  }

  /* ---------- input ---------- */

  // x of the i-th bird in a waiting line; big birds take more room
  function birdSpot(i, types) {
    types = types || game.queue;
    const r = (k) => game.birdStats(types[k] || "red").r;
    let x = -0.6 - r(0);
    for (let k = 1; k <= i; k++) x -= Math.max(0.95, r(k - 1) + r(k) + 0.2);
    return { x };
  }

  function canAim() {
    return screen === "play" && !paused && game.state === "ready" && game.loaded && realT - hopStart > 0.45;
  }

  cv.addEventListener("pointerdown", (ev) => {
    SFX.init();
    if (screen === "story") { storyNext(false); return; }
    if (screen !== "play" || paused) return;
    const w = toWorld(ev.clientX, ev.clientY);
    if (canAim()) {
      const r = game.birdStats(game.loaded).r;
      const near = Math.hypot(w.x - game.pouch.x, w.y - game.pouch.y) < Math.max(1.4, r + 0.9, 48 / cam.z);
      if (near) {
        drag = { id: ev.pointerId, x: 0, y: 0, last: 0 };
        cv.setPointerCapture(ev.pointerId);
        return;
      }
    }
    if (game.state === "flying") game.ability();
  });

  cv.addEventListener("pointermove", (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const w = toWorld(ev.clientX, ev.clientY);
    const p = game.clampPull(w.x - game.pouch.x, w.y - game.pouch.y);
    drag.x = p.x; drag.y = p.y;
    const k = Math.hypot(p.x, p.y) / MAX_PULL;
    if (Math.abs(k - drag.last) > 0.12) { SFX.stretch(k); drag.last = k; }
  });

  function release(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const { x, y } = drag;
    drag = null;
    if (game.launch(x, y)) snap = { x, y, t: realT };
  }
  cv.addEventListener("pointerup", release);
  cv.addEventListener("pointercancel", (ev) => { if (drag && ev.pointerId === drag.id) drag = null; });

  window.addEventListener("keydown", (ev) => {
    if (screen === "story" && (ev.key === " " || ev.key === "Enter")) { ev.preventDefault(); storyNext(false); return; }
    if (screen !== "play") return;
    if (ev.key === "Escape" || ev.key === "p") pause(!paused);
    else if (ev.key === "r" && !paused) startLevel(worldIdx, levelIdx);
    else if (ev.key === " " && !paused) { ev.preventDefault(); game.ability(); }
  });

  document.addEventListener("visibilitychange", () => { if (document.hidden && screen === "play" && !paused) pause(true); });

  /* ---------- buttons ---------- */

  $("play").onclick = () => { SFX.init(); SFX.click(); goWorlds(); };
  $("worlds-back").onclick = () => { SFX.click(); goTitle(); };
  $("worlds-shop").onclick = () => { SFX.click(); goShop(goWorlds); };
  $("levels-back").onclick = () => { SFX.click(); goWorlds(); };
  $("levels-shop").onclick = () => { SFX.click(); goShop(() => goLevels(worldIdx)); };
  $("shop-back").onclick = () => { SFX.click(); (shopReturn || goWorlds)(); };
  $("story-next").onclick = (ev) => { ev.stopPropagation(); SFX.click(); storyNext(false); };
  $("story-skip").onclick = (ev) => { ev.stopPropagation(); SFX.click(); storyNext(true); };
  $("pause-btn").onclick = () => { SFX.init(); SFX.click(); pause(true); };
  $("restart-btn").onclick = () => { SFX.click(); startLevel(worldIdx, levelIdx); };
  $("resume").onclick = () => { SFX.click(); pause(false); };
  $("pause-restart").onclick = () => { SFX.click(); startLevel(worldIdx, levelIdx); };
  $("pause-levels").onclick = () => { SFX.click(); bank(); goLevels(worldIdx); };

  const SOUND_ON = `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#2b1606"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#2b1606" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  const SOUND_OFF = `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#2b1606"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="#2b1606" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  function soundIcons() {
    document.querySelectorAll(".sound-btn").forEach(b => {
      b.innerHTML = SFX.muted ? SOUND_OFF : SOUND_ON;
      b.setAttribute("aria-pressed", String(!SFX.muted));
    });
  }
  document.querySelectorAll(".sound-btn").forEach(b => b.onclick = () => { SFX.init(); SFX.toggle(); SFX.click(); soundIcons(); });
  soundIcons();

  /* ---------- update ---------- */

  let acc = 0, lastScore = -1, lastCoins = -1;

  function update(dt) {
    if (screen === "story" && story) story.t += dt;
    if (screen === "play" && !paused) {
      acc += dt;
      let n = 0;
      while (acc >= DT && n++ < 6) {
        const wasReady = game.state === "ready";
        const loadedBefore = game.loaded;
        game.step();
        acc -= DT;
        if (game.state === "ready" && (!wasReady || game.loaded !== loadedBefore)) hopStart = realT;
      }
      if (acc > DT * 6) acc = 0;
      if (game.score !== lastScore) { lastScore = game.score; $("score").textContent = game.score.toLocaleString("en-US"); }
      if (game.coins !== lastCoins) { lastCoins = game.coins; $("level-coins").textContent = "+" + game.coins; }
    }

    if (game) {
      let target = cam.fitX;
      if (screen === "play" && game.state === "flying") {
        let lead = null;
        for (const b of game.flying) if (!b.dead && (!lead || b.body.getPosition().x > lead.body.getPosition().x)) lead = b;
        if (lead) {
          const want = lead.body.getPosition().x - (W * 0.7) / cam.z;
          if (want > target) target = want;
        }
      }
      const k = 1 - Math.exp(-dt * (target > cam.x ? 6 : 2.5));
      cam.x += (target - cam.x) * k;
    }

    for (const p of particles) {
      p.life += dt;
      if (p.kind === "smoke") { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
      else if (p.kind !== "blast" && p.kind !== "ring") {
        p.vy -= (p.kind === "feather" ? 3 : 14) * dt;
        if (p.kind === "feather") { p.vx *= 0.97; p.vy = Math.max(p.vy, -1.2); }
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        const g = game ? game.groundY(p.x) + 0.03 : 0;
        if (p.y < g && p.kind !== "feather") { p.y = g; p.vy *= -0.3; p.vx *= 0.6; p.vr *= 0.5; }
      }
    }
    particles = particles.filter(p => p.life < p.max);
    for (const p of popups) p.life += dt;
    popups = popups.filter(p => p.life < 1.4);
    shake = shake > 0.3 ? shake * Math.exp(-dt * 7) : 0;
    updateAmbient(dt);
  }

  /* ---------- render ---------- */

  function render() {
    const t = realT;
    if (screen === "story" && story) {
      STORY.draw(story.scene, story.panel, ctx, W, H, D, story.t);
      return;
    }
    if (!game) return;
    const th = ART.THEMES[worldIdx];
    const px = 1 / cam.z;
    screenSpace();
    const horizon = Math.min(H * 0.85, sy(game.groundY(cam.x + W / cam.z * 0.5)) + cam.z * 0.6);
    ART.backdrop(ctx, W, H, cam.x, cam.z, horizon, t, worldIdx);

    // props standing behind the terrain line
    for (const p of props) {
      if (!p.back || sx(p.x) < -300 || sx(p.x) > W + 300) continue;
      local(p.x, game.groundY(p.x) - 0.1);
      ctx.globalAlpha = 0.92;
      ART.drawProp(ctx, p.kind, p.s, ART.rng(p.seed), th);
      ctx.globalAlpha = 1;
    }

    // terrain
    screenSpace();
    const pts = [];
    const xa = cam.x - 2, xb = cam.x + W / cam.z + 2;
    pts.push([sx(xa), sy(game.groundY(xa))]);
    for (const q of game.terrain) if (q[0] > xa && q[0] < xb) pts.push([sx(q[0]), sy(q[1])]);
    pts.push([sx(xb), sy(game.groundY(xb))]);
    ART.drawTerrain(ctx, pts, H, cam.z, worldIdx, cam.x, t);

    for (const p of props) {
      if (p.back || sx(p.x) < -300 || sx(p.x) > W + 300) continue;
      local(p.x, game.groundY(p.x) - 0.05);
      ART.drawProp(ctx, p.kind, p.s, ART.rng(p.seed), th);
    }

    // contact shadows
    for (const e of game.ents) {
      if (e.dead || !e.body || e.kind === "rock") continue;
      const p = e.body.getPosition();
      const g = game.groundY(p.x);
      const h = p.y - g;
      if (h > 6) continue;
      const size = e.r || Math.max(e.w || 0.4, e.h || 0.4) * 0.5;
      local(p.x, g);
      ctx.fillStyle = `rgba(0,0,0,${0.22 * (1 - h / 6)})`;
      ART.ellipse(ctx, 0, 0, size * (1 + h * 0.15), 0.08 + size * 0.15);
      ctx.fill();
    }

    // trail puffs
    local(0, 0);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const tr of [game.lastTrail, game.trail]) for (const d of tr) { ART.circle(ctx, d.x, d.y, d.big ? 0.13 : 0.08); ctx.fill(); }

    const tier = P.upg.sling || 0;
    const base = { x: 0, y: game.slingBase };
    local(base.x, base.y);
    ART.slingBack(ctx, tier);

    let pouch = { x: game.pouch.x, y: game.pouch.y };
    const aiming = drag && game.state === "ready" && game.loaded;
    if (aiming) pouch = { x: game.pouch.x + drag.x, y: game.pouch.y + drag.y };
    else if (snap) {
      const k = t - snap.t;
      if (k > 0.6) snap = null;
      else { const f = Math.exp(-k * 7) * Math.cos(k * 32); pouch = { x: game.pouch.x + snap.x * f * 0.6, y: game.pouch.y + snap.y * f * 0.6 }; }
    }
    // band and pouch are drawn in sling-local coordinates
    const rel = { x: pouch.x - base.x, y: pouch.y - base.y };
    local(base.x, base.y);
    ART.band(ctx, ART.SL.back, rel, tier);

    // birds waiting in line
    const waiting = [];
    if (game.state === "bonus") {
      const all = (game.loaded ? [game.loaded] : []).concat(game.queue);
      for (let i = 0; i < game.bonusLeft.length; i++) waiting.push(all[i]);
    } else if (game.state !== "won") waiting.push(...game.queue);
    waiting.forEach((type, i) => {
      const spot = birdSpot(i, waiting);
      const st = game.birdStats(type);
      const hop = Math.max(0, Math.sin(t * 4 + i * 1.7)) ** 8 * 0.35;
      local(spot.x, game.groundY(spot.x) + st.r + hop);
      ART.drawBird(ctx, type, st.r, t, { blink: ((t + i) % 3.3) < 0.12, tier: st.tier });
    });

    if (game.loaded && game.state !== "bonus") {
      const st = game.birdStats(game.loaded);
      let bx = pouch.x, by = pouch.y, ang = 0;
      const h = (t - hopStart) / 0.45;
      if (h < 1 && !aiming) {
        const from = birdSpot(0, [game.loaded]);
        const fy = game.groundY(from.x) + st.r;
        const e = 1 - (1 - h) * (1 - h);
        bx = from.x + (game.pouch.x - from.x) * e;
        by = fy + (game.pouch.y - fy) * e + Math.sin(h * Math.PI) * 1.2;
        ang = -h * Math.PI * 2;
      }
      if (aiming) ang = Math.atan2(-drag.y, -drag.x);
      local(bx, by, ang);
      ART.drawBird(ctx, game.loaded, st.r, t, { blink: !aiming && (t % 2.7) < 0.12, tier: st.tier });
    }
    local(base.x, base.y);
    ART.pouch(ctx, rel, Math.atan2(game.pouch.y - pouch.y, game.pouch.x - pouch.x) || 0);
    ART.band(ctx, ART.SL.front, rel, tier);
    ART.slingFront(ctx, tier);

    // aiming line, longer with the sight upgrade
    if (aiming) {
      const d = Math.hypot(drag.x, drag.y);
      if (d > 0.25) {
        const v = game.launchVelocity(drag.x, drag.y);
        let x = pouch.x, y = pouch.y, vx = v.x, vy = v.y;
        local(0, 0);
        const n = TIERS.scope[P.upg.scope || 0];
        for (let i = 0; i < n; i++) {
          for (let k = 0; k < 4; k++) { vy -= 10 * DT; x += vx * DT; y += vy * DT; }
          if (y < game.groundY(x)) break;
          ctx.fillStyle = `rgba(255,255,255,${0.8 - 0.45 * i / n})`;
          ART.circle(ctx, x, y, 0.075); ctx.fill();
        }
      }
    }

    // blocks and pigs
    for (const e of game.ents) {
      if (e.dead || e.kind !== "block") continue;
      const p = e.body.getPosition();
      const a = e.body.getAngle();
      local(p.x, p.y, a);
      ART.drawBlock(ctx, e, px, worldIdx, a);
    }
    for (const e of game.ents) {
      if (e.dead || e.kind !== "pig") continue;
      const p = e.body.getPosition();
      local(p.x, p.y, e.body.getAngle() * 0.3);
      ART.drawPig(ctx, e, t);
    }

    // flying birds
    for (const e of game.ents) {
      if (e.dead || e.kind !== "bird") continue;
      const p = e.body.getPosition();
      const v = e.body.getLinearVelocity();
      const ang = e.hit ? e.body.getAngle() : Math.atan2(v.y, v.x);
      if (e.egg) { local(p.x, p.y); ART.drawEgg(ctx, e.r); continue; }
      local(p.x, p.y, ang);
      const lit = e.type === "black" && (e.hit || e.used);
      const flash = e.type === "black" && e.hit && !e.used && ((game.time - e.hitTime) * (4 + (game.time - e.hitTime) * 8)) % 1 < 0.5;
      ART.drawBird(ctx, e.type, e.r, t, { lit, flash, tier: e.tier });
      if (e.boost && game.time - e.boost < 0.5) {
        ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 0.06;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-e.r * 1.6, i * e.r * 0.5); ctx.lineTo(-e.r * 3.2, i * e.r * 0.5); ctx.stroke(); }
      }
    }

    // particles
    for (const p of particles) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.5));
      if (p.kind === "smoke") {
        local(p.x, p.y);
        const rr = p.size * (0.6 + p.life / p.max);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
        g.addColorStop(0, p.color); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ART.circle(ctx, 0, 0, rr); ctx.fill();
      } else if (p.kind === "blast") {
        local(p.x, p.y);
        const k = p.life / p.max, rr = p.size * (0.3 + k * 0.9);
        ctx.globalAlpha = 1 - k;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
        g.addColorStop(0, "#fffbe0"); g.addColorStop(0.4, "#ffc04a"); g.addColorStop(0.8, "#ff5a10"); g.addColorStop(1, "rgba(120,30,0,0)");
        ctx.fillStyle = g;
        ART.circle(ctx, 0, 0, rr); ctx.fill();
      } else if (p.kind === "ring") {
        local(p.x, p.y);
        const k = p.life / p.max;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = "rgba(255,240,200,0.9)"; ctx.lineWidth = 0.12;
        ART.circle(ctx, 0, 0, p.size * k); ctx.stroke();
      } else {
        local(p.x, p.y, p.rot);
        ctx.fillStyle = p.color;
        if (p.kind === "shard") { ctx.beginPath(); ctx.moveTo(-p.size, -p.size * 0.5); ctx.lineTo(p.size, 0); ctx.lineTo(-p.size * 0.3, p.size * 0.7); ctx.closePath(); ctx.fill(); }
        else if (p.kind === "feather") { ART.ellipse(ctx, 0, 0, p.size, p.size * 0.35); ctx.fill(); }
        else if (p.kind === "spark") { ART.circle(ctx, 0, 0, p.size); ctx.fill(); }
        else ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
      }
    }
    ctx.globalAlpha = 1;

    drawAmbient();

    // score popups
    screenSpace();
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    for (const p of popups) {
      const k = p.life / 1.4;
      const size = Math.max(14, cam.z * (p.big ? 0.75 : 0.45)) * (k < 0.15 ? 0.6 + k / 0.15 * 0.4 : 1);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `${size}px "Lilita One", Impact, sans-serif`;
      const x = sx(p.x), y = sy(p.y + k * 1.4);
      ctx.lineWidth = size * 0.22; ctx.strokeStyle = "#2b1606";
      ctx.strokeText(p.text, x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- main loop ---------- */

  let prev = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - prev) / 1000);
    prev = now;
    realT += dt;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // handle for tools and the console
  window.FFDEBUG = {
    get game() { return game; }, get P() { return P; },
    screen: (x, y) => ({ x: sx(x), y: sy(y) }),
    start: startLevel, shop: () => goShop(goWorlds), worlds: goWorlds, levels: goLevels, story: playStory,
  };

  resize();
  backdropGame(0);
  updateCoins();
  (document.fonts && document.fonts.load ? document.fonts.load('40px "Lilita One"') : Promise.resolve())
    .catch(() => {}).then(() => requestAnimationFrame(frame));
})();
