/* Feather Fury: game rules and physics, no drawing.
 *
 * World units are metres and seconds, +y is up and the slingshot stands at
 * x = 0. The ground is a terrain polyline (level.terrain). The same file runs
 * in the browser and in node (tools/check.js plays every level headless).
 */
(function (root) {
  "use strict";
  const pl = root.planck || require("./planck.min.js");
  const V = pl.Vec2;

  const DT = 1 / 60;
  const SLING_H = 2.75;                 // pouch height above the slingshot's foot
  const MAX_PULL = 2.0;                 // metres the pouch can be pulled
  const MAX_SPEED = 21;                 // launch speed at full pull, unupgraded

  const MATS = {
    wood:  { density: 0.9, friction: 0.8, restitution: 0.05, hp: 9,  score: 500 },
    glass: { density: 0.7, friction: 0.4, restitution: 0.05, hp: 4,  score: 500 },
    stone: { density: 2.4, friction: 0.9, restitution: 0.02, hp: 24, score: 500 },
    tnt:   { density: 0.8, friction: 0.7, restitution: 0.05, hp: 2.5, score: 500 },
  };

  // mult: how hard each bird hits each material (the blue one shatters glass, ...)
  const BIRDS = {
    red:    { r: 0.36, density: 3.2, mult: { wood: 1.0, glass: 1.1, stone: 0.7, tnt: 1 } },
    blue:   { r: 0.25, density: 3.6, mult: { wood: 0.5, glass: 3.2, stone: 0.3, tnt: 1 } },
    yellow: { r: 0.37, density: 2.8, mult: { wood: 2.6, glass: 1.0, stone: 0.5, tnt: 1 } },
    black:  { r: 0.46, density: 3.4, mult: { wood: 1.0, glass: 1.0, stone: 1.6, tnt: 1 } },
    white:  { r: 0.48, density: 2.4, mult: { wood: 0.8, glass: 0.8, stone: 0.6, tnt: 1 } },
    big:    { r: 0.74, density: 3.4, mult: { wood: 1.5, glass: 1.5, stone: 1.3, tnt: 1 } },
  };

  const PIGS = {
    s:    { r: 0.32, hp: 3,  coins: 10 },
    m:    { r: 0.44, hp: 5,  coins: 15 },
    l:    { r: 0.58, hp: 8,  coins: 20 },
    boss: { r: 0.68, hp: 13, coins: 60 },
    king: { r: 0.78, hp: 18, coins: 150 },
  };
  const HELMET_COINS = 10;

  // Upgrade tiers 0..5. Bird: bigger, leather helmet, iron plate, spiked helmet, golden armour.
  const TIERS = {
    size:    [1, 1.12, 1.12, 1.18, 1.25, 1.3],
    density: [1, 1, 1.1, 1.3, 1.35, 1.45],
    dmg:     [1, 1.05, 1.25, 1.45, 1.7, 2.0],
    sling:   [1, 1.06, 1.12, 1.18, 1.24, 1.3],      // launch speed
    scope:   [6, 10, 15, 22, 32, 60],               // aiming dots
  };

  const PIG_SCORE = 5000, BIRD_BONUS = 10000;
  const HIT_SPEED = 0.7;      // contacts slower than this never hurt (resting stacks)

  function blockHp(mat, area) {
    const f = Math.min(2.6, Math.max(0.5, area / 0.44));
    return MATS[mat].hp * Math.pow(f, 0.75);
  }

  class Game {
    // upg: { sling, scope, birds: { red: tier, ... } }, all optional
    constructor(level, emit, upg) {
      this.level = level;
      this.emit = emit || function () {};
      this.upg = upg || {};
      this.world = new pl.World({ gravity: V(0, -10) });
      this.ents = [];
      this.score = 0;
      this.coins = 0;
      this.time = 0;
      this.queue = level.birds.slice();
      this.loaded = null;
      this.flying = [];          // birds (and eggs) of the current shot
      this.state = "settle";
      this.launchTime = 0;
      this.quiet = 0;
      this.clearTime = 0;
      this.trail = [];           // puffs of the current shot
      this.lastTrail = [];       // puffs of the previous shot
      this.damageOn = false;
      this.pending = [];         // things to do after the physics step

      this.terrain = level.terrain || [[-80, 0], [260, 0]];
      const ground = this.world.createBody();
      ground.createFixture(pl.Chain(this.terrain.map(p => V(p[0], p[1])), false), { friction: 0.9 });
      ground.setUserData({ kind: "ground" });
      this.ground = ground;
      const base = level.sling ? level.sling.y : this.groundY(0);
      this.pouch = { x: 0, y: base + SLING_H };
      this.slingBase = base;
      this.minY = Math.min(...this.terrain.map(p => p[1]));

      let maxX = 10;
      for (const it of level.items) {
        const e = this.add(it);
        if (e) maxX = Math.max(maxX, e.x0 + (e.w || e.r * 2 || 0));
      }
      this.maxX = maxX;
      this.pigCount = this.ents.filter(e => e.kind === "pig").length;

      this.world.on("pre-solve", (c) => this.preSolve(c));
      this.world.on("post-solve", (c, imp) => this.postSolve(c, imp));

      // Let the structures settle before the player sees them.
      for (let i = 0; i < 90; i++) this.world.step(DT);
      this.damageOn = true;
      this.state = "ready";
      this.loadNext();
    }

    groundY(x) {
      const t = this.terrain;
      if (x <= t[0][0]) return t[0][1];
      let lo = 0, hi = t.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m][0] <= x) lo = m; else hi = m; }
      const a = t[lo], b = t[hi];
      if (x >= b[0]) return b[1];
      return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    }

    tier(type) { return (this.upg.birds && this.upg.birds[type]) || 0; }

    birdStats(type) {
      const t = this.tier(type), b = BIRDS[type];
      return { r: b.r * TIERS.size[t], density: b.density * TIERS.density[t], dmg: TIERS.dmg[t], tier: t };
    }

    maxSpeed() { return MAX_SPEED * TIERS.sling[this.upg.sling || 0]; }

    add(it) {
      const t = it[0];
      if (t === "ground") {          // static rock: x, y (centre), w, h
        const [, x, y, w, h] = it;
        const b = this.world.createBody({ position: V(x, y) });
        b.createFixture(pl.Box(w / 2, h / 2), { friction: 0.9 });
        const e = { kind: "rock", body: b, x0: x - w / 2, w, h, seed: (x * 1000) | 0 };
        b.setUserData(e);
        this.ents.push(e);
        return e;
      }
      if (t === "pig") {             // x, y (centre), size, helmet
        const [, x, y, size, helmet] = it;
        const p = PIGS[size];
        const b = this.world.createBody({ type: "dynamic", position: V(x, y), angularDamping: 7 });
        b.createFixture(pl.Circle(p.r), { density: 0.8, friction: 0.8, restitution: 0.15 });
        const hp = p.hp * (helmet ? 2.3 : 1);
        const e = { kind: "pig", body: b, r: p.r, size, helmet: !!helmet, hp, maxHp: hp, x0: x - p.r, blink: (x * 7.3) % 4 };
        b.setUserData(e);
        this.ents.push(e);
        return e;
      }
      // blocks: [mat, x, y, w, h, angle] / ["ball", mat, x, y, r] / ["tri", mat, x, y, w, h]
      let mat, b, e;
      if (t === "ball") {
        const [, m, x, y, r] = it;
        mat = m;
        b = this.world.createBody({ type: "dynamic", position: V(x, y), angularDamping: 0.6 });
        b.createFixture(pl.Circle(r), this.fix(mat));
        e = { kind: "block", shape: "ball", mat, r, x0: x - r, area: Math.PI * r * r };
      } else if (t === "tri") {
        const [, m, x, y, w, h] = it;
        mat = m;
        b = this.world.createBody({ type: "dynamic", position: V(x, y) });
        const pts = [V(-w / 2, -h / 2), V(w / 2, -h / 2), V(0, h / 2)];
        b.createFixture(pl.Polygon(pts), this.fix(mat));
        e = { kind: "block", shape: "tri", mat, w, h, pts: pts.map(p => [p.x, p.y]), x0: x - w / 2, area: w * h / 2 };
      } else {
        const [m, x, y, w, h, a] = it;
        mat = m;
        b = this.world.createBody({ type: "dynamic", position: V(x, y), angle: a || 0 });
        b.createFixture(pl.Box(w / 2, h / 2), this.fix(mat));
        e = { kind: "block", shape: "box", mat, w, h, x0: x - w / 2, area: w * h };
      }
      e.body = b;
      e.hp = e.maxHp = mat === "tnt" ? MATS.tnt.hp : blockHp(mat, e.area);
      e.seed = Math.floor(((it[2] || 0) * 977 + (it[3] || 0) * 131) * 1000) >>> 0;
      b.setUserData(e);
      this.ents.push(e);
      return e;
    }

    fix(mat) {
      const m = MATS[mat];
      return { density: m.density, friction: m.friction, restitution: m.restitution };
    }

    /* ---------- the slingshot ---------- */

    loadNext() {
      if (!this.queue.length) { this.loaded = null; return false; }
      this.loaded = this.queue.shift();
      this.state = "ready";
      return true;
    }

    // pull: vector from the pouch rest point to where the pouch is dragged
    clampPull(dx, dy) {
      const d = Math.hypot(dx, dy);
      if (d > MAX_PULL) { dx *= MAX_PULL / d; dy *= MAX_PULL / d; }
      const floor = this.groundY(this.pouch.x + dx) + 0.45;
      if (this.pouch.y + dy < floor) dy = floor - this.pouch.y;
      return { x: dx, y: dy };
    }

    launchVelocity(dx, dy) {
      const d = Math.hypot(dx, dy) || 1;
      const speed = (Math.min(d, MAX_PULL) / MAX_PULL) * this.maxSpeed();
      return { x: -dx / d * speed, y: -dy / d * speed };
    }

    launch(dx, dy) {
      if (this.state !== "ready" || !this.loaded) return false;
      const p = this.clampPull(dx, dy);
      const d = Math.hypot(p.x, p.y);
      if (d < 0.25) return false;
      const v = this.launchVelocity(p.x, p.y);
      const bird = this.spawnBird(this.loaded, this.pouch.x + p.x, this.pouch.y + p.y, v.x, v.y);
      this.loaded = null;
      this.flying = [bird];
      this.state = "flying";
      this.launchTime = this.time;
      this.quiet = 0;
      this.lastTrail = this.trail;
      this.trail = [];
      this.emit("launch", { type: bird.type, power: d / MAX_PULL });
      return true;
    }

    spawnBird(type, x, y, vx, vy) {
      const st = this.birdStats(type);
      const b = this.world.createBody({
        type: "dynamic", position: V(x, y), bullet: true,
        angularDamping: 2.5, linearDamping: 0.05,
      });
      b.createFixture(pl.Circle(st.r), { density: st.density, friction: 0.6, restitution: 0.25 });
      b.setLinearVelocity(V(vx, vy));
      const e = { kind: "bird", type, body: b, r: st.r, tier: st.tier, dmg: st.dmg, used: false, hit: false, hitTime: 0, born: this.time };
      b.setUserData(e);
      this.ents.push(e);
      return e;
    }

    spawnEgg(x, y, vx, vy, tier) {
      const b = this.world.createBody({ type: "dynamic", position: V(x, y), bullet: true });
      const r = 0.3 * (tier >= 5 ? 1.15 : 1);
      b.createFixture(pl.Circle(r), { density: 6, friction: 0.5, restitution: 0 });
      b.setLinearVelocity(V(vx, vy));
      const e = { kind: "bird", type: "white", egg: true, used: true, body: b, r, tier, dmg: TIERS.dmg[tier], hit: false, hitTime: 0, born: this.time };
      b.setUserData(e);
      this.ents.push(e);
      this.flying.push(e);
      return e;
    }

    // Tap during flight. Returns true when something happened.
    ability() {
      if (this.state !== "flying") return false;
      const bird = this.flying.find(b => b.kind === "bird" && !b.dead && !b.egg);
      if (!bird || bird.used) return false;
      if (bird.hit && bird.type !== "black") return false;
      const pos = bird.body.getPosition(), vel = bird.body.getLinearVelocity();
      const sp = Math.hypot(vel.x, vel.y) || 1;
      const gold = bird.tier >= 5;
      switch (bird.type) {
        case "blue": {
          bird.used = true;
          const spread = gold ? [-0.32, -0.16, 0.16, 0.32] : [-0.2, 0.2];
          for (const da of spread) {
            const c = Math.cos(da), s = Math.sin(da);
            const nb = this.spawnBird("blue", pos.x, pos.y + da * 1.4, vel.x * c - vel.y * s, vel.x * s + vel.y * c);
            nb.used = true;
            this.flying.push(nb);
          }
          this.emit("ability", { type: "blue", x: pos.x, y: pos.y });
          return true;
        }
        case "yellow": {
          bird.used = true;
          const ns = gold ? Math.max(sp * 2.6, 32) : Math.max(sp * 2.1, 26);
          bird.body.setLinearVelocity(V(vel.x / sp * ns, vel.y / sp * ns));
          bird.boost = this.time;
          this.emit("ability", { type: "yellow", x: pos.x, y: pos.y });
          return true;
        }
        case "black":
          bird.used = true;
          this.pending.push(() => this.explodeBird(bird));
          return true;
        case "white": {
          bird.used = true;
          this.spawnEgg(pos.x, pos.y - 0.7, vel.x * 0.15, -14, bird.tier);
          if (gold) this.spawnEgg(pos.x + 0.7, pos.y - 0.9, vel.x * 0.3, -13, bird.tier);
          bird.body.setLinearVelocity(V(Math.max(vel.x, 4) * 1.3 + 4, 13));
          this.emit("ability", { type: "white", x: pos.x, y: pos.y });
          return true;
        }
        case "red":
        case "big":
          // golden armour: a battle cry that shoves everything nearby
          if (!gold) return false;
          bird.used = true;
          this.explode(pos.x + 1.5, pos.y, bird.type === "big" ? 4 : 3.4, 26, 8, null, true);
          this.emit("ability", { type: bird.type, x: pos.x, y: pos.y, cry: true });
          return true;
      }
      return false;
    }

    explodeBird(bird) {
      if (bird.dead) return;
      const p = bird.body.getPosition();
      const k = TIERS.dmg[bird.tier || 0];
      this.kill(bird);
      if (bird.egg) this.explode(p.x, p.y, 3.0, 24, 36 * k, null);
      else this.explode(p.x, p.y, 3.0 * (1 + 0.05 * bird.tier), 28, 34 * k, "black");
    }

    explode(x, y, R, strength, dmg, birdType, cry) {
      this.emit("explode", { x, y, r: R, cry: !!cry });
      for (const e of this.ents) {
        if (e.dead || !e.body || e.kind === "rock") continue;
        if (cry && e.kind === "bird") continue;
        const p = e.body.getPosition();
        const dx = p.x - x, dy = p.y - y;
        const d = Math.hypot(dx, dy);
        if (d > R) continue;
        const f = 1 - d / R;
        const m = Math.sqrt(Math.max(0.2, e.body.getMass()));
        const nx = d > 0.01 ? dx / d : 0, ny = d > 0.01 ? dy / d : 1;
        e.body.applyLinearImpulse(V(nx * strength * f * m, (ny + 0.3) * strength * f * m), p, true);
        if (e.kind === "block" || e.kind === "pig") {
          let k = 1;
          if (birdType && e.kind === "block") k = BIRDS[birdType].mult[e.mat];
          this.damage(e, dmg * f * k);
        }
      }
    }

    /* ---------- contacts and damage ---------- */

    preSolve(c) {
      if (!this.damageOn) return;
      const ba = c.getFixtureA().getBody(), bb = c.getFixtureB().getBody();
      const wm = c.getWorldManifold(null);
      if (!wm) return;
      let approach = 0;
      const n = wm.normal;
      for (let i = 0; i < c.getManifold().pointCount; i++) {
        const p = wm.points[i];
        const va = ba.getLinearVelocityFromWorldPoint(p);
        const vb = bb.getLinearVelocityFromWorldPoint(p);
        approach = Math.max(approach, -((vb.x - va.x) * n.x + (vb.y - va.y) * n.y));
      }
      c.approach = approach;
    }

    postSolve(c, imp) {
      if (!this.damageOn || !(c.approach > HIT_SPEED)) return;
      let J = 0;
      for (let i = 0; i < c.getManifold().pointCount; i++) J += imp.normalImpulses[i];
      c.approach = 0;   // one hit per touch, not one per solver step
      const ea = c.getFixtureA().getBody().getUserData();
      const eb = c.getFixtureB().getBody().getUserData();
      this.hit(ea, eb, J);
      this.hit(eb, ea, J);
    }

    hit(e, other, J) {
      if (!e || e.dead) return;
      if (e.kind === "bird") {
        if (!e.hit && J > 0.3) {
          e.hit = true;
          e.hitTime = this.time;
          if (e.egg) this.pending.push(() => this.explodeBird(e));
          this.emit("birdhit", { type: e.type, j: J, x: e.body.getPosition().x, y: e.body.getPosition().y, tier: e.tier });
        }
        return;
      }
      if (e.kind === "ground" || e.kind === "rock") return;
      let dmg = J;
      if (other && other.kind === "bird") {
        if (e.kind === "block") dmg *= BIRDS[other.type].mult[e.mat];
        dmg *= other.dmg || 1;
      }
      if (e.kind === "pig") dmg *= 1.2;
      dmg -= 0.35;
      if (dmg > 0) this.damage(e, dmg);
    }

    damage(e, dmg) {
      if (e.dead || dmg <= 0) return;
      const before = e.hp;
      e.hp -= dmg;
      const p = e.body.getPosition();
      if (e.kind === "block") {
        this.score += Math.round(Math.min(before, dmg) * 10);
        if (dmg > 0.8) this.emit("blockhit", { mat: e.mat, x: p.x, y: p.y, dmg });
      } else if (dmg > 0.5) {
        this.emit("pighit", { x: p.x, y: p.y });
      }
      if (e.hp <= 0) this.pending.push(() => this.destroy(e));
    }

    destroy(e) {
      if (e.dead) return;
      const p = e.body.getPosition();
      const pt = e.kind === "pig" ? PIG_SCORE : MATS[e.mat].score;
      this.score += pt;
      this.kill(e);
      if (e.kind === "pig") {
        this.pigCount--;
        const coins = PIGS[e.size].coins + (e.helmet ? HELMET_COINS : 0);
        this.coins += coins;
        this.emit("pigdie", { x: p.x, y: p.y, r: e.r, score: pt, coins });
        if (this.pigCount === 0 && !this.clearTime) this.clearTime = this.time;
      } else {
        this.emit("break", { e, x: p.x, y: p.y, angle: e.body.getAngle(), score: pt });
        if (e.mat === "tnt") this.explode(p.x, p.y, 2.8, 22, 30, null);
      }
    }

    kill(e) {
      if (e.dead) return;
      e.dead = true;
      e.deadX = e.body.getPosition().x;
      e.deadY = e.body.getPosition().y;
      this.world.destroyBody(e.body);
    }

    /* ---------- the loop ---------- */

    step() {
      this.world.step(DT);
      this.time += DT;
      let guard = 0;
      while (this.pending.length && guard++ < 200) this.pending.shift()();

      // remove what flew off the map
      for (const e of this.ents) {
        if (e.dead || !e.body || e.kind === "rock") continue;
        const p = e.body.getPosition();
        if (p.y < this.minY - 6 || p.x < -40 || p.x > this.maxX + 60) {
          if (e.kind === "pig") this.destroy(e); else this.kill(e);
        }
      }
      if (this.ents.length > 220) this.ents = this.ents.filter(e => !e.dead);

      // black bird goes off by itself shortly after hitting something
      for (const b of this.flying) {
        if (b.dead) continue;
        if (b.type === "black" && !b.egg && b.hit && !b.used && this.time - b.hitTime > 1.6) {
          b.used = true;
          this.explodeBird(b);
        }
      }

      // trail puffs behind the first bird until it hits something
      const lead = this.flying[0];
      if (lead && !lead.dead && !lead.hit && this.state === "flying") {
        const p = lead.body.getPosition();
        const last = this.trail[this.trail.length - 1];
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.75) {
          this.trail.push({ x: p.x, y: p.y, big: this.trail.length % 3 === 0 });
        }
      }

      // how much is still moving
      let maxV = 0;
      for (const e of this.ents) {
        if (e.dead || !e.body || e.kind === "rock" || !e.body.isAwake()) continue;
        const v = e.body.getLinearVelocity();
        const s = Math.hypot(v.x, v.y) + Math.abs(e.body.getAngularVelocity()) * 0.3;
        if (s > maxV) maxV = s;
      }
      this.quiet = maxV < 0.25 ? this.quiet + DT : 0;

      if (this.state === "flying") {
        const t = this.time - this.launchTime;
        const black = this.flying.find(b => b.type === "black" && !b.egg && !b.dead && !b.used);
        if (this.pigCount === 0 && (this.quiet > 0.5 || this.time - this.clearTime > 3)) {
          this.endTurn();
          this.win();
        } else if (!black && ((this.quiet > 0.8 && t > 1) || t > 14)) {
          this.endTurn();
          if (this.pigCount === 0) this.win();
          else if (!this.loadNext()) this.lose();
        } else if (black && t > 14) {
          black.used = true;
          this.explodeBird(black);
        }
      } else if (this.state === "bonus") {
        // remaining birds are counted one by one
        if (this.time - this.bonusTick > 0.55) {
          this.bonusTick = this.time;
          if (this.bonusLeft.length) {
            const idx = this.bonusLeft.shift();
            this.score += BIRD_BONUS;
            this.emit("bonus", { idx, score: BIRD_BONUS });
          } else {
            this.state = "won";
            this.emit("won", { score: this.score });
          }
        }
      }
    }

    endTurn() {
      for (const b of this.flying) {
        if (!b.dead) {
          const p = b.body.getPosition();
          this.kill(b);
          this.emit("poof", { x: p.x, y: p.y });
        }
      }
      this.flying = [];
    }

    win() {
      if (this.state === "bonus" || this.state === "won") return;
      this.state = "bonus";
      this.bonusTick = this.time + 0.3;
      // birds still waiting: the one in the sling counts too
      const left = (this.loaded ? 1 : 0) + this.queue.length;
      this.bonusLeft = [];
      for (let i = 0; i < left; i++) this.bonusLeft.push(i);
      this.emit("clear", {});
    }

    lose() {
      this.state = "lost";
      this.loaded = null;
      this.emit("lost", { score: this.score });
    }

    birdsLeft() {
      return (this.loaded ? 1 : 0) + this.queue.length;
    }

    // Score needed for 2 and 3 stars.
    stars() {
      if (this.level.stars) return this.level.stars;
      let blocks = 0;
      for (const e of this.ents) {
        if (e.kind === "block") blocks += MATS[e.mat].score + e.maxHp * 10;
      }
      const pigs = this.level.items.filter(i => i[0] === "pig").length * PIG_SCORE;
      const spare = Math.max(0, this.level.birds.length - 1);
      const s2 = Math.round((pigs + blocks * 0.3) / 1000) * 1000;
      const s3 = Math.round((pigs + blocks * 0.5 + spare * BIRD_BONUS * 0.5) / 1000) * 1000;
      return [s2, Math.max(s2 + 5000, s3)];
    }
  }

  const API = { Game, BIRDS, PIGS, MATS, TIERS, SLING_H, MAX_PULL, MAX_SPEED, DT, planck: pl };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.FF = API;
})(typeof window !== "undefined" ? window : globalThis);
