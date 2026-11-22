// game.js — Lantern Heist state machine and main loop.
// Phases: title -> playing -> win | lose. The loop runs on a fixed
// 1/60 s step driven by a tick counter, never by the wall clock, so
// replays are deterministic. The game state is exposed on window.__game
// for automated play-testing only; the game itself never reads it.
import { TILE, playerStart, exitCenter } from './level.js';
import { makeGuards, updateGuard, guardsHearNoise, guardSeesPlayer } from './guards.js';
import { makePlayer, movePlayer, updatePlayerStatus, playerOnExit, collectRelics, makeRelics, NOISE_RADIUS } from './player.js';
import { makeAudio } from './audio.js';
import { render, VIEW_W, VIEW_H, HUD_H } from './render.js';
import { makeRng } from './rng.js';
import { applyShot } from './shots.js';

export const SEED = 1337;
const STEP = 1 / 60;
const CALM_AFTER_HIDDEN_TICKS = 4 * 60;

export function makeState() {
  const rng = makeRng(SEED);
  void rng;
  return {
    phase: 'title',
    tick: 0,
    player: makePlayer(playerStart()),
    guards: makeGuards(),
    relics: makeRelics(),
    detection: 0,
    alarm: false,
    alarmHiddenTicks: 0,
    lastKnown: exitCenter(),
    timesSpotted: 0,
    spottedLatch: false,
    timeText: '00:00',
    clickTarget: null,
    paused: false,
  };
}

function formatTime(tick) {
  const total = Math.floor(tick / 60);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return mm + ':' + ss;
}

export function startGame(canvas) {
  const ctx = canvas.getContext('2d');
  const audio = makeAudio();
  const state = makeState();
  window.__game = state;
  window.__audio = audio;

  const keys = new Set();
  let accumulator = 0;
  let lastStamp = 0;

  function reset() {
    const fresh = makeState();
    Object.assign(state, fresh);
    state.phase = 'playing';
  }

  function update(dt) {
    state.tick += 1;
    state.timeText = formatTime(state.tick);
    const p = state.player;

    // Input -> movement direction (keyboard, then click-to-move target).
    let dx = 0;
    let dy = 0;
    if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
    if (keys.has('arrowright') || keys.has('d')) dx += 1;
    if (keys.has('arrowup') || keys.has('w')) dy -= 1;
    if (keys.has('arrowdown') || keys.has('s')) dy += 1;
    if (dx === 0 && dy === 0 && state.clickTarget) {
      const tx = state.clickTarget.x - p.x;
      const ty = state.clickTarget.y - p.y;
      const dist = Math.hypot(tx, ty);
      if (dist < 8) {
        state.clickTarget = null;
      } else {
        dx = tx / dist;
        dy = ty / dist;
      }
    }
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }
    p.sneaking = keys.has('shift');
    p.running = keys.has(' ') && !p.sneaking;
    movePlayer(p, dx, dy, dt);
    updatePlayerStatus(p);

    // Footsteps: running is loud, guards come to listen.
    if (p.running && p.moving) {
      p.stepTick += 1;
      if (p.stepTick % 18 === 0) {
        audio.footstep();
        guardsHearNoise(state.guards, p.x, p.y, NOISE_RADIUS);
      }
    }

    // Relics.
    const gained = collectRelics(p, state.relics);
    if (gained > 0) audio.pickup();

    // Detection: the highest guard suspicion is the global meter.
    let maxSuspicion = 0;
    let anySees = false;
    for (const guard of state.guards) {
      if (guardSeesPlayer(guard, p)) anySees = true;
    }
    for (const guard of state.guards) {
      updateGuard(guard, dt, p, state.alarm, state.lastKnown);
      if (guard.suspicion > maxSuspicion) maxSuspicion = guard.suspicion;
    }
    if (anySees) {
      state.lastKnown = { x: p.x, y: p.y };
      state.alarmHiddenTicks = 0;
    }
    state.detection = state.alarm ? 1 : maxSuspicion;

    // Alarm trips when any guard's meter fills; it is not instant fail.
    if (!state.alarm && maxSuspicion >= 1) {
      state.alarm = true;
      state.timesSpotted += 1;
      state.spottedLatch = true;
      audio.alarm();
    }

    // Alarm calms when the thief stays out of sight for 4 seconds:
    // guards search the last known spot, then go back to patrol.
    if (state.alarm) {
      if (anySees) {
        state.alarmHiddenTicks = 0;
      } else {
        state.alarmHiddenTicks += 1;
        if (state.alarmHiddenTicks >= CALM_AFTER_HIDDEN_TICKS) {
          state.alarm = false;
          state.detection = 0;
          for (const guard of state.guards) {
            guard.suspicion = 0;
            guard.state = 'search';
            guard.searchTimer = 3;
          }
        }
      }
      // Caught: a guard reaches the thief while the alarm is up.
      for (const guard of state.guards) {
        if (Math.hypot(guard.x - p.x, guard.y - p.y) < 20) {
          state.phase = 'lose';
          audio.caught();
          return;
        }
      }
    }

    // Win: reach the exit with all 3 relics.
    if (playerOnExit(p)) {
      if (p.relics >= 3) {
        state.phase = 'win';
        audio.win();
      } else if (state.tick % 60 === 0) {
        audio.locked();
      }
    }
  }

  function frame(stamp) {
    requestAnimationFrame(frame);
    if (state.paused) {
      render(ctx, state);
      return;
    }
    if (state.phase !== 'playing') {
      render(ctx, state);
      return;
    }
    if (!lastStamp) lastStamp = stamp;
    let elapsed = (stamp - lastStamp) / 1000;
    lastStamp = stamp;
    if (elapsed > 0.25) elapsed = 0.25;
    accumulator += elapsed;
    while (accumulator >= STEP) {
      update(STEP);
      accumulator -= STEP;
      if (state.phase !== 'playing') break;
    }
    render(ctx, state);
  }

  function keyName(e) {
    return e.key.toLowerCase();
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
      e.preventDefault();
    }
    audio.unlock();
    if (k === 'enter' && state.phase === 'title') {
      state.phase = 'playing';
      return;
    }
    if (k === 'r' && (state.phase === 'win' || state.phase === 'lose' || state.phase === 'playing')) {
      reset();
      return;
    }
    if (k === 'm') {
      audio.toggleMute();
      return;
    }
    if (k === 'p' && state.phase === 'playing') {
      state.paused = !state.paused;
      return;
    }
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (state.phase === 'title') {
      state.phase = 'playing';
      return;
    }
    if (state.phase === 'win' || state.phase === 'lose') {
      reset();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = VIEW_W / rect.width;
    const scaleY = VIEW_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY - HUD_H;
    if (y >= 0) state.clickTarget = { x, y };
  });

  // Screenshot presets: ?shot=cover|patrol|alarm|win — deterministic
  // staged states of the same game, for the entry's screenshots.
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    state.phase = 'playing';
    applyShot(state, shot);
    render(ctx, state);
    return state;
  }

  render(ctx, state);
  requestAnimationFrame(frame);
  return state;
}
