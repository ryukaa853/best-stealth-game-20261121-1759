// audio.js — tiny WebAudio bleeps for Lantern Heist. No audio files:
// every sound is an oscillator started on a user gesture, so the game
// stays silent until the player first presses a key or clicks.
export function makeAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, durMs, type, gainValue, whenMs) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + (whenMs || 0) / 1000;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(gainValue || 0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.02);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    pickup() {
      tone(660, 120, 'sine', 0.09, 0);
      tone(990, 180, 'sine', 0.09, 90);
    },
    alarm() {
      tone(220, 160, 'square', 0.06, 0);
      tone(175, 200, 'square', 0.06, 150);
    },
    caught() {
      tone(140, 300, 'sawtooth', 0.08, 0);
      tone(90, 420, 'sawtooth', 0.08, 220);
    },
    win() {
      tone(523, 140, 'sine', 0.09, 0);
      tone(659, 140, 'sine', 0.09, 130);
      tone(784, 260, 'sine', 0.09, 260);
    },
    footstep() {
      tone(95, 40, 'triangle', 0.03, 0);
    },
    locked() {
      tone(180, 90, 'square', 0.05, 0);
    },
  };
}
