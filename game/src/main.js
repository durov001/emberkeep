// EMBERKEEP — main: boot, the fixed-step game loop, and the state machine
// that turns keys and clicks into starts, pauses, upgrades and restarts.
// In screenshot mode (?shot=...) it stages one deterministic scene, paints
// a single frame, and sets window.__shotReady instead of looping.

import { VIEW } from './tuning.js';
import {
  applyUpgrade, createWorld, startRun, updateWorld,
} from './world.js';
import { render, upgradeCardRects } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './sound.js';
import { parseShotQuery, stageShot } from './shots.js';

/** Fixed simulation step: 60 ticks a second, whatever the display does. */
const STEP = 1 / 60;
/** Most steps a frame may run before the loop sheds the backlog. */
const MAX_STEPS = 5;

function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const sound = new SoundBank();
  let muted = false;

  // Audio needs a user gesture: wake the context on the first of any.
  const wake = () => sound.ensure();
  window.addEventListener('keydown', wake);
  window.addEventListener('pointerdown', wake);

  // --- screenshot mode: one staged frame, then stop ---
  const shot = parseShotQuery();
  if (shot) {
    const world = stageShot(shot.name, shot.seed);
    const input = new Input(canvas);
    input.mouseX = VIEW.width / 2 + 180;
    input.mouseY = VIEW.height / 2 - 60;
    render(ctx, world, input);
    window.__shotReady = true;
    window.__emberkeep = { world, shot: shot.name };
    return;
  }

  // --- normal play ---
  const seed = (Date.now() % 2147483647) || 1;
  const world = createWorld(seed);
  const input = new Input(canvas);
  window.__emberkeep = { world };

  /** Keys and clicks that act on the menu states (checked once a frame). */
  function handleMenuKeys() {
    if (input.wasPressed('KeyM')) {
      muted = !muted;
      sound.setMuted(muted);
    }
    if (world.state === 'title') {
      if (input.wasPressed('Space') || input.wasClicked()) {
        sound.ensure();
        sound.click();
        startRun(world);
        sound.waveHorn();
      }
      return;
    }
    if (world.state === 'playing') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
        world.state = 'paused';
        sound.click();
      }
      return;
    }
    if (world.state === 'paused') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape') || input.wasClicked()) {
        world.state = 'playing';
        sound.click();
      } else if (input.wasPressed('KeyR')) {
        startRun(world);
        sound.waveHorn();
      }
      return;
    }
    if (world.state === 'upgrade') {
      const keys = ['Digit1', 'Digit2', 'Digit3'];
      for (let i = 0; i < 3; i++) {
        if (input.wasPressed(keys[i]) && world.upgradeChoices[i]) {
          applyUpgrade(world, world.upgradeChoices[i].id, sound);
          return;
        }
      }
      if (input.wasClicked()) {
        const rects = upgradeCardRects();
        for (let i = 0; i < 3; i++) {
          const r = rects[i];
          if (input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h) {
            if (world.upgradeChoices[i]) applyUpgrade(world, world.upgradeChoices[i].id, sound);
            return;
          }
        }
      }
      return;
    }
    if (world.state === 'victory' || world.state === 'gameover') {
      if (input.wasPressed('Space') || input.wasClicked()) {
        sound.ensure();
        sound.click();
        startRun(world);
        sound.waveHorn();
      }
    }
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const frameDt = Math.min(0.1, (now - last) / 1000);
    last = now;
    handleMenuKeys();
    // The flame flickers even on menus, where the simulation does not run.
    if (world.state !== 'playing') world.animTime += frameDt;
    acc += frameDt;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      updateWorld(world, input, sound, STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0;
    render(ctx, world, input);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
