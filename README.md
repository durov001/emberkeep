# EMBERKEEP

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/durov001/emberkeep/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/durov001/emberkeep/reward.svg)](https://make.fun/bounty/best-game-01)

Keep the last flame alive through ten waves of dark.

You are the Last Ember, a living flame alone in a drowned arena. Your light
is your weapon: shadow creatures burn inside your glow, and beyond it they
are almost invisible — the dark hides what hunts you. Survive ten waves,
choose a blessing of the flame between each, and slay the Gloommaw.

- **Light as a weapon** — enemies inside your light radius take burn damage
  and are fully visible; outside it they are dim silhouettes with glowing eyes.
- **Five shadow kinds** — drifting Wisps, fast Crawlers, orb-spitting
  Spitters, huge Brutes, and Splitters that break apart when killed.
- **A boss with phases** — the Gloommaw summons minions and telegraphs a
  devastating charge attack.
- **Fourteen upgrades** — wider light, fiercer burn, extra dashes, a
  stronger nova, regeneration, and more; pick 1 of 3 after every wave.
- **A full loop** — title screen, HUD with wave progress and an incoming
  panel, combo multiplier, dash and nova, pause, victory and game-over
  screens with run stats and a best score that persists.
- **Synthesized sound** — every effect is made with the Web Audio API.
  No audio files, no images, no network: the whole game is code on canvas.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. WASD or arrows to
move, mouse to aim (sparks fire on their own), SPACE to dash, E for the
pulse nova, P to pause, M to mute.

## Layout

- `game/index.html` — the page shell
- `game/src/main.js` — boot and the fixed-step game loop
- `game/src/world.js` — simulation: waves, combat, the boss, upgrades
- `game/src/render.js` — all canvas drawing: arena, HUD, menus
- `game/src/tuning.js` — every balance number in one place
- `game/src/sound.js` — Web Audio synthesis
- `game/src/input.js` — keyboard and mouse
- `game/src/rng.js` — seeded random numbers
- `game/src/shots.js` — deterministic staging for the screenshots

Entry for the make.fun best-game-01 bounty — [make.fun](https://make.fun) · referral code `zsk0hsg3`.
