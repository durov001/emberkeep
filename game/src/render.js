// Rendering: everything on the canvas is drawn in code — no images, no
// emoji. Each enemy kind has its own silhouette (see drawEnemy). The scene
// is drawn fully lit, then a darkness mask is laid over it with holes cut
// at every light source, so the light radius reads as a real mechanic.

import { ARENA } from './realms.js';
import { tv } from './tuning.js';
import { lightRadius } from './kindle.js';

const W = ARENA.w;
const H = ARENA.h;

// Offscreen canvas for the darkness mask.
let darkCanvas = null;
let darkCtx = null;

function getDarkCtx() {
  if (!darkCanvas) {
    darkCanvas = document.createElement('canvas');
    darkCanvas.width = W;
    darkCanvas.height = H;
    darkCtx = darkCanvas.getContext('2d');
  }
  return darkCtx;
}

export function drawScene(ctx, game, time) {
  const { world, player } = game;
  const realm = world.realm;
  drawGround(ctx, realm, world, time);
  drawHazards(ctx, world, time);
  drawDecor(ctx, world);
  drawBurningGround(ctx, game, time);
  drawEmbers(ctx, world, time);
  drawBraziers(ctx, world, time);
  for (const e of game.enemies) {
    if (!e.dead) drawEnemy(ctx, e, time);
  }
  drawProjectiles(ctx, game);
  drawSparks(ctx, game, time);
  drawPlayer(ctx, player, time, game);
  drawFx(ctx, game, time);
  drawDarkness(ctx, game, time);
  drawEyesInDark(ctx, game);
  drawFloaters(ctx, game);
  drawVignette(ctx);
}

function drawGround(ctx, realm, world, time) {
  ctx.fillStyle = realm.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = realm.ground;
  ctx.fillRect(ARENA.wall, ARENA.wall, W - ARENA.wall * 2, H - ARENA.wall * 2);
  // Stone tile seams.
  ctx.strokeStyle = realm.groundAlt;
  ctx.lineWidth = 2;
  const step = 96;
  for (let x = ARENA.wall; x < W - ARENA.wall; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, ARENA.wall);
    ctx.lineTo(x, H - ARENA.wall);
    ctx.stroke();
  }
  for (let y = ARENA.wall; y < H - ARENA.wall; y += step) {
    ctx.beginPath();
    ctx.moveTo(ARENA.wall, y);
    ctx.lineTo(W - ARENA.wall, y);
    ctx.stroke();
  }
  // Arena wall: dark stone with the realm's accent trim.
  ctx.strokeStyle = realm.accentDim;
  ctx.lineWidth = 6;
  ctx.strokeRect(ARENA.wall - 3, ARENA.wall - 3, W - (ARENA.wall - 3) * 2, H - (ARENA.wall - 3) * 2);
  ctx.strokeStyle = realm.accent;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(ARENA.wall + 8, ARENA.wall + 8, W - (ARENA.wall + 8) * 2, H - (ARENA.wall + 8) * 2);
  ctx.globalAlpha = 1;
}

function drawDecor(ctx, world) {
  const realm = world.realm;
  for (const d of world.decor) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.scale(d.s, d.s);
    if (d.kind === 'stones') {
      ctx.fillStyle = '#3a2c22';
      ctx.beginPath();
      ctx.moveTo(-22, 10);
      ctx.lineTo(-12, -14);
      ctx.lineTo(8, -18);
      ctx.lineTo(22, 4);
      ctx.lineTo(12, 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#57453a';
      ctx.beginPath();
      ctx.moveTo(-12, -14);
      ctx.lineTo(8, -18);
      ctx.lineTo(14, -4);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
    } else if (d.kind === 'trees') {
      ctx.strokeStyle = '#1c2f22';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.quadraticCurveTo(-8, 0, 10, -26);
      ctx.stroke();
      ctx.fillStyle = '#0f2a1c';
      ctx.beginPath();
      ctx.ellipse(12, -34, 26, 16, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#143823';
      ctx.beginPath();
      ctx.ellipse(2, -28, 18, 11, -0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Broken pillar.
      ctx.fillStyle = '#2a2138';
      ctx.fillRect(-12, -30, 24, 52);
      ctx.fillStyle = '#3a2c50';
      ctx.beginPath();
      ctx.moveTo(-12, -30);
      ctx.lineTo(-4, -42);
      ctx.lineTo(4, -34);
      ctx.lineTo(12, -44);
      ctx.lineTo(12, -30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1a1426';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -10);
      ctx.lineTo(2, 4);
      ctx.lineTo(-2, 16);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawHazards(ctx, world, time) {
  for (const hz of world.hazards) {
    if (hz.kind === 'vein') {
      if (hz.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(time * 2 + hz.x);
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * pulse;
      ctx.strokeStyle = '#ff8c2e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(hz.x - hz.r, hz.y + 6);
      ctx.quadraticCurveTo(hz.x - 10, hz.y - 8, hz.x + 4, hz.y + 2);
      ctx.quadraticCurveTo(hz.x + 18, hz.y + 10, hz.x + hz.r, hz.y - 4);
      ctx.stroke();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, 5 + 2 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (hz.kind === 'thorn') {
      ctx.save();
      ctx.fillStyle = 'rgba(30, 80, 50, 0.55)';
      ctx.beginPath();
      ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2fae6b';
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const px = hz.x + Math.cos(a) * hz.r * 0.7;
        const py = hz.y + Math.sin(a) * hz.r * 0.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a + 0.6) * 12, py + Math.sin(a + 0.6) * 12 - 6);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // Void rift: a swirling purple tear.
      const pulse = 1 + 0.12 * Math.sin(time * 2.4 + hz.pulse);
      ctx.save();
      ctx.translate(hz.x, hz.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#1a0b2e';
      ctx.beginPath();
      ctx.ellipse(0, 0, hz.r, hz.r * 0.62, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b98cff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, hz.r * 0.8, hz.r * 0.48, 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e6d6ff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawBurningGround(ctx, game, time) {
  for (const g of game.burningGround) {
    const a = Math.min(1, g.life / 1.5) * 0.5;
    ctx.save();
    ctx.globalAlpha = a;
    const grad = ctx.createRadialGradient(g.x, g.y, 4, g.x, g.y, g.r);
    grad.addColorStop(0, 'rgba(255, 140, 40, 0.9)');
    grad.addColorStop(1, 'rgba(255, 60, 10, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEmbers(ctx, world, time) {
  for (const em of world.embers) {
    const bob = Math.sin(time * 4 + em.x) * 2;
    ctx.save();
    ctx.shadowColor = '#ff9a2e';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffc46b';
    ctx.beginPath();
    ctx.arc(em.x, em.y + bob, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(em.x - 1, em.y + bob - 1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBraziers(ctx, world, time) {
  for (const b of world.braziers) {
    // Stone ring.
    ctx.fillStyle = '#4a3b30';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e231c';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 23, 0, Math.PI * 2);
    ctx.fill();
    // Stones around the rim.
    ctx.fillStyle = '#5d4a3c';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(a) * 27, b.y + Math.sin(a) * 27, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.lit) {
      drawFlame(ctx, b.x, b.y - 6, 16, time + b.flame);
      // Burn radius ring, faint.
      ctx.save();
      ctx.globalAlpha = 0.14 + 0.05 * Math.sin(time * 2 + b.flame);
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, tv('brazierBurnRadius'), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      // Cold bowl: faint smoke curl.
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#9a8a7a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 10);
      ctx.quadraticCurveTo(b.x + 6, b.y - 26, b.x - 2, b.y - 38);
      ctx.stroke();
      ctx.restore();
      // Unlit marker: small hollow diamond above the bowl.
      ctx.save();
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 3);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 52);
      ctx.lineTo(b.x + 7, b.y - 43);
      ctx.lineTo(b.x, b.y - 34);
      ctx.lineTo(b.x - 7, b.y - 43);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }
}

// A code-drawn flame: layered teardrops, flickering with time.
export function drawFlame(ctx, x, y, s, time) {
  const flick = 1 + 0.12 * Math.sin(time * 11) + 0.06 * Math.sin(time * 23 + 1);
  const w = s * flick;
  const h = s * 1.7 * flick;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = '#ff8c2e';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ff5a1e';
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.bezierCurveTo(w * 0.9, -h * 0.45, w * 0.75, h * 0.3, 0, h * 0.42);
  ctx.bezierCurveTo(-w * 0.75, h * 0.3, -w * 0.9, -h * 0.45, 0, -h);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.62);
  ctx.bezierCurveTo(w * 0.55, -h * 0.25, w * 0.45, h * 0.3, 0, h * 0.4);
  ctx.bezierCurveTo(-w * 0.45, h * 0.3, -w * 0.55, -h * 0.25, 0, -h * 0.62);
  ctx.fill();
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.12, w * 0.28, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, player, time, game) {
  ctx.save();
  ctx.translate(player.x, player.y);
  // Dash trail.
  for (let i = 0; i < game.trail.length; i++) {
    const t = game.trail[i];
    ctx.globalAlpha = (i / game.trail.length) * 0.35;
    ctx.fillStyle = '#ff9a2e';
    ctx.beginPath();
    ctx.arc(t.x - player.x, t.y - player.y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Coal body.
  ctx.fillStyle = '#1c1410';
  ctx.beginPath();
  ctx.arc(0, 4, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff8c2e';
  ctx.lineWidth = 2;
  ctx.stroke();
  // The flame itself.
  drawFlame(ctx, 0, -6, 16, time);
  // I-frames shimmer.
  if (player.iframes > 0) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#fff3d6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Each enemy kind gets a silhouette nobody else shares — the outline is the
// read at thumbnail size.
function drawEnemy(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.hitFlash > 0;
  const burn = e.burning > 0;
  ctx.fillStyle = flash ? '#ffffff' : e.color;
  ctx.strokeStyle = e.rim;
  ctx.lineWidth = 2;

  if (e.kind === 'wisp') {
    // Ghost teardrop with a trailing tail.
    ctx.beginPath();
    ctx.moveTo(0, -e.r);
    ctx.bezierCurveTo(e.r, -e.r * 0.4, e.r * 0.8, e.r * 0.6, 0, e.r * 1.1);
    ctx.bezierCurveTo(-e.r * 0.8, e.r * 0.6, -e.r, -e.r * 0.4, 0, -e.r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : '#d9c8ff';
    ctx.beginPath();
    ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
    ctx.arc(4, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'crawler') {
    // Low beetle with legs.
    ctx.beginPath();
    ctx.ellipse(0, 0, e.r, e.r * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = e.rim;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 10, -6);
      ctx.lineTo(i * 14, -e.r - 6);
      ctx.moveTo(i * 10, 6);
      ctx.lineTo(i * 14, e.r + 6);
      ctx.stroke();
    }
    ctx.fillStyle = flash ? '#ffffff' : '#ffe08a';
    ctx.beginPath();
    ctx.arc(-6, -4, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'spitter') {
    // Round blob with a snout tube.
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-4, -e.r - 8, 8, 12);
    ctx.fillStyle = flash ? '#ffffff' : '#ff5ad0';
    ctx.beginPath();
    ctx.arc(0, -e.r - 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c0a18';
    ctx.beginPath();
    ctx.arc(-5, -1, 3, 0, Math.PI * 2);
    ctx.arc(5, -1, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'splitter') {
    // Lumpy cluster of three circles.
    ctx.beginPath();
    ctx.arc(-8, 4, e.r * 0.62, 0, Math.PI * 2);
    ctx.arc(8, 4, e.r * 0.62, 0, Math.PI * 2);
    ctx.arc(0, -8, e.r * 0.66, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : '#ffd166';
    ctx.beginPath();
    ctx.arc(-6, -2, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'brute') {
    // Square-shouldered hulk with horns.
    ctx.beginPath();
    ctx.moveTo(-e.r, -e.r * 0.4);
    ctx.lineTo(-e.r * 0.7, -e.r);
    ctx.lineTo(e.r * 0.7, -e.r);
    ctx.lineTo(e.r, -e.r * 0.4);
    ctx.lineTo(e.r * 0.85, e.r * 0.8);
    ctx.lineTo(-e.r * 0.85, e.r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = e.rim;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.7, -e.r * 0.9);
    ctx.quadraticCurveTo(-e.r * 1.2, -e.r * 1.5, -e.r * 1.35, -e.r * 0.9);
    ctx.moveTo(e.r * 0.7, -e.r * 0.9);
    ctx.quadraticCurveTo(e.r * 1.2, -e.r * 1.5, e.r * 1.35, -e.r * 0.9);
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : '#ff6b5e';
    ctx.beginPath();
    ctx.arc(-8, -6, 3.5, 0, Math.PI * 2);
    ctx.arc(8, -6, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'warden') {
    // Tall hooded figure with a staff.
    ctx.beginPath();
    ctx.moveTo(0, -e.r * 1.3);
    ctx.bezierCurveTo(e.r * 0.9, -e.r * 0.6, e.r * 0.8, e.r * 0.8, e.r * 0.5, e.r);
    ctx.lineTo(-e.r * 0.5, e.r);
    ctx.bezierCurveTo(-e.r * 0.8, e.r * 0.8, -e.r * 0.9, -e.r * 0.6, 0, -e.r * 1.3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#4de8a8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(e.r * 0.9, -e.r * 0.8);
    ctx.lineTo(e.r * 0.9, e.r);
    ctx.stroke();
    ctx.fillStyle = '#a8ffda';
    ctx.beginPath();
    ctx.arc(e.r * 0.9, -e.r * 0.9, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#a8ffda';
    ctx.beginPath();
    ctx.arc(-7, -e.r * 0.55, 4, 0, Math.PI * 2);
    ctx.arc(7, -e.r * 0.55, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'gloommaw') {
    // The maw: a huge ring of teeth around a dark gullet.
    const breathe = 1 + 0.05 * Math.sin(time * 1.6);
    ctx.scale(breathe, breathe);
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Horns.
    ctx.strokeStyle = e.rim;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.6, -e.r * 0.75);
    ctx.quadraticCurveTo(-e.r * 1.1, -e.r * 1.4, -e.r * 0.9, -e.r * 0.4);
    ctx.moveTo(e.r * 0.6, -e.r * 0.75);
    ctx.quadraticCurveTo(e.r * 1.1, -e.r * 1.4, e.r * 0.9, -e.r * 0.4);
    ctx.stroke();
    // Open maw.
    ctx.fillStyle = flash ? '#ffffff' : '#3d0a12';
    ctx.beginPath();
    ctx.ellipse(0, e.r * 0.18, e.r * 0.62, e.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.15 + (i / 6) * 0.7);
      const tx = Math.cos(a) * e.r * 0.55;
      const ty = e.r * 0.18 + Math.sin(a) * e.r * 0.42;
      ctx.beginPath();
      ctx.moveTo(tx - 6, ty - 4);
      ctx.lineTo(tx, ty + 12);
      ctx.lineTo(tx + 6, ty - 4);
      ctx.closePath();
      ctx.fill();
    }
    // Eyes above the maw.
    ctx.fillStyle = flash ? '#ffffff' : '#ff3b30';
    ctx.beginPath();
    ctx.arc(-e.r * 0.32, -e.r * 0.42, 7, 0, Math.PI * 2);
    ctx.arc(e.r * 0.32, -e.r * 0.42, 7, 0, Math.PI * 2);
    ctx.fill();
    // Phase 2: cracked, burning crown.
    if (e.phase === 2) {
      ctx.strokeStyle = '#ff5a1e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.3, -e.r * 0.8);
      ctx.lineTo(-e.r * 0.1, -e.r * 0.55);
      ctx.lineTo(-e.r * 0.25, -e.r * 0.3);
      ctx.moveTo(e.r * 0.3, -e.r * 0.8);
      ctx.lineTo(e.r * 0.1, -e.r * 0.55);
      ctx.lineTo(e.r * 0.25, -e.r * 0.3);
      ctx.stroke();
    }
  }

  // Burning enemies flicker orange.
  if (burn) {
    ctx.fillStyle = `rgba(255, 140, 40, ${0.4 + 0.3 * Math.sin(time * 18)})`;
    ctx.beginPath();
    ctx.arc(0, -e.r * 0.5, e.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small HP bar for wounded non-boss enemies.
  if (!e.boss && e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-e.r, -e.r - 12, e.r * 2, 5);
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(-e.r, -e.r - 12, (e.r * 2 * e.hp) / e.maxHp, 5);
  }
  ctx.restore();
}

function drawProjectiles(ctx, game) {
  for (const p of game.projectiles) {
    ctx.save();
    ctx.shadowColor = '#c86bff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#d9a0ff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSparks(ctx, game, time) {
  for (const s of game.sparks) {
    ctx.save();
    // Short trail behind the spark.
    const len = Math.hypot(s.vx, s.vy) || 1;
    const tx = (s.vx / len) * 16;
    const ty = (s.vy / len) * 16;
    ctx.strokeStyle = 'rgba(255, 180, 80, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x - tx, s.y - ty);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8e0';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFx(ctx, game, time) {
  for (const n of game.novaFx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, n.alpha);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = Math.max(0, n.alpha * 0.18);
    ctx.fillStyle = '#ff9a2e';
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawDarkness(ctx, game, time) {
  const dctx = getDarkCtx();
  const { world, player, stats } = game;
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, W, H);
  dctx.fillStyle = 'rgba(3, 2, 8, 0.88)';
  dctx.fillRect(0, 0, W, H);
  dctx.globalCompositeOperation = 'destination-out';
  // Player glow.
  const radius = lightRadius(player.light, stats);
  const flick = 1 + 0.03 * Math.sin(time * 9) + 0.02 * Math.sin(time * 17);
  cutLight(dctx, player.x, player.y, radius * flick, 1);
  // Lit braziers.
  for (const b of world.braziers) {
    if (b.lit) cutLight(dctx, b.x, b.y, tv('brazierBurnRadius') + 60, 0.9);
  }
  // Bosses carry their own menacing aura — they are always visible.
  for (const e of game.enemies) {
    if (!e.dead && e.boss) cutLight(dctx, e.x, e.y, e.r + 120, 0.82);
  }
  // Burning ground.
  for (const g of game.burningGround) {
    cutLight(dctx, g.x, g.y, g.r + 30, 0.6);
  }
  // Nova flash.
  for (const n of game.novaFx) {
    cutLight(dctx, n.x, n.y, n.r + 40, 0.7);
  }
  ctx.drawImage(darkCanvas, 0, 0);
}

function cutLight(dctx, x, y, radius, strength) {
  const grad = dctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(0,0,0,${strength})`);
  grad.addColorStop(0.68, `rgba(0,0,0,${strength * 0.8})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  dctx.fillStyle = grad;
  dctx.beginPath();
  dctx.arc(x, y, radius, 0, Math.PI * 2);
  dctx.fill();
}

// Enemies outside the light still show their eyes — the dark is never empty.
function drawEyesInDark(ctx, game) {
  const { player, stats } = game;
  const radius = lightRadius(player.light, stats);
  for (const e of game.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    const inBrazier = game.world.braziers.some((b) => b.lit && Math.hypot(e.x - b.x, e.y - b.y) < tv('brazierBurnRadius') + 60);
    if (d > radius && !inBrazier) {
      ctx.save();
      ctx.fillStyle = e.eyeColor || '#ff3b30';
      ctx.globalAlpha = 0.85;
      const s = e.boss ? 5 : 2.5;
      ctx.beginPath();
      ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.3, s, 0, Math.PI * 2);
      ctx.arc(e.x + e.r * 0.3, e.y - e.r * 0.3, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawFloaters(ctx, game) {
  ctx.save();
  ctx.font = 'bold 15px Georgia, serif';
  ctx.textAlign = 'center';
  for (const f of game.floaters) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

function drawVignette(ctx) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// Enemy palette: body color, rim, eye color. Assigned in main.js at spawn.
export const ENEMY_COLORS = {
  wisp: { color: '#6b5a8a', rim: '#a58fd0', eye: '#d9c8ff' },
  crawler: { color: '#4a5a3a', rim: '#8aa86a', eye: '#ffe08a' },
  spitter: { color: '#6b2a52', rim: '#c05a9a', eye: '#ff5ad0' },
  splitter: { color: '#7a3a1e', rim: '#d08a4a', eye: '#ffd166' },
  brute: { color: '#5e1f1a', rim: '#c05a4a', eye: '#ff6b5e' },
  warden: { color: '#123a2e', rim: '#4de8a8', eye: '#a8ffda' },
  gloommaw: { color: '#241233', rim: '#b98cff', eye: '#ff3b30' },
};
