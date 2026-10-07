# Feather Fury

A slingshot physics game in the style of Angry Birds. Pull back the slingshot, fling the birds and bring down the pigs' towers of wood, glass and stone.

## Play

**https://renyxwebdesigning.github.io/Angrybirds_bruh/**

It runs in any browser, phones included (hold the phone sideways). To play offline, download the repo and open `index.html`, or run `python3 -m http.server` in the folder and go to http://localhost:8000.

## How to play

- **Aim:** drag the bird in the slingshot backwards and let go. The further you pull, the harder it flies.
- **Bird ability:** tap (or press Space) while the bird is in the air.
- **Win:** pop every pig. Every bird you have left is worth 10,000 points.
- **Stars:** 1 for clearing the level, 2 or 3 for a high score. Clearing a level unlocks the next one.
- **Keys:** `R` restarts, `Esc` pauses.

| Bird | Ability | Strong against |
|---|---|---|
| Red | none, the all-rounder | everything a bit |
| Blue | splits into three | glass |
| Yellow | shoots forward at double speed | wood |
| Black | explodes (tap, or it goes off by itself after a hit) | stone |
| White | drops an egg bomb straight down and flies off | anything below it |
| Big red | heavy, rolls through walls | everything |

Pigs come in small, medium, large, with a helmet, and a king. TNT crates explode when they get hit.

## 15 levels

1–3 red birds · 4–6 the blue birds · 7–9 the yellow birds and TNT · 10–12 the black birds and stone · 13–15 the white birds and the king pig's castle.

## Under the hood

Plain HTML/JavaScript, no build step. Physics is [planck.js](https://github.com/piqnt/planck.js) (Box2D). All graphics are drawn in code and all sounds are synthesized in the browser, so there are no image or audio files.

| File | What it does |
|---|---|
| `js/core.js` | rules and physics: slingshot, damage, abilities, scoring, turns |
| `js/levels.js` | the 15 levels |
| `js/art.js` | drawing of birds, pigs, blocks and scenery |
| `js/audio.js` | sound effects |
| `js/main.js` | menus, camera, input, effects |
| `tools/check.js` | `node tools/check.js` checks that every level stands still on its own and that a bot can win it |
| `tools/difficulty.js` | how often a random first shot wins each level |

Fan project, not affiliated with Rovio or Angry Birds.
