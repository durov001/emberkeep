// EMBERKEEP — the entry program. It hands the game in: copies game/ and
// screenshots/ from this repository into the output directory and writes
// dossier.json there with make.fun's own library, so the dossier the grader
// rebuilds matches byte for byte. Fully deterministic: no timestamps, no
// randomness, the same input always writes the same bytes.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The caps this bounty grades against (its gate.json, in full). */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** This repository's root: the directory holding this file. */
const repoRoot = dirname(fileURLToPath(import.meta.url));

/** Where the entry goes: the harness's directory, or /output in the grader. */
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

/** Copy one tree into the output, replacing any earlier copy first. */
function handIn(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) {
    throw new Error(`missing ${name}/: the repository holds no ${name} to hand in`);
  }
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
handIn('game');
handIn('screenshots');
const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);
if (dossier.length === 0) {
  throw new Error('dossier.json came out empty: refusing to hand in a blank dossier');
}
