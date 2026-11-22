// guards.js — the museum guards: patrols, vision, suspicion and alarm.
// A guard has four states:
//   patrol    — walks its waypoints, cone sweeping ahead.
//   suspicious— saw something briefly (or heard a noise): turns toward it,
//               suspicion rises; if it fades, the guard goes back.
//   chase     — the alarm is up: runs at the thief's last known spot.
//   search    — the thief broke line of sight: the guard checks the last
//               known spot, looks around, then returns to patrol.
// Suspicion is a per-guard meter 0..1. It fills only while the thief is
// inside the cone with line of sight, and drains when hidden — so a
// near-miss is always recoverable until the meter fills.
import { TILE, hasLineOfSight, isBush, isShadow, rayDistance, tileCenter } from './level.js';

export const VISION_RANGE = 5.5 * TILE;
export const VISION_HALF_ANGLE = (32 * Math.PI) / 180;
export const PATROL_SPEED = 1.55 * TILE;
export const CHASE_SPEED = 2.55 * TILE;

const PATROLS = [
  { name: 'Brass', color: '#e8b64c', waypoints: [[8, 1], [16, 1], [16, 3], [8, 3]] },
  { name: 'Vesper', color: '#7fb3e8', waypoints: [[3, 9], [3, 5], [8, 5], [8, 9]] },
  { name: 'Onyx', color: '#c98ae8', waypoints: [[15, 5], [18, 8], [15, 11], [12, 8]] },
  { name: 'Moth', color: '#8ae8a0', waypoints: [[9, 6], [14, 6], [14, 10], [9, 10]] },
];

function angleTo(x0, y0, x1, y1) {
  return Math.atan2(y1 - y0, x1 - x0);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnToward(current, target, maxStep) {
  const d = angleDiff(target, current);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function makeGuards() {
  return PATROLS.map((def, i) => {
    const start = tileCenter(def.waypoints[0][0], def.waypoints[0][1]);
    const next = tileCenter(def.waypoints[1][0], def.waypoints[1][1]);
    return {
      name: def.name,
      color: def.color,
      path: def.waypoints,
      x: start.x,
      y: start.y,
      facing: angleTo(start.x, start.y, next.x, next.y),
      waypointIndex: 1,
      state: 'patrol',
      suspicion: 0,
      searchTimer: 0,
      lookTimer: 0,
      lookDir: 0,
      targetX: start.x,
      targetY: start.y,
      pauseTimer: i * 20,
      footstepTick: 0,
    };
  });
}

// Can this guard see the thief right now? Cone + range + line of sight,
// and never through a bush the thief is hiding in.
export function guardSeesPlayer(guard, player) {
  if (player.hiddenInBush) return false;
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > VISION_RANGE) return false;
  const toPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(toPlayer, guard.facing)) > VISION_HALF_ANGLE) return false;
  return hasLineOfSight(guard.x, guard.y, player.x, player.y);
}

// How fast suspicion fills while seen: closer is faster, sneaking and
// shadow slow it down, running speeds it up.
export function spottingRate(guard, player) {
  const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
  const closeness = 1 - (dist / VISION_RANGE) * 0.55;
  let rate = 0.85 * closeness;
  if (player.sneaking) rate *= 0.5;
  if (player.running) rate *= 1.5;
  const col = Math.floor(player.x / TILE);
  const row = Math.floor(player.y / TILE);
  if (isShadow(col, row)) rate *= 0.5;
  if (isBush(col, row)) rate *= 0.25;
  return rate;
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.facing = turnToward(guard.facing, Math.atan2(dy, dx), 6 * dt);
  return dist - step < 2;
}

export function updateGuard(guard, dt, player, alarm, lastKnown) {
  // Suspicion rises while seen, drains while hidden.
  const sees = guardSeesPlayer(guard, player);
  if (sees && !alarm) {
    guard.suspicion = Math.min(1, guard.suspicion + spottingRate(guard, player) * dt);
    guard.facing = turnToward(guard.facing, angleTo(guard.x, guard.y, player.x, player.y), 5 * dt);
    guard.targetX = player.x;
    guard.targetY = player.y;
  } else if (!alarm) {
    guard.suspicion = Math.max(0, guard.suspicion - 0.22 * dt);
  }

  if (alarm) {
    guard.state = 'chase';
    const arrived = moveToward(guard, lastKnown.x, lastKnown.y, CHASE_SPEED, dt);
    if (arrived) {
      guard.state = 'search';
      guard.searchTimer = 3;
      guard.lookDir = guard.facing + Math.PI / 2;
    }
    return;
  }

  if (guard.state === 'chase' || guard.state === 'search') {
    guard.searchTimer -= dt;
    if (guard.searchTimer <= 0) {
      guard.state = 'patrol';
      guard.suspicion = 0;
      return;
    }
    if (guard.state === 'search') {
      guard.facing = turnToward(guard.facing, guard.lookDir, 2.2 * dt);
      if (Math.abs(angleDiff(guard.lookDir, guard.facing)) < 0.05) {
        guard.lookDir = guard.facing + Math.PI * 0.9;
      }
    }
    return;
  }

  if (guard.suspicion > 0.35) {
    guard.state = 'suspicious';
    guard.facing = turnToward(guard.facing, angleTo(guard.x, guard.y, guard.targetX, guard.targetY), 4 * dt);
    if (guard.suspicion <= 0.05) guard.state = 'patrol';
    return;
  }
  guard.state = 'patrol';

  // Patrol: pause briefly at each waypoint, then walk to the next.
  if (guard.pauseTimer > 0) {
    guard.pauseTimer -= dt;
    return;
  }
  const def = PATROLS.find((p) => p.name === guard.name);
  const wp = def.waypoints[guard.waypointIndex];
  const target = tileCenter(wp[0], wp[1]);
  const arrived = moveToward(guard, target.x, target.y, PATROL_SPEED, dt);
  if (arrived) {
    guard.waypointIndex = (guard.waypointIndex + 1) % def.waypoints.length;
    guard.pauseTimer = 0.9;
  }
}

// A running thief makes noise: guards inside the noise radius turn and
// walk to investigate the sound.
export function guardsHearNoise(guards, x, y, radius) {
  for (const guard of guards) {
    if (guard.state === 'chase') continue;
    const dist = Math.hypot(guard.x - x, guard.y - y);
    if (dist < radius) {
      guard.suspicion = Math.max(guard.suspicion, 0.45);
      guard.targetX = x;
      guard.targetY = y;
      if (guard.state === 'patrol') guard.state = 'suspicious';
    }
  }
}

// Vision-cone polygon for drawing: rays fanned across the field of view,
// each stopping at the first wall, crate or bush.
export function conePolygon(guard) {
  const rays = 26;
  const pts = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rays; i++) {
    const a = guard.facing - VISION_HALF_ANGLE + (2 * VISION_HALF_ANGLE * i) / rays;
    const d = rayDistance(guard.x, guard.y, a, VISION_RANGE);
    pts.push({ x: guard.x + Math.cos(a) * d, y: guard.y + Math.sin(a) * d });
  }
  return pts;
}
