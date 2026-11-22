// render.js — every pixel of Lantern Heist, drawn on one canvas.
// The playfield is the museum floor (top-down): checker stone, dark
// shadow corners, wooden crates, leafy bushes, a glowing green exit and
// golden lantern relics. Guards draw as uniformed figures with a
// translucent vision cone that turns yellow -> orange -> red as their
// suspicion rises. The thief carries a lantern: a soft pool of light
// follows them, and darkness shows what is safe.
import {
  TILE, COLS, ROWS, MAP, SHADOW_TILES, tileCenter, isExit,
} from './level.js';
import { conePolygon } from './guards.js';

export const HUD_H = 64;
export const VIEW_W = COLS * TILE;
export const VIEW_H = HUD_H + ROWS * TILE;

const FLOOR_A = '#3a3230';
const FLOOR_B = '#342d2b';

function drawFloor(ctx, tick) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * TILE;
      const y = HUD_H + row * TILE;
      const t = MAP[row][col];
      if (t === '#') {
        ctx.fillStyle = '#241d1c';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#3b2f2a';
        ctx.fillRect(x + 3, y + 3, TILE - 6, 10);
        ctx.strokeStyle = '#171110';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        continue;
      }
      ctx.fillStyle = (col + row) % 2 === 0 ? FLOOR_A : FLOOR_B;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
      if (SHADOW_TILES.has(col + ',' + row)) {
        ctx.fillStyle = 'rgba(8,10,28,0.42)';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
}

function drawBush(ctx, col, row, tick) {
  const x = col * TILE;
  const y = HUD_H + row * TILE;
  const sway = Math.sin(tick / 28 + col * 1.7 + row) * 1.5;
  ctx.fillStyle = '#1d4d24';
  ctx.beginPath();
  ctx.arc(x + 14, y + 30, 13, 0, Math.PI * 2);
  ctx.arc(x + 30 + sway, y + 22, 14, 0, Math.PI * 2);
  ctx.arc(x + 36, y + 36, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f7a35';
  ctx.beginPath();
  ctx.arc(x + 18, y + 26, 8, 0, Math.PI * 2);
  ctx.arc(x + 30 + sway, y + 30, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrate(ctx, col, row) {
  const x = col * TILE + 4;
  const y = HUD_H + row * TILE + 4;
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(x, y, TILE - 8, TILE - 8);
  ctx.fillStyle = '#8a6234';
  ctx.fillRect(x + 3, y + 3, TILE - 14, TILE - 14);
  ctx.strokeStyle = '#4a2f16';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, TILE - 10, TILE - 10);
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 3);
  ctx.lineTo(x + TILE - 11, y + TILE - 11);
  ctx.moveTo(x + TILE - 11, y + 3);
  ctx.lineTo(x + 3, y + TILE - 11);
  ctx.stroke();
}

function drawRelic(ctx, relic, tick) {
  if (relic.taken) return;
  const c = tileCenter(relic.col, relic.row);
  const y = HUD_H + c.y;
  const bob = Math.sin(tick / 22 + relic.col) * 3;
  const glow = 0.55 + Math.sin(tick / 18) * 0.2;
  const grad = ctx.createRadialGradient(c.x, y + bob, 2, c.x, y + bob, 30);
  grad.addColorStop(0, 'rgba(255,214,90,' + glow + ')');
  grad.addColorStop(1, 'rgba(255,214,90,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c.x, y + bob, 30, 0, Math.PI * 2);
  ctx.fill();
  // Little golden lantern.
  ctx.fillStyle = '#2b1d05';
  ctx.fillRect(c.x - 8, y + bob - 12, 16, 22);
  ctx.fillStyle = '#ffd65a';
  ctx.fillRect(c.x - 5, y + bob - 9, 10, 16);
  ctx.fillStyle = '#8a6234';
  ctx.fillRect(c.x - 9, y + bob - 14, 18, 3);
  ctx.fillRect(c.x - 9, y + bob + 10, 18, 3);
  ctx.fillStyle = '#fff3c4';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RELIC', c.x, y + bob + 24);
}

function drawExit(ctx, tick, unlocked) {
  const c = tileCenter(18, 3);
  const y = HUD_H + c.y;
  const pulse = 0.5 + Math.sin(tick / 20) * 0.2;
  const color = unlocked ? 'rgba(90,255,140,' + pulse + ')' : 'rgba(120,140,160,0.55)';
  const grad = ctx.createRadialGradient(c.x, y, 4, c.x, y, 42);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c.x, y, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = unlocked ? '#12351d' : '#222a30';
  ctx.fillRect(c.x - 14, y - 18, 28, 36);
  ctx.strokeStyle = unlocked ? '#5aff8c' : '#7d8b96';
  ctx.lineWidth = 3;
  ctx.strokeRect(c.x - 14, y - 18, 28, 36);
  ctx.fillStyle = unlocked ? '#5aff8c' : '#9fb0bc';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(unlocked ? 'EXIT' : 'LOCKED', c.x, y - 24);
}

function drawPatrolPaths(ctx, guards) {
  ctx.save();
  ctx.setLineDash([2, 7]);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1.5;
  for (const guard of guards) {
    // Dotted path is drawn from the guard's current patrol route by
    // connecting its waypoints — see guards.js PATROLS via waypoint list
    // stored on the guard at build time (guard.path).
    if (!guard.path) continue;
    ctx.beginPath();
    guard.path.forEach((p, i) => {
      const px = p[0] * TILE + TILE / 2;
      const py = HUD_H + p[1] * TILE + TILE / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawCone(ctx, guard) {
  const pts = conePolygon(guard);
  const heat = guard.state === 'chase' ? 1 : guard.suspicion;
  const fill = guard.state === 'chase'
    ? 'rgba(255,60,50,0.34)'
    : heat > 0.35
      ? 'rgba(255,150,40,0.30)'
      : 'rgba(255,220,90,0.22)';
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(guard.x, HUD_H + guard.y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, HUD_H + p.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = guard.state === 'chase' ? 'rgba(255,80,60,0.7)' : 'rgba(255,220,90,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawGuard(ctx, guard, tick) {
  drawCone(ctx, guard);
  const x = guard.x;
  const y = HUD_H + guard.y;
  // Body: uniformed figure with helmet and shoulders.
  ctx.fillStyle = '#20242e';
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = guard.color;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(guard.facing) * 16, y + Math.sin(guard.facing) * 16);
  ctx.stroke();
  // Helmet brim.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x + Math.cos(guard.facing) * 6, y + Math.sin(guard.facing) * 6, 4, 0, Math.PI * 2);
  ctx.fill();
  // Name + state mark.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(guard.name.toUpperCase(), x, y - 19);
  if (guard.state === 'chase') {
    ctx.fillStyle = '#ff5040';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('!', x, y - 30);
  } else if (guard.state === 'suspicious' || guard.suspicion > 0.35) {
    ctx.fillStyle = '#ffb020';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('?', x, y - 30);
  }
  // Suspicion arc above the guard.
  if (guard.suspicion > 0.02 && guard.state !== 'chase') {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 18, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = guard.suspicion > 0.6 ? '#ff5040' : '#ffb020';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlayer(ctx, player, tick) {
  const x = player.x;
  const y = HUD_H + player.y;
  // Lantern light pool.
  const grad = ctx.createRadialGradient(x, y, 6, x, y, 95);
  grad.addColorStop(0, 'rgba(255,210,110,0.20)');
  grad.addColorStop(1, 'rgba(255,210,110,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 95, 0, Math.PI * 2);
  ctx.fill();
  // Noise ring while running.
  if (player.running && player.moving) {
    const pulse = 0.5 + 0.5 * Math.sin(player.noisePulse * 6);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + pulse * 0.3) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 120, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Hooded thief: dark cloak, amber hood, lantern dot.
  ctx.fillStyle = player.hiddenInBush ? 'rgba(40,60,40,0.9)' : '#3d2b52';
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb84d';
  ctx.beginPath();
  ctx.arc(x, y - 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1226';
  ctx.beginPath();
  ctx.arc(x, y - 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(x + 10, y + 8, 3, 0, Math.PI * 2);
  ctx.fill();
  if (player.sneaking) {
    ctx.fillStyle = '#cfe8ff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SNEAKING', x, y - 19);
  }
}

function drawHud(ctx, state) {
  ctx.fillStyle = '#14100e';
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = '#ffd65a';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LANTERN HEIST', 14, 26);
  ctx.fillStyle = '#cbb98f';
  ctx.font = '13px sans-serif';
  ctx.fillText('The Ember Museum — steal 3 relics, reach the EXIT unseen', 14, 48);
  // Relic pips.
  for (let i = 0; i < 3; i++) {
    const px = 560 + i * 26;
    ctx.fillStyle = i < state.player.relics ? '#ffd65a' : '#4a4038';
    ctx.beginPath();
    ctx.arc(px, 24, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i < state.player.relics ? '#2b1d05' : '#8a7a5c';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('R', px, 28);
  }
  ctx.fillStyle = '#cbb98f';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RELICS ' + state.player.relics + '/3', 560, 50);
  // Detection bar.
  const bx = 660;
  const bw = 180;
  ctx.fillStyle = '#2a2320';
  ctx.fillRect(bx, 14, bw, 16);
  const det = state.detection;
  ctx.fillStyle = det < 0.35 ? '#5aff8c' : det < 0.7 ? '#ffb020' : '#ff5040';
  ctx.fillRect(bx, 14, Math.max(2, bw * det), 16);
  ctx.strokeStyle = '#8a7a5c';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, 14.5, bw, 16);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(det >= 1 ? 'SPOTTED!' : det > 0.35 ? 'SUSPICIOUS' : 'HIDDEN', bx, 46);
  // Alert + time.
  ctx.fillStyle = state.alarm ? '#ff5040' : '#cbb98f';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(state.alarm ? '!! ALARM !!' : 'CALM', 946, 26);
  ctx.fillStyle = '#cbb98f';
  ctx.font = '12px sans-serif';
  ctx.fillText(state.timeText, 946, 48);
}

function drawOverlay(ctx, state) {
  if (state.phase === 'playing') return;
  ctx.fillStyle = 'rgba(10,8,10,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (state.phase === 'title') {
    ctx.fillStyle = '#ffd65a';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('LANTERN HEIST', VIEW_W / 2, 220);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('A top-down stealth game in the Ember Museum', VIEW_W / 2, 262);
    ctx.fillStyle = '#cbb98f';
    ctx.font = '16px sans-serif';
    ctx.fillText('Steal 3 golden relics, then slip out the EXIT unseen.', VIEW_W / 2, 300);
    ctx.fillText('Guards patrol with vision cones — crates and bushes block their sight.', VIEW_W / 2, 326);
    ctx.fillText('Shadow is safer. Running is loud. If a guard fills your meter, run and break sight!', VIEW_W / 2, 352);
    ctx.fillStyle = '#5aff8c';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('WASD / arrows move · Shift sneak · Space run · Click to walk · R restart', VIEW_W / 2, 410);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press ENTER or click to begin', VIEW_W / 2, 460);
  } else if (state.phase === 'win') {
    ctx.fillStyle = '#5aff8c';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('CLEAN GETAWAY!', VIEW_W / 2, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('All 3 relics stolen, and nobody saw a thing.', VIEW_W / 2, 300);
    ctx.fillStyle = '#ffd65a';
    ctx.font = '18px sans-serif';
    ctx.fillText('Time ' + state.timeText + ' · Times spotted: ' + state.timesSpotted, VIEW_W / 2, 340);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Press R to play again', VIEW_W / 2, 400);
  } else if (state.phase === 'lose') {
    ctx.fillStyle = '#ff5040';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('CAUGHT!', VIEW_W / 2, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('A guard grabbed you under the alarm. The museum keeps its relics.', VIEW_W / 2, 300);
    ctx.fillStyle = '#ffd65a';
    ctx.font = '18px sans-serif';
    ctx.fillText('Relics stolen: ' + state.player.relics + '/3 · Time ' + state.timeText, VIEW_W / 2, 340);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Press R to try again', VIEW_W / 2, 400);
  }
}

export function render(ctx, state) {
  const tick = state.tick;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#14100e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawFloor(ctx, tick);
  drawPatrolPaths(ctx, state.guards);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const t = MAP[row][col];
      if (t === 'B') drawBush(ctx, col, row, tick);
      else if (t === 'C') drawCrate(ctx, col, row);
    }
  }
  drawExit(ctx, tick, state.player.relics >= 3);
  for (const relic of state.relics) drawRelic(ctx, relic, tick);
  for (const guard of state.guards) drawGuard(ctx, guard, tick);
  drawPlayer(ctx, state.player, tick);
  // Darkness vignette: the museum is dim except around lanterns.
  ctx.fillStyle = 'rgba(4,6,16,0.10)';
  ctx.fillRect(0, HUD_H, VIEW_W, ROWS * TILE);
  drawHud(ctx, state);
  drawOverlay(ctx, state);
}
