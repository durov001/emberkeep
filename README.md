# EMBERKEEP v2

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/durov001/emberkeep/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/durov001/emberkeep/reward.svg)](https://make.fun/bounty/best-game-01)

**Guard the Last Ember through 7 Nights in 3 Realms — light is your weapon and your currency.**

Entry for the make.fun best-game-01 bounty — [make.fun](https://make.fun) · referral code `zsk0hsg3`.

## How to play

You are the Last Ember, a living flame. Survive 7 nights of shadows, then slay **Gloommaw** on Night 7.

- **WASD / Arrows** — move. **Mouse** — aim. Sparks auto-fire at the nearest shadow.
- **SPACE** — dash (2 charges, brief invulnerability). **E** — nova blast. **P** — pause. **M** — mute.
- **F — KINDLE.** Light a brazier to burn every shadow inside its radius for the rest of the night. It costs **25 LIGHT** — and your glow and spark damage shrink with your light. Spend light to hold ground, or keep it to kill.
- **Kills** restore LIGHT. **Ember** pickups restore LIGHT and bank currency for the Workshop.
- After each night, **draft 1 of 3 relics**. After Nights 2, 4 and 6, **the road forks**: pick one of two routes — every reward names its danger.
- **Win:** kill Gloommaw on Night 7. **Lose:** your HP reaches 0. After victory, **Endless** mode scales +15% per night.

## What is in the game

- **7 nights, 3 realms** — Ember Wastes (Nights 1–2, ember veins), Gloomwood (Nights 3–5, thorn patches), The Hollow (Nights 6–7, void rifts), each with its own palette, decor and hazard.
- **5 enemy kinds** with distinct silhouettes — Wisp, Crawler, Spitter, Splitter (bursts into 2 wisps), Brute — plus the **Hollow Warden** mid-boss (Night 4, radial bolt bursts) and **Gloommaw** (Night 7, 2 phases: wisp summons and charges).
- **12 relics**, drafted 1 of 3 after every night, with **2 named synergies**: Eternal Flame (Ember Glass + Bright Oath — lit braziers stay lit all run) and Twin Sparks (Quick Hands + Shatter Spark — every spark splits in two).
- **Ember Workshop** — 4 permanent upgrade tracks (Vitality, Wickcraft, Sparkforge, Swiftfoot), 5 levels each, bought with ember banked across runs and saved in localStorage.
- **3 difficulties** — Kindled (0.7x enemy strength), Ember (1x), Hollow (1.4x, +30% score).
- **Full screens** — Start (title, win/lose, controls, difficulty, workshop, best run), Play (dense HUD: HP/LIGHT, night, score, combo, relics, synergies, boss bar), Relic draft, Fork, Pause, Victory (campaign recap + workshop unlock + Endless), Defeat (stats + restart).
- **Synthesized sound** — every effect (shoot, hit, kill, dash, nova, kindle, boss, win, lose) is generated live with Web Audio. No audio files.
- **All art drawn in code** — canvas shapes, gradients and procedural flames. No images, no emoji, no network requests.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshot modes (deterministic, seeded): `?shot=cover|start|fork|victory&seed=7`.

## Structure

- `game/index.html`, `game/style.css` — shell and theme.
- `game/src/main.js` — loop, state machine, combat, screens, HUD.
- `game/src/world.js` — arena, spawn director, hazards. `game/src/realms.js` — the 3 realms and fork routes.
- `game/src/enemies.js` — 5 kinds + 2 bosses. `game/src/relics.js` — 12 relics, draft, synergies.
- `game/src/kindle.js` — braziers and the LIGHT meter. `game/src/render.js` — all canvas drawing.
- `game/src/tuning.js` — every number, with value/min/max/step. `game/src/rng.js` — seeded RNG.
- `game/src/input.js` — keyboard + mouse. `game/src/sound.js` — Web Audio synth.
- `game/src/shots.js` — deterministic screenshot staging.
- `main.ts` — copies `game/` + `screenshots/` to the output dir and writes `dossier.json`.
