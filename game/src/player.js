// player.js — the thief: movement, stance, noise, relic pickups.
// Stances: walk (normal), sneak (Shift — slower, quieter, harder to spot),
// run (held automatically when moving far? No: run is double-tap free —
// the thief runs while a direction key is held AND Shift is NOT held is
// wrong; keep it simple: walk by default, Shift = sneak, and running is
// triggered by holding a direction for a while? Simpler and readable:
// walk default, Shift sneaks, and the thief runs when the player holds
// the direction key plus the mouse button — no. Final rule, shown in the
// HUD: WASD/arrows walk, hold Shift to sneak, hold Space to run.
// Running is fast and loud; sneaking is slow and quiet.
import { TILE, blocksMove, isBush, isExit, relicSpots, tileCenter } from './level.js';

export const WALK_SPEED = 2.6 * TILE;
export const SNEAK_SPEED = 1.5 * TILE;
export const RUN_SPEED = 3.9 * TILE;
export const NOISE_RADIUS = 2.5 * TILE;

export function makePlayer(start) {
  return {
    x: start.x,
    y: start.y,
    radius: 13,
    sneaking: false,
    running: false,
    moving: false,
    hiddenInBush: false,
    relics: 0,
    stepTick: 0,
    noisePulse: 0,
  };
}

// Move with wall sliding: try x then y separately so the thief slides
// along walls instead of sticking to them.
export function movePlayer(player, dx, dy, dt) {
  const speed = player.sneaking ? SNEAK_SPEED : player.running ? RUN_SPEED : WALK_SPEED;
  const nx = player.x + dx * speed * dt;
  const ny = player.y + dy * speed * dt;
  const r = player.radius - 2;
  if (!hitsWall(nx, player.y, r)) player.x = nx;
  if (!hitsWall(player.x, ny, r)) player.y = ny;
  player.moving = dx !== 0 || dy !== 0;
  if (player.moving && player.running) {
    player.noisePulse += dt;
  } else {
    player.noisePulse = 0;
  }
}

function hitsWall(x, y, r) {
  const corners = [
    [x - r, y - r], [x + r, y - r],
    [x - r, y + r], [x + r, y + r],
  ];
  for (const [cx, cy] of corners) {
    if (blocksMove(Math.floor(cx / TILE), Math.floor(cy / TILE))) return true;
  }
  return false;
}

export function updatePlayerStatus(player) {
  const col = Math.floor(player.x / TILE);
  const row = Math.floor(player.y / TILE);
  player.hiddenInBush = isBush(col, row) && player.sneaking;
}

export function playerOnExit(player) {
  const col = Math.floor(player.x / TILE);
  const row = Math.floor(player.y / TILE);
  return isExit(col, row);
}

// Relics the thief is standing on. Each relic is collected once.
export function collectRelics(player, relics) {
  let gained = 0;
  for (const relic of relics) {
    if (relic.taken) continue;
    const c = tileCenter(relic.col, relic.row);
    if (Math.hypot(player.x - c.x, player.y - c.y) < 26) {
      relic.taken = true;
      player.relics += 1;
      gained += 1;
    }
  }
  return gained;
}

export function makeRelics() {
  return relicSpots().map((s) => ({ col: s.col, row: s.row, taken: false }));
}
