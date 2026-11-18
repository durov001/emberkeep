// Screenshot mode: ?shot=cover|start|fork|victory&seed=7 stages a fixed,
// deterministic scene and freezes it, so the captured frame is the same on
// every run. The game loop does not advance time in shot mode; a fixed
// shotTime drives the flame flicker. window.__shotReady is set after the
// first staged frame is painted.

import { makeRng } from './rng.js';
import { makeWorld } from './world.js';
import { makeEnemy, makeBoss } from './enemies.js';
import { ENEMY_COLORS } from './render.js';
import { relicById } from './relics.js';
import { forkPair } from './realms.js';

export function getShotParam() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  const seed = parseInt(params.get('seed') || '7', 10);
  return { shot, seed: Number.isFinite(seed) ? seed : 7 };
}

function colorize(e) {
  const c = ENEMY_COLORS[e.kind] || ENEMY_COLORS.wisp;
  e.color = c.color;
  e.rim = c.rim;
  e.eyeColor = c.eye;
  return e;
}

function stagedPlayer(game, x, y, light, hp) {
  game.player.x = x;
  game.player.y = y;
  game.player.light = light;
  game.player.hp = hp;
  game.player.iframes = 0;
}

function giveRelics(game, ids) {
  game.relics = ids.slice();
  game.computeStats();
}

export function stageShot(game, param) {
  const { shot, seed } = param;
  const rng = makeRng(seed);
  game.shotMode = true;
  game.shotTime = 1.7;
  game.rng = rng;

  if (shot === 'cover') {
    // Night 7, The Hollow: Gloommaw + full HUD + kindle choice, frozen.
    game.difficulty = 'ember';
    game.night = 7;
    // No Bright Oath here on purpose: the cover prompt must read the base
    // cost, "KINDLE [F] — 25 LIGHT". Twin Sparks still shows as a synergy.
    giveRelics(game, ['emberglass', 'quickhands', 'shatterspark', 'widewick', 'gloombane', 'copperlantern', 'kindledheart']);
    game.startNightState(7, rng, { hpMul: 1, dmgMul: 1 });
    stagedPlayer(game, 420, 400, 62, 78);
    game.player.maxHp = game.stats.maxHp;
    game.kills = 148;
    game.combo = 5;
    game.comboTimer = 2.1;
    game.score = 2840;
    game.player.ember = 132;
    game.player.dashCharges = 2;
    game.player.novaCd = 4.2;

    // One lit brazier (sanctuary, left) and one unlit brazier near the player.
    const [b1, b2] = game.world.braziers;
    b1.x = 180; b1.y = 300; b1.lit = true;
    b2.x = 560; b2.y = 470; b2.lit = false;
    game.world.braziers = game.world.braziers.slice(0, 4);
    game.world.braziers[2].x = 1040; game.world.braziers[2].y = 180; game.world.braziers[2].lit = false;
    game.world.braziers[3].x = 1050; game.world.braziers[3].y = 560; game.world.braziers[3].lit = false;

    // Gloommaw, wounded, phase 1, center-right — close enough that the
    // fight reads as one scene with the player.
    const boss = colorize(makeBoss('gloommaw', 800, 360, 1, 1));
    boss.hp = boss.maxHp * 0.62;
    game.world.boss = boss;
    game.world.bossSpawned = true;
    game.enemies = [boss];
    // Flanking shadows from the dark.
    const flank = [
      ['wisp', 1080, 200], ['wisp', 1120, 470], ['crawler', 980, 600],
      ['spitter', 1120, 330], ['brute', 240, 580], ['splitter', 150, 150],
      ['wisp', 640, 220], ['crawler', 300, 250],
    ];
    for (const [kind, x, y] of flank) {
      const e = colorize(makeEnemy(kind, x, y, 1, 1));
      if (kind === 'crawler') e.hp = e.maxHp * 0.55;
      game.enemies.push(e);
    }
    // Sparks mid-flight toward the boss, ember pickups, a nova ring echo,
    // and burning ground from Ember Glass.
    game.sparks = [
      { x: 540, y: 380, vx: 520, vy: -10, damage: 12, pierce: 1, life: 0.6 },
      { x: 580, y: 405, vx: 520, vy: 8, damage: 12, pierce: 1, life: 0.6 },
      { x: 620, y: 365, vx: 520, vy: -14, damage: 12, pierce: 1, life: 0.6 },
      { x: 500, y: 350, vx: 480, vy: -40, damage: 12, pierce: 1, life: 0.6 },
      { x: 660, y: 395, vx: 520, vy: 4, damage: 12, pierce: 1, life: 0.6 },
      { x: 560, y: 430, vx: 500, vy: 30, damage: 12, pierce: 1, life: 0.6 },
    ];
    game.world.embers = [
      { x: 380, y: 300 }, { x: 520, y: 520 }, { x: 700, y: 480 }, { x: 300, y: 430 },
      { x: 640, y: 300 }, { x: 420, y: 480 },
    ];
    game.burningGround = [{ x: 620, y: 470, r: 110, life: 3 }];
    game.novaFx = [{ x: 420, y: 400, r: 150, alpha: 0.7 }];
    game.floaters = [
      { x: 800, y: 265, text: '-24', color: '#ffd166', life: 0.9 },
      { x: 980, y: 560, text: '-18', color: '#ffd166', life: 0.7 },
    ];
    game.showScreen('play');
    game.promptBrazier = b2;
  } else if (shot === 'start') {
    // Title screen over a quiet Night 1 arena.
    game.night = 1;
    game.best = { score: 2840, night: 7, kills: 212 };
    game.meta.ember = 240;
    game.meta.workshop = { vitality: 2, wickcraft: 1, sparkforge: 2, swiftfoot: 0 };
    game.startNightState(1, rng, { hpMul: 1, dmgMul: 1 });
    stagedPlayer(game, 640, 380, 80, 100);
    game.world.braziers[0].x = 320; game.world.braziers[0].y = 300; game.world.braziers[0].lit = true;
    game.world.braziers[1].x = 960; game.world.braziers[1].y = 420; game.world.braziers[1].lit = false;
    game.enemies = [
      colorize(makeEnemy('wisp', 980, 200, 1, 1)),
      colorize(makeEnemy('wisp', 220, 480, 1, 1)),
      colorize(makeEnemy('crawler', 1080, 540, 1, 1)),
    ];
    game.showScreen('start');
  } else if (shot === 'fork') {
    // Fork after Night 4: two routes, current build, realm preview.
    game.night = 4;
    giveRelics(game, ['widewick', 'quickhands', 'kindledheart', 'copperlantern']);
    game.kills = 96;
    game.score = 1710;
    game.player.ember = 88;
    game.forkOptions = forkPair(4, rng);
    game.startNightState(4, rng, { hpMul: 1, dmgMul: 1 });
    stagedPlayer(game, 640, 380, 55, 64);
    game.world.braziers[0].x = 320; game.world.braziers[0].y = 300; game.world.braziers[0].lit = true;
    game.showScreen('fork');
  } else if (shot === 'victory') {
    // Victory recap after Night 7.
    game.night = 7;
    giveRelics(game, ['emberglass', 'brightoath', 'quickhands', 'shatterspark', 'widewick', 'gloombane', 'kindledheart']);
    game.kills = 212;
    game.score = 4860;
    game.player.ember = 210;
    game.runTime = 632;
    game.victoryStats = {
      nights: 7, kills: 212, relics: game.relics.map((id) => relicById(id).name),
      ember: 210, score: 4860, time: '10:32', difficulty: 'Ember',
    };
    game.startNightState(7, rng, { hpMul: 1, dmgMul: 1 });
    stagedPlayer(game, 640, 380, 90, 100);
    game.world.braziers.forEach((b) => { b.lit = true; });
    game.showScreen('victory');
  } else {
    return false;
  }

  game.updateHud();
  game.renderFrame();
  window.__shotReady = true;
  return true;
}
