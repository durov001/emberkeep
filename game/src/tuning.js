// Every tunable number in EMBERKEEP v2 lives here, each as
// { value, min, max, step } so a balance pass touches one file only.
// Read a value with tv('key').

// prettier-ignore
export const TUNING = {
  // Player
  playerHp:        { value: 100, min: 50,  max: 300, step: 5 },
  playerSpeed:     { value: 240, min: 150, max: 400, step: 10 },
  baseLightRadius: { value: 150, min: 80,  max: 260, step: 5 },
  sparkDamage:     { value: 12,  min: 4,   max: 40,  step: 1 },
  sparkRate:       { value: 3,   min: 1,   max: 10,  step: 0.25 },
  sparkSpeed:      { value: 520, min: 300, max: 900, step: 20 },
  sparkRange:      { value: 420, min: 200, max: 700, step: 20 },
  dashCharges:     { value: 2,   min: 1,   max: 4,   step: 1 },
  dashRecharge:    { value: 3,   min: 1,   max: 8,   step: 0.5 },
  dashDistance:    { value: 170, min: 80,  max: 320, step: 10 },
  dashIframes:     { value: 0.25, min: 0.1, max: 0.6, step: 0.05 },
  novaRadius:      { value: 200, min: 120, max: 360, step: 10 },
  novaDamage:      { value: 40,  min: 10,  max: 120, step: 5 },
  novaCooldown:    { value: 12,  min: 4,   max: 30,  step: 1 },
  // LIGHT meter
  lightMax:        { value: 100, min: 50,  max: 200, step: 5 },
  kindleCost:      { value: 25,  min: 10,  max: 50,  step: 5 },
  lightPerKill:    { value: 2,   min: 0,   max: 8,   step: 1 },
  lightPerEmber:   { value: 5,   min: 1,   max: 15,  step: 1 },
  glowBase:        { value: 70,  min: 30,  max: 140, step: 5 },
  glowPerLight:    { value: 0.8, min: 0.2, max: 2,   step: 0.1 },
  // Braziers
  brazierCount:    { value: 5,   min: 3,   max: 8,   step: 1 },
  brazierBurnRadius: { value: 140, min: 80, max: 240, step: 10 },
  brazierBurnDps:  { value: 20,  min: 5,   max: 60,  step: 5 },
  kindleRange:     { value: 78,  min: 50,  max: 140, step: 2 },
  // Nights
  enemiesBase:     { value: 12,  min: 6,   max: 30,  step: 1 },
  enemiesPerNight: { value: 6,   min: 2,   max: 14,  step: 1 },
  spawnInterval:   { value: 1.1, min: 0.3, max: 3,   step: 0.1 },
  endlessScale:    { value: 0.15, min: 0.05, max: 0.4, step: 0.05 },
  // Combo & score
  comboWindow:     { value: 3,   min: 1,   max: 6,   step: 0.5 },
  scorePerKill:    { value: 10,  min: 1,   max: 50,  step: 1 },
  // Enemies (hp / speed px-s / touch damage)
  wispHp:          { value: 20,  min: 5,   max: 80,  step: 5 },
  wispSpeed:       { value: 150, min: 80,  max: 260, step: 5 },
  wispDamage:      { value: 8,   min: 2,   max: 25,  step: 1 },
  crawlerHp:       { value: 60,  min: 20,  max: 200, step: 5 },
  crawlerSpeed:    { value: 78,  min: 40,  max: 160, step: 5 },
  crawlerDamage:   { value: 14,  min: 5,   max: 40,  step: 1 },
  spitterHp:       { value: 30,  min: 10,  max: 100, step: 5 },
  spitterSpeed:    { value: 105, min: 60,  max: 200, step: 5 },
  spitterDamage:   { value: 10,  min: 3,   max: 30,  step: 1 },
  splitterHp:      { value: 40,  min: 15,  max: 120, step: 5 },
  splitterSpeed:   { value: 118, min: 60,  max: 220, step: 5 },
  splitterDamage:  { value: 10,  min: 3,   max: 30,  step: 1 },
  bruteHp:         { value: 120, min: 40,  max: 400, step: 10 },
  bruteSpeed:      { value: 92,  min: 50,  max: 180, step: 5 },
  bruteDamage:     { value: 22,  min: 8,   max: 60,  step: 2 },
  wardenHp:        { value: 800, min: 300, max: 2000, step: 50 },
  gloommawHp:      { value: 1500, min: 600, max: 4000, step: 100 },
  // Workshop
  workshopMaxLevel: { value: 5, min: 1, max: 10, step: 1 },
};

export function tv(key) {
  return TUNING[key].value;
}

// Difficulty multipliers: enemy hp/damage and score.
export const DIFFICULTIES = {
  kindled: { label: 'Kindled', enemyMul: 0.7, scoreMul: 0.8, blurb: 'Gentle embers. Learn the flame.' },
  ember: { label: 'Ember', enemyMul: 1.0, scoreMul: 1.0, blurb: 'The intended burn.' },
  hollow: { label: 'Hollow', enemyMul: 1.4, scoreMul: 1.3, blurb: 'The dark fights back. +30% score.' },
};

// Workshop tracks: 4 permanent upgrade lines, bought with banked ember.
export const WORKSHOP = [
  { id: 'vitality', name: 'Vitality', desc: '+10 max HP per level', perLevel: 10, baseCost: 30 },
  { id: 'wickcraft', name: 'Wickcraft', desc: '+8 light radius per level', perLevel: 8, baseCost: 30 },
  { id: 'sparkforge', name: 'Sparkforge', desc: '+8% spark damage per level', perLevel: 0.08, baseCost: 40 },
  { id: 'swiftfoot', name: 'Swiftfoot', desc: '+4% move speed per level', perLevel: 0.04, baseCost: 40 },
];

export function workshopCost(track, level) {
  return track.baseCost * (level + 1);
}
