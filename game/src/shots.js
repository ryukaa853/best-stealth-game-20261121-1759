// shots.js — deterministic staged states for the entry's screenshots.
// Each preset moves the same live game objects into a moment worth
// showing (cover, a cone sweeping close, the alarm, the win screen).
// Nothing here is a mock: the guards, cones, HUD and overlays are the
// real game rendering the real state.
import { TILE, tileCenter } from './level.js';

function placePlayer(state, col, row) {
  const c = tileCenter(col, row);
  state.player.x = c.x;
  state.player.y = c.y;
}

function placeGuard(state, index, col, row, facingDeg) {
  const guard = state.guards[index];
  const c = tileCenter(col, row);
  guard.x = c.x;
  guard.y = c.y;
  guard.facing = (facingDeg * Math.PI) / 180;
  guard.pauseTimer = 999;
  return guard;
}

export function applyShot(state, shot) {
  state.tick = 60 * 42;
  state.timeText = '00:42';
  if (shot === 'cover') {
    // Full level at a glance: thief mid-floor by a crate, three guards
    // with cones, a bush, the exit glowing, one relic already stolen.
    state.relics[0].taken = true;
    state.player.relics = 1;
    placePlayer(state, 5, 6);
    state.player.sneaking = true;
    placeGuard(state, 0, 10, 2, 180);
    placeGuard(state, 1, 4, 8, 0);
    placeGuard(state, 2, 15, 8, 135);
    placeGuard(state, 3, 12, 6, 180);
    state.detection = 0.12;
  } else if (shot === 'patrol') {
    // Near-miss: the thief crouches sneaking inside a bush while
    // Vesper's cone sweeps just past them.
    state.relics[0].taken = true;
    state.player.relics = 1;
    placePlayer(state, 2, 4);
    state.player.sneaking = true;
    state.player.hiddenInBush = true;
    placeGuard(state, 0, 12, 2, 180);
    const vesper = placeGuard(state, 1, 3, 6, 135);
    vesper.suspicion = 0.28;
    vesper.state = 'suspicious';
    vesper.targetX = state.player.x;
    vesper.targetY = state.player.y;
    placeGuard(state, 2, 16, 9, 90);
    placeGuard(state, 3, 10, 9, 0);
    state.detection = 0.28;
  } else if (shot === 'alarm') {
    // The alarm moment: meter full, red cones, guards chasing, the
    // thief running for the shadow with the exit still locked.
    state.relics[0].taken = true;
    state.relics[1].taken = true;
    state.player.relics = 2;
    placePlayer(state, 11, 7);
    state.player.running = true;
    state.player.moving = true;
    state.player.noisePulse = 1;
    state.alarm = true;
    state.detection = 1;
    state.timesSpotted = 1;
    state.lastKnown = { x: state.player.x, y: state.player.y };
    const brass = placeGuard(state, 0, 9, 6, 0);
    brass.state = 'chase';
    const vesper = placeGuard(state, 1, 8, 8, 45);
    vesper.state = 'chase';
    const onyx = placeGuard(state, 2, 14, 8, 180);
    onyx.state = 'chase';
    const moth = placeGuard(state, 3, 12, 10, -90);
    moth.state = 'chase';
  } else if (shot === 'win') {
    // The win screen: all relics stolen, clean getaway, final time.
    for (const relic of state.relics) relic.taken = true;
    state.player.relics = 3;
    placePlayer(state, 18, 3);
    state.tick = 60 * 97;
    state.timeText = '01:37';
    state.timesSpotted = 1;
    state.phase = 'win';
  }
}
