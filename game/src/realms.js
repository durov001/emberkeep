// The three realms of the 7-night campaign. Each realm owns its palette,
// its decor, and its hazard — so a screenshot of any night reads instantly
// as a different place.

export const ARENA = { w: 1280, h: 720, wall: 26 };

export const REALMS = [
  {
    id: 'wastes',
    name: 'Ember Wastes',
    nights: [1, 2],
    tagline: 'Ash and old fire.',
    bg: '#120b08',
    ground: '#1d130e',
    groundAlt: '#241811',
    accent: '#ffb347',
    accentDim: '#8a5a1e',
    glow: 'rgba(255, 170, 60, 0.55)',
    hazard: 'vein',
    hazardName: 'Ember Vein',
    hazardBlurb: 'Cracked veins leak ember. Walk over them to gather light.',
    decor: 'stones',
  },
  {
    id: 'gloomwood',
    name: 'Gloomwood',
    nights: [3, 4, 5],
    tagline: 'The trees lean in.',
    bg: '#08120e',
    ground: '#0e1a13',
    groundAlt: '#12241a',
    accent: '#4de8a8',
    accentDim: '#1e6b4a',
    glow: 'rgba(80, 230, 170, 0.45)',
    hazard: 'thorn',
    hazardName: 'Thorn Patch',
    hazardBlurb: 'Thorns bite: standing in them drains HP.',
    decor: 'trees',
  },
  {
    id: 'hollow',
    name: 'The Hollow',
    nights: [6, 7],
    tagline: 'Where the light went out.',
    bg: '#0d0816',
    ground: '#150e22',
    groundAlt: '#1b1129',
    accent: '#b98cff',
    accentDim: '#5a3d8a',
    glow: 'rgba(185, 140, 255, 0.5)',
    hazard: 'rift',
    hazardName: 'Void Rift',
    hazardBlurb: 'Rifts tear open — shadows pour out of them.',
    decor: 'ruins',
  },
];

export function realmForNight(night) {
  if (night <= 2) return REALMS[0];
  if (night <= 5) return REALMS[1];
  return REALMS[2];
}

// Fork routes offered after nights 2, 4 and 6. Each names its reward and its
// danger up front — the choice is the game.
export const FORKS = [
  {
    id: 'forge',
    name: 'Ember Forge',
    reward: '+1 relic draft after the next night',
    danger: 'Enemies +20% HP next night',
    blurb: 'The forge pays in power. It charges in blood.',
  },
  {
    id: 'moonwell',
    name: 'Moonwell',
    reward: 'Heal to full HP now',
    danger: '-1 brazier next night',
    blurb: 'Cold water, warm skin. One brazier stays dark.',
  },
  {
    id: 'ashvault',
    name: 'Ash Vault',
    reward: '+60 ember, banked at once',
    danger: 'Night starts with 3 Brutes',
    blurb: 'Old hoards. Older guards.',
  },
  {
    id: 'hollowgate',
    name: 'Hollow Gate',
    reward: 'Skip the next night\'s first wave',
    danger: 'Bosses +15% HP for the run',
    blurb: 'A shortcut through the dark. The dark notices.',
  },
];

export function forkPair(night, rng) {
  // Deterministic rotation so each fork night offers a different pair.
  const a = FORKS[(night / 2 - 1) % FORKS.length];
  const b = FORKS[(night / 2) % FORKS.length];
  return rng ? [a, b] : [a, b];
}
