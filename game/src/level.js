// level.js — the Ember Museum floor plan and all tile queries.
// The map is a grid of characters; every tile is 48 px. Walls and crates
// block movement and sight, bushes block sight but not movement (and hide
// the thief inside them), shadow tiles halve how fast guards spot you.
export const TILE = 48;
export const COLS = 20;
export const ROWS = 13;

export const MAP = [
  '####################',
  '#P....#.....B......#',
  '#..C..#..R.....C...#',
  '#.....#........#..E#',
  '#.B...#..C..B......#',
  '#.....#.....#......#',
  '#..C.....R.....C...#',
  '#.....#.....#..B...#',
  '#.B...#..C.....#...#',
  '#.....#.....R......#',
  '#..C..#..B.....C...#',
  '#.....#........#...#',
  '####################',
];

// Tiles that count as shadow (dim light, slower detection). Chosen as
// fixed coordinates so the layout is identical on every run.
export const SHADOW_TILES = new Set([
  '2,1', '3,1', '4,1', '2,2', '3,3', '4,3',
  '15,4', '16,4', '17,4', '15,5', '16,5',
  '2,7', '3,7', '2,8', '3,9', '4,9',
  '10,10', '11,10', '12,11', '13,11',
]);

export function tileAt(col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return '#';
  return MAP[row][col];
}

export function isWall(col, row) {
  return tileAt(col, row) === '#';
}

export function isCrate(col, row) {
  return tileAt(col, row) === 'C';
}

// Blocks a guard's line of sight.
export function blocksSight(col, row) {
  const t = tileAt(col, row);
  return t === '#' || t === 'C' || t === 'B';
}

// Blocks walking.
export function blocksMove(col, row) {
  const t = tileAt(col, row);
  return t === '#' || t === 'C';
}

export function isBush(col, row) {
  return tileAt(col, row) === 'B';
}

export function isShadow(col, row) {
  return SHADOW_TILES.has(col + ',' + row);
}

export function isExit(col, row) {
  return tileAt(col, row) === 'E';
}

export function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

// All relic pickup spots, in map order.
export function relicSpots() {
  const spots = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (MAP[row][col] === 'R') spots.push({ col, row });
    }
  }
  return spots;
}

export function playerStart() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (MAP[row][col] === 'P') return tileCenter(col, row);
    }
  }
  return tileCenter(1, 1);
}

export function exitCenter() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (MAP[row][col] === 'E') return tileCenter(col, row);
    }
  }
  return tileCenter(18, 3);
}

// True when no sight-blocking tile lies between two points. Steps along
// the segment in small increments so thin walls are never skipped.
export function hasLineOfSight(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const col = Math.floor((x0 + dx * t) / TILE);
    const row = Math.floor((y0 + dy * t) / TILE);
    if (blocksSight(col, row)) return false;
  }
  return true;
}

// Distance from a point to the nearest sight blocker along a ray.
// Used to draw vision cones that stop at walls and crates.
export function rayDistance(x, y, angle, maxDist) {
  const step = 6;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let px = x;
  let py = y;
  let travelled = 0;
  while (travelled < maxDist) {
    px += dx;
    py += dy;
    travelled += step;
    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);
    if (blocksSight(col, row)) return travelled;
  }
  return maxDist;
}
