/* Feather Fury: screens, camera, input, rendering and effects. */
(function () {
  "use strict";
  const { Game, BIRDS, SLING, MAX_PULL, DT } = FF;
  const cv = document.getElementById("c");
  const ctx = cv.getContext("2d");
  const $ = (id) => document.getElementById(id);

  let W = 0, H = 0, D = 1;
  let screen = "title";
  let game = null, levelIdx = 0;
  let paused = false;
  let cam = { x: -6, z: 30, fitX: -6 };
  let gy = 0;                   // screen y of the ground
  const GROUND_PAD = 1.9;       // metres of dirt below the ground line
  let particles = [], popups = [];
  let shake = 0;
  let realT = 0;
  let drag = null;              // {x, y} pull while aiming
  let hopStart = 0;             // when the current bird started hopping onto the sling
  let snap = null;              // pouch spring after a launch
  let resultTimer = null;
  let hintShown = false;

  /* ---------- progress ---------- */

  let progress = { stars: {}, best: {} };
  try { progress = Object.assign(progress, JSON.parse(localStorage.getItem("ff_progress") || "{}")); } catch (e) {}
  function save() { try { localStorage.setItem("ff_progress", JSON.stringify(progress)); } catch (e) {} }
  function unlocked(i) { return i === 0 || (progress.stars[i - 1] || 0) > 0; }

  /* ---------- layout ---------- */

  function resize() {
    D = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * D); cv.height = Math.round(H * D);
    if (game) fitCamera(true);
  }
  window.addEventListener("resize", resize);

  function fitCamera(jump) {
    const x0 = Math.min(-4.6, birdSpot(game.level.birds.length - 2).x - 1.1);
    const x1 = Math.max(game.maxX + 1.4, 21);
    let top = 0;
    for (const e of game.ents) {
      if (e.dead || !e.body) continue;
      if (e.kind === "block" || e.kind === "pig" || e.kind === "ground") {
        const p = e.body.getPosition();
        top = Math.max(top, p.y + (e.r || (e.h || 0) / 2));
      }
    }
    const needH = Math.max(9, top + 3.5) + GROUND_PAD;
    const z = Math.min(W / (x1 - x0), H / needH);
    const spare = W / z - (x1 - x0);
    cam.z = z;
    cam.fitX = x0 - Math.max(0, spare) * 0.35;
    if (jump) cam.x = cam.fitX;
  }

  const sx = (x) => (x - cam.x) * cam.z;
  const sy = (y) => gy - y * cam.z;
  function toWorld(px, py) { return { x: cam.x + px / cam.z, y: (gy - py) / cam.z }; }

  // switch the context to local metres (+y up) around world point x, y
  function local(x, y, angle, scale) {
    const k = D * cam.z * (scale || 1);
    const ox = shake ? (Math.random() - 0.5) * shake : 0, oy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(k, 0, 0, -k, D * (sx(x) + ox), D * (sy(y) + oy));
    if (angle) ctx.rotate(angle);
  }
  function screenSpace() { ctx.setTransform(D, 0, 0, D, 0, 0); }

  /* ---------- screens ---------- */

  function show(id) {
    for (const s of ["title", "levels", "pause", "result"]) $(s).classList.toggle("on", s === id);
  }

  function goTitle() {
    screen = "title"; paused = false;
    $("hud").classList.remove("on");
    document.body.classList.remove("playing");
    show("title");
    backdrop();
  }

  function goLevels() {
    screen = "levels"; paused = false;
    $("hud").classList.remove("on");
    document.body.classList.remove("playing");
    buildGrid();
    show("levels");
    backdrop();
  }

  function backdrop() {
    game = new Game(LEVELS[0], () => {});
    particles = []; popups = [];
    fitCamera(true);
  }

  const STAR = (lit) => `<svg viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7L12 17.8 5.8 21.1 7 14.1 1.9 9.2l7-1z" fill="${lit ? "#ffd23a" : "#5a4632"}" stroke="#2b1606" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

  function buildGrid() {
    const grid = $("grid");
    grid.innerHTML = "";
    let total = 0;
    LEVELS.forEach((lv, i) => {
      const st = progress.stars[i] || 0;
      total += st;
      const b = document.createElement("button");
      b.className = "tile";
      if (unlocked(i)) {
        b.innerHTML = `<span>${i + 1}</span><span class="stars">${STAR(st > 0) + STAR(st > 1) + STAR(st > 2)}</span>`;
        b.setAttribute("aria-label", `Level ${i + 1}, ${st} of 3 stars`);
        b.onclick = () => { SFX.click(); startLevel(i); };
      } else {
        b.disabled = true;
        b.innerHTML = `<svg viewBox="0 0 24 24" width="40%" height="40%"><rect x="5" y="10" width="14" height="11" rx="2" fill="#2b1606"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#2b1606" stroke-width="3"/></svg>`;
        b.setAttribute("aria-label", `Level ${i + 1}, locked`);
      }
      grid.appendChild(b);
    });
    $("total-stars").textContent = `${total} / ${LEVELS.length * 3} stars`;
  }

  function startLevel(i) {
    levelIdx = i;
    screen = "play"; paused = false;
    clearTimeout(resultTimer);
    show(null);
    $("hud").classList.add("on");
    document.body.classList.add("playing");
    particles = []; popups = []; drag = null; snap = null; shake = 0;
    game = new Game(LEVELS[i], onEvent);
    hopStart = realT;
    fitCamera(true);
    $("levelname").textContent = `Level ${i + 1}`;
    $("best").textContent = progress.best[i] ? `Best ${progress.best[i].toLocaleString("en-US")}` : "";
    lastScore = -1;
    setHint(i === 0 ? "Drag the bird back and let go" : abilityHint(LEVELS[i]));
  }

  function abilityHint(lv) {
    const first = { blue: 3, yellow: 6, black: 9, white: 12 };
    for (const [type, idx] of Object.entries(first)) {
      if (levelIdx === idx) {
        return {
          blue: "Tap while the blue bird flies: it splits in three. Great on glass",
          yellow: "Tap while the yellow bird flies: it shoots forward. Great on wood",
          black: "The black bird explodes. Tap, or wait after it hits",
          white: "Tap above the pigs: the white bird drops an egg bomb",
        }[type];
      }
    }
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
    const card = $("result-card");
    card.classList.toggle("fail", !won);
    $("result-title").textContent = won ? "Level cleared!" : "Level failed";
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
      $("result-score").textContent = game.score.toLocaleString("en-US");
      if (game.score > (progress.best[levelIdx] || 0)) {
        if (progress.best[levelIdx]) $("result-best").textContent = "New highscore!";
        progress.best[levelIdx] = game.score;
      }
      progress.stars[levelIdx] = Math.max(progress.stars[levelIdx] || 0, n);
      save();
      mk("Levels", "wood", goLevels);
      mk("Retry", "wood", () => startLevel(levelIdx));
      if (levelIdx + 1 < LEVELS.length) mk("Next", "", () => startLevel(levelIdx + 1)).focus();
      SFX.win();
    } else {
      $("result-score").textContent = game.score.toLocaleString("en-US");
      $("result-best").textContent = "The pigs are laughing at you.";
      mk("Levels", "wood", goLevels);
      mk("Retry", "", () => startLevel(levelIdx)).focus();
      SFX.lose();
    }
    show("result");
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
        life: 0, max: 0.7 + Math.random() * 0.7, kind,
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
        life: 0, max: 0.6 + Math.random() * 0.4, kind: "smoke",
        color: color || "#ffffff", size: size * (0.4 + Math.random() * 0.4),
      });
    }
  }

  function popup(x, y, text, color, big) {
    popups.push({ x, y, text, color, life: 0, big });
  }

  function onEvent(type, d) {
    switch (type) {
      case "launch":
        SFX.launch(d.power); SFX.birdcall(d.type);
        if (hintShown && levelIdx === 0) setHint("");
        break;
      case "ability":
        SFX.ability(d.type);
        burst(d.x, d.y, 8, "feather", [ART.BIRD_COLORS[d.type].body, "#fff"], 3, 0.18);
        if (d.type === "white") puff(d.x, d.y, 5, 0.5);
        if (hintShown) setHint("");
        break;
      case "birdhit":
        if (d.j > 2) burst(d.x, d.y, 6, "feather", [ART.BIRD_COLORS[d.type].body, ART.BIRD_COLORS[d.type].dark], 2.5, 0.16);
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
        break;
      case "break": {
        SFX.break(d.e.mat);
        const e = d.e;
        const area = e.area || 0.4;
        burst(d.x, d.y, Math.min(16, 5 + Math.round(area * 10)), e.mat === "glass" ? "shard" : "chunk", MAT_BITS[e.mat], 3, e.mat === "stone" ? 0.16 : 0.13);
        popup(d.x, d.y, d.score.toLocaleString("en-US"), e.mat === "glass" ? "#bfe9ff" : e.mat === "stone" ? "#e6e9ec" : "#ffd28a");
        break;
      }
      case "explode":
        SFX.explode();
        shake = 16;
        particles.push({ x: d.x, y: d.y, life: 0, max: 0.45, kind: "blast", size: d.r });
        puff(d.x, d.y, 14, 1.4, "#c9c2b8");
        burst(d.x, d.y, 14, "chip", ["#ffcf5a", "#ff7a1a", "#3a3a3a"], 7, 0.12);
        break;
      case "poof":
        SFX.poof();
        puff(d.x, d.y, 6, 0.6);
        break;
      case "bonus": {
        SFX.bonus();
        const p = birdSpot(game.bonusLeft.length);
        popup(p.x, p.y + 0.8, "10,000", "#ffd23a", true);
        puff(p.x, p.y, 6, 0.6);
        break;
      }
      case "clear":
        break;
      case "won":
        resultTimer = setTimeout(() => { if (screen === "play") showResult(true); }, 700);
        break;
      case "lost":
        resultTimer = setTimeout(() => { if (screen === "play") showResult(false); }, 900);
        break;
    }
  }

  /* ---------- input ---------- */

  function birdSpot(i) {
    return { x: -1.35 - i * 0.95, y: 0 };
  }

  function canAim() {
    return screen === "play" && !paused && game.state === "ready" && game.loaded && realT - hopStart > 0.45;
  }

  cv.addEventListener("pointerdown", (ev) => {
    SFX.init();
    if (screen !== "play" || paused) return;
    const w = toWorld(ev.clientX, ev.clientY);
    if (canAim()) {
      const r = BIRDS[game.loaded].r;
      const near = Math.hypot(w.x - SLING.x, w.y - SLING.y) < Math.max(1.4, r + 0.9, 48 / cam.z);
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
    const p = game.clampPull(w.x - SLING.x, w.y - SLING.y);
    drag.x = p.x; drag.y = p.y;
    const k = Math.hypot(p.x, p.y) / MAX_PULL;
    if (Math.abs(k - drag.last) > 0.12) { SFX.stretch(k); drag.last = k; }
  });

  function release(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const { x, y } = drag;
    drag = null;
    if (game.launch(x, y)) {
      snap = { x, y, t: realT };
    }
  }
  cv.addEventListener("pointerup", release);
  cv.addEventListener("pointercancel", (ev) => { if (drag && ev.pointerId === drag.id) drag = null; });

  window.addEventListener("keydown", (ev) => {
    if (screen !== "play") return;
    if (ev.key === "Escape" || ev.key === "p") { pause(!paused); }
    else if (ev.key === "r" && !paused) startLevel(levelIdx);
    else if (ev.key === " " && !paused) { ev.preventDefault(); game.ability(); }
  });

  document.addEventListener("visibilitychange", () => { if (document.hidden && screen === "play" && !paused) pause(true); });

  /* ---------- buttons ---------- */

  $("play").onclick = () => { SFX.init(); SFX.click(); goLevels(); };
  $("levels-back").onclick = () => { SFX.click(); goTitle(); };
  $("pause-btn").onclick = () => { SFX.init(); SFX.click(); pause(true); };
  $("restart-btn").onclick = () => { SFX.click(); startLevel(levelIdx); };
  $("resume").onclick = () => { SFX.click(); pause(false); };
  $("pause-restart").onclick = () => { SFX.click(); startLevel(levelIdx); };
  $("pause-levels").onclick = () => { SFX.click(); goLevels(); };

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

  let acc = 0, lastScore = -1;

  function update(dt) {
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
      if (game.score !== lastScore) {
        lastScore = game.score;
        $("score").textContent = game.score.toLocaleString("en-US");
      }
    }

    // camera follows the furthest bird, then drifts back
    if (game) {
      let target = cam.fitX;
      if (screen === "play" && game.state === "flying") {
        let lead = null;
        for (const b of game.flying) if (!b.dead && (!lead || b.body.getPosition().x > lead.body.getPosition().x)) lead = b;
        if (lead) {
          const bx = lead.body.getPosition().x;
          const want = bx - (W * 0.7) / cam.z;
          if (want > target) target = want;
        }
      }
      const k = 1 - Math.exp(-dt * (target > cam.x ? 6 : 2.5));
      cam.x += (target - cam.x) * k;
    }
    gy = H - GROUND_PAD * cam.z;

    for (const p of particles) {
      p.life += dt;
      if (p.kind === "smoke") { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
      else if (p.kind !== "blast") {
        p.vy -= (p.kind === "feather" ? 3 : 14) * dt;
        if (p.kind === "feather") { p.vx *= 0.97; p.vy = Math.max(p.vy, -1.2); }
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y < 0.03 && p.kind !== "feather") { p.y = 0.03; p.vy *= -0.3; p.vx *= 0.6; p.vr *= 0.5; }
      }
    }
    particles = particles.filter(p => p.life < p.max);
    for (const p of popups) p.life += dt;
    popups = popups.filter(p => p.life < 1.4);
    shake = shake > 0.3 ? shake * Math.exp(-dt * 7) : 0;
  }

  /* ---------- render ---------- */

  function render() {
    const t = realT;
    screenSpace();
    ART.sky(ctx, W, H, cam.x, cam.z, gy, t);
    ART.ground(ctx, W, H, gy, cam.z, cam.x);
    if (!game) return;
    const px = 1 / (cam.z);

    // earth platforms
    for (const e of game.ents) {
      if (e.kind !== "ground") continue;
      const p = e.body.getPosition();
      const x0 = sx(p.x - e.w / 2), x1 = sx(p.x + e.w / 2), top = sy(p.y + e.h / 2);
      screenSpace();
      const g = ctx.createLinearGradient(0, top, 0, gy);
      g.addColorStop(0, "#9a6634"); g.addColorStop(1, "#6e4420");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 - 0.3 * cam.z, gy + 2);
      ctx.lineTo(x0, top + 0.1 * cam.z);
      ctx.lineTo(x1, top + 0.1 * cam.z);
      ctx.lineTo(x1 + 0.3 * cam.z, gy + 2);
      ctx.closePath(); ctx.fill();
      ART.grassStrip(ctx, x0, x1, top, cam.z, 0);
    }

    // trail puffs
    local(0, 0);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const tr of [game.lastTrail, game.trail]) {
      for (const d of tr) { ART.circle(ctx, d.x, d.y, d.big ? 0.13 : 0.08); ctx.fill(); }
    }

    // slingshot: back half
    local(SLING.x, 0);
    ART.slingBack(ctx);

    // pouch position
    let pouch = { x: SLING.x, y: SLING.y };
    const aiming = drag && game.state === "ready" && game.loaded;
    if (aiming) pouch = { x: SLING.x + drag.x, y: SLING.y + drag.y };
    else if (snap) {
      const k = (t - snap.t);
      if (k > 0.6) snap = null;
      else {
        const f = Math.exp(-k * 7) * Math.cos(k * 32);
        pouch = { x: SLING.x + snap.x * f * 0.6, y: SLING.y + snap.y * f * 0.6 };
      }
    }
    local(0, 0);
    ART.band(ctx, ART.SL.back, pouch);

    // birds waiting in line (and the one hopping onto the sling)
    const waiting = [];
    if (game.state === "bonus") {
      const all = (game.loaded ? [game.loaded] : []).concat(game.queue);
      for (let i = 0; i < game.bonusLeft.length; i++) waiting.push(all[i]);
    } else if (game.state !== "won") waiting.push(...game.queue);
    waiting.forEach((type, i) => {
      const spot = birdSpot(i);
      const r = BIRDS[type].r;
      const hop = Math.max(0, Math.sin(t * 4 + i * 1.7)) ** 8 * 0.35;
      local(spot.x, spot.y + r + hop);
      ART.drawBird(ctx, type, r, t, { blink: ((t + i) % 3.3) < 0.12 });
    });

    if (game.loaded && game.state !== "bonus") {
      const r = BIRDS[game.loaded].r;
      let bx = pouch.x, by = pouch.y, ang = 0;
      const h = (t - hopStart) / 0.45;
      if (h < 1 && !aiming) {
        const from = birdSpot(0);
        const e = 1 - (1 - h) * (1 - h);
        bx = from.x + (SLING.x - from.x) * e;
        by = from.y + r + (SLING.y - from.y - r) * e + Math.sin(h * Math.PI) * 1.2;
        ang = -h * Math.PI * 2;
      }
      if (aiming) ang = Math.atan2(-drag.y, -drag.x);
      local(bx, by, ang);
      ART.drawBird(ctx, game.loaded, r, t, { blink: !aiming && (t % 2.7) < 0.12 });
    }
    local(0, 0);
    ART.pouch(ctx, pouch, Math.atan2(SLING.y - pouch.y, SLING.x - pouch.x) || 0);
    ART.band(ctx, ART.SL.front, pouch);
    local(SLING.x, 0);
    ART.slingFront(ctx);

    // aiming: a short dotted guide from the pouch
    if (aiming) {
      const d = Math.hypot(drag.x, drag.y);
      if (d > 0.25) {
        const v = d / MAX_PULL * FF.MAX_SPEED;
        let x = pouch.x, y = pouch.y, vx = -drag.x / d * v, vy = -drag.y / d * v;
        local(0, 0);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        for (let i = 0; i < 9; i++) {
          for (let k = 0; k < 4; k++) { vy -= 10 * DT; x += vx * DT; y += vy * DT; }
          ART.circle(ctx, x, y, 0.07); ctx.fill();
        }
      }
    }

    // blocks and pigs
    for (const e of game.ents) {
      if (e.dead || e.kind !== "block") continue;
      const p = e.body.getPosition();
      local(p.x, p.y, e.body.getAngle());
      ART.drawBlock(ctx, e, px);
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
      let ang = e.hit ? e.body.getAngle() : Math.atan2(v.y, v.x);
      if (e.egg) { local(p.x, p.y); ART.drawEgg(ctx, e.r); continue; }
      local(p.x, p.y, ang);
      const lit = e.type === "black" && (e.hit || e.used);
      const flash = e.type === "black" && e.hit && !e.used && ((game.time - e.hitTime) * (4 + (game.time - e.hitTime) * 8)) % 1 < 0.5;
      ART.drawBird(ctx, e.type, e.r, t, { lit, flash });
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
        ctx.fillStyle = p.color;
        ART.circle(ctx, 0, 0, p.size * (0.6 + p.life / p.max)); ctx.fill();
      } else if (p.kind === "blast") {
        local(p.x, p.y);
        const k = p.life / p.max;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = "#fff3b0";
        ART.circle(ctx, 0, 0, p.size * (0.3 + k * 0.9)); ctx.fill();
        ctx.fillStyle = "#ff9d2e";
        ART.circle(ctx, 0, 0, p.size * (0.2 + k * 0.6)); ctx.fill();
      } else {
        local(p.x, p.y, p.rot);
        ctx.fillStyle = p.color;
        if (p.kind === "shard") {
          ctx.beginPath(); ctx.moveTo(-p.size, -p.size * 0.5); ctx.lineTo(p.size, 0); ctx.lineTo(-p.size * 0.3, p.size * 0.7); ctx.closePath(); ctx.fill();
        } else if (p.kind === "feather") {
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
        }
      }
    }
    ctx.globalAlpha = 1;

    // score popups
    screenSpace();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const p of popups) {
      const k = p.life / 1.4;
      const size = Math.max(14, cam.z * (p.big ? 0.75 : 0.5)) * (k < 0.15 ? 0.6 + k / 0.15 * 0.4 : 1);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `${size}px "Lilita One", Impact, sans-serif`;
      const x = sx(p.x), y = sy(p.y + k * 1.4);
      ctx.lineWidth = size * 0.22;
      ctx.strokeStyle = "#2b1606";
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

  // handle for tools/shots.js and the console
  window.FFDEBUG = { get game() { return game; }, screen: (x, y) => ({ x: sx(x), y: sy(y) }), start: startLevel };

  resize();
  backdrop();
  (document.fonts && document.fonts.load ? document.fonts.load('40px "Lilita One"') : Promise.resolve())
    .catch(() => {}).then(() => requestAnimationFrame(frame));
})();
