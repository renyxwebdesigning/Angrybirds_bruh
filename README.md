# Feather Fury

A slingshot physics game in the style of Angry Birds. Pull back the slingshot, fling the birds and bring down the pigs' towers of wood, glass and stone.

## Play

**https://renyxwebdesigning.github.io/Angrybirds_bruh/**

It runs in any browser, phones included (hold the phone sideways). To play offline, download the repo and open `index.html`, or run `python3 -m http.server` in the folder and go to http://localhost:8000.

## How to play

- **Aim:** drag the bird in the slingshot backwards and let go. The further you pull, the harder it flies.
- **Bird ability:** tap (or press Space) while the bird is in the air.
- **Win:** pop every pig. Every bird you have left is worth 10,000 points.
- **Stars:** 1 for clearing the level, 2 or 3 for a high score. Clearing a level unlocks the next one, and the boss level (x-20) unlocks the next world.
- **Coins:** every pig you pop pays coins (helmet pigs, bosses and the king pay more), plus a small bonus for new stars. Spend them in the **Shop**.
- **Keys:** `R` restarts, `Esc` pauses.

## 5 worlds, 100 levels, a story

| World | Look | New bird |
|---|---|---|
| 1. Meadow Valley | green hills, oak trees | Red, then The Blues from 1-9 |
| 2. Scorched Canyon | desert, mesas, cacti | Dash (yellow) |
| 3. Frostpeak | snowy mountains, pines, ice blocks | Boomer (black) |
| 4. Coral Coast | beach at sunset, palms, the sea | Matron (white) |
| 5. Mount Cinder | night, an erupting volcano, lava | Big Brother, and the King Pig |

A short comic scene plays before the first world, between every two worlds and after the King Pig falls.

## Upgrades

| Upgrade | Levels | What it does |
|---|---|---|
| Slingshot | 5 | wooden → rope-wrapped → iron → steel → bronze → gold, up to +30% launch power |
| Aiming sight | 5 | longer aiming line (6 → 60 dots) |
| Each bird | 5 | 1 bigger · 2 leather helmet (+damage) · 3 iron chest plate (heavier) · 4 spiked steel helmet (bigger, more damage) · 5 golden armour with a super ability |

Golden abilities: Red and Big Brother get a battle cry that shoves everything ahead, The Blues split into five, Dash dashes much harder, Boomer's blast grows, Matron drops two eggs.

| Bird | Ability | Strong against |
|---|---|---|
| Red | none (battle cry when golden) | everything a bit |
| The Blues | split into three | glass and ice |
| Dash | dash forward | wood |
| Boomer | explodes (tap, or by itself after a hit) | stone |
| Matron | drops an egg bomb and flies off | anything below it |
| Big Brother | heavy, rolls through walls | everything |

## Under the hood

Plain HTML/JavaScript, no build step. Physics is [planck.js](https://github.com/piqnt/planck.js) (Box2D). All graphics (including the wood, stone and ice textures) are generated in code and all sounds are synthesized in the browser, so there are no image or audio files. Progress, coins and upgrades are saved in the browser.

| File | What it does |
|---|---|
| `js/core.js` | rules and physics: terrain, slingshot, damage, abilities, upgrades, coins, turns |
| `js/worlds.js` | the 5 worlds and the level generator (terrain + structures from a seed) |
| `js/seeds.js` | the checked seed and star scores of all 100 levels (generated) |
| `js/art.js` | textures, birds with their armour, pigs, blocks, slingshots, terrain, props, world backdrops |
| `js/story.js` | the story scenes |
| `js/audio.js` | sound effects |
| `js/main.js` | menus, world map, shop, camera, input, effects |
| `tools/check.js` | finds a seed per level that stands still on its own and that a bot wins **without upgrades**, then `node tools/check.js merge` writes `js/seeds.js` |

Fan project, not affiliated with Rovio or Angry Birds.
